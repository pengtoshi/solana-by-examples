import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { EnglishAuction } from "../target/types/english_auction";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { DEFAULT_AIRDROP_AMOUNT } from "./common/constants";
import { getUsableSOLBalance, requestAirdrop } from "./common/utils";

describe.only("english-auction", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.EnglishAuction as Program<EnglishAuction>;

  const seller = provider.wallet;
  const user = Keypair.generate();

  const [auctionPda, _] = PublicKey.findProgramAddressSync(
    [Buffer.from("auction"), seller.publicKey.toBuffer()],
    program.programId,
  );

  let nftMint: PublicKey;
  let sellerNftTokenAccount: PublicKey;
  let auctionNftTokenAccount: PublicKey;

  before(async () => {
    await requestAirdrop(provider.connection, user.publicKey, DEFAULT_AIRDROP_AMOUNT);
    await requestAirdrop(provider.connection, user.publicKey, DEFAULT_AIRDROP_AMOUNT);
  });

  it("Seller initialize the auction", async () => {
    const STARTING_BID = LAMPORTS_PER_SOL; // 1 SOL
    await program.methods
      .initialize(new anchor.BN(STARTING_BID))
      .accounts({
        auction: auctionPda,
        seller: seller.publicKey,
      } as any)
      .rpc();

    const auction = await program.account.auction.fetch(auctionPda);

    expect(auction.seller.equals(seller.publicKey)).to.be.true;
    expect(auction.isStarted).to.be.false;
    expect(auction.isEnded).to.be.false;
    expect(auction.highestBidder.equals(PublicKey.default)).to.be.true;
    expect(Number(auction.highestBid)).to.equal(STARTING_BID);
  });

  it("Seller mint NFT", async () => {
    nftMint = await createMint(provider.connection, seller.payer, seller.publicKey, null, 0);
    const sellerNftTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      seller.payer,
      nftMint,
      seller.publicKey,
    );
    sellerNftTokenAccount = sellerNftTokenAcc.address;
    const auctionNftTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      seller.payer,
      nftMint,
      auctionPda,
      true,
    );
    auctionNftTokenAccount = auctionNftTokenAcc.address;

    await mintTo(provider.connection, seller.payer, nftMint, sellerNftTokenAccount, seller.publicKey, 1);
  });

  it("Should fail - User start the auction", async () => {
    const userNftMint = await createMint(provider.connection, user, user.publicKey, null, 0);
    const userNftTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      userNftMint,
      user.publicKey,
    );
    const userNftTokenAccount = userNftTokenAcc.address;

    await mintTo(provider.connection, user, userNftMint, userNftTokenAccount, user.publicKey, 1);

    try {
      await program.methods
        .start()
        .accounts({
          auction: auctionPda,
          mint: userNftMint,
          seller: user.publicKey,
          sellerTokenAccount: userNftTokenAccount,
          auctionTokenAccount: auctionNftTokenAccount,
        } as any)
        .signers([user])
        .rpc();
      assert.fail("Should fail");
    } catch (err) {
      expect(err.message).to.include("Only the auction seller can call this function.");
    }
  });

  it("Seller start the auction", async () => {
    await program.methods
      .start()
      .accounts({
        auction: auctionPda,
        mint: nftMint,
        seller: seller.publicKey,
        sellerTokenAccount: sellerNftTokenAccount,
        auctionTokenAccount: auctionNftTokenAccount,
      } as any)
      .rpc();

    const auctionToken = await getAccount(provider.connection, auctionNftTokenAccount);
    const sellerToken = await getAccount(provider.connection, sellerNftTokenAccount);
    expect(Number(auctionToken.amount)).to.equal(1);
    expect(Number(sellerToken.amount)).to.equal(0);

    const auction = await program.account.auction.fetch(auctionPda);

    expect(auction.isStarted).to.be.true;
    expect(auction.nftMint.equals(nftMint)).to.be.true;
  });

  it("Should fail - Seller re-start the auction", async () => {
    try {
      await program.methods
        .start()
        .accounts({
          auction: auctionPda,
          mint: nftMint,
          seller: seller.publicKey,
          sellerTokenAccount: sellerNftTokenAccount,
          auctionTokenAccount: auctionNftTokenAccount,
        } as any)
        .rpc();
    } catch (err) {
      expect(err.message).to.include("Auction is already started.");
    }
  });

  it("User bid", async () => {
    const bidAmount = 2 * LAMPORTS_PER_SOL; // 2 SOL

    await program.methods
      .bid(new anchor.BN(bidAmount))
      .accounts({
        auction: auctionPda,
        bidder: user.publicKey,
      } as any)
      .signers([user])
      .rpc();

    const auction = await program.account.auction.fetch(auctionPda);
    expect(auction.highestBidder.equals(user.publicKey)).to.be.true;
    expect(Number(auction.highestBid)).to.equal(bidAmount);

    const auctionBalance = await getUsableSOLBalance(provider.connection, auctionPda);
    expect(auctionBalance).to.equal(bidAmount);
  });

  it("Seller end the auction", async () => {
    const auction = await program.account.auction.fetch(auctionPda);
    const highestBidder = auction.highestBidder;
    const highestBidderTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      seller.payer,
      nftMint,
      highestBidder,
    );
    const highestBidderTokenAccount = highestBidderTokenAcc.address;

    await program.methods
      .end()
      .accounts({
        auction: auctionPda,
        seller: seller.publicKey,
        highestBidderTokenAccount: highestBidderTokenAccount,
        auctionTokenAccount: auctionNftTokenAccount,
      } as any)
      .rpc();

    const auctionToken = await getAccount(provider.connection, auctionNftTokenAccount);
    const highestBidderToken = await getAccount(provider.connection, highestBidderTokenAccount);
    expect(Number(auctionToken.amount)).to.equal(0);
    expect(Number(highestBidderToken.amount)).to.equal(1);
  });
});
