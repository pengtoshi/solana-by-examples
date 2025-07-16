import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { TokenWallet } from "../target/types/token_wallet";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

const requestAirdrop = async (connection: Connection, publicKey: PublicKey, lamports: number) => {
  const sig = await connection.requestAirdrop(publicKey, lamports);
  await connection.confirmTransaction({
    signature: sig,
    blockhash: (await connection.getLatestBlockhash()).blockhash,
    lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
  });
};

describe("token-wallet", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenWallet as Program<TokenWallet>;

  const authority = provider.wallet;
  const user = Keypair.generate();

  const [walletPda, _] = PublicKey.findProgramAddressSync(
    [Buffer.from("wallet"), authority.publicKey.toBuffer()],
    program.programId,
  );

  let ftMint: PublicKey;
  let walletFtTokenAccount: PublicKey;
  let userFtTokenAccount: PublicKey;

  let nftMint: PublicKey;
  let walletNftTokenAccount: PublicKey;
  let userNftTokenAccount: PublicKey;

  before(async () => {
    await requestAirdrop(provider.connection, user.publicKey, 2 * LAMPORTS_PER_SOL);
  });

  it("Authority can initialize the wallet", async () => {
    await program.methods
      .initialize()
      .accounts({
        wallet: walletPda,
        authority: authority.publicKey,
      } as any)
      .rpc();

    const account = await program.account.walletAccount.fetch(walletPda);
    assert.ok(account.authority.equals(authority.publicKey));
  });

  it("Admin can deposit FT to the wallet", async () => {
    ftMint = await createMint(provider.connection, authority.payer, authority.publicKey, null, 6);
    const userFtTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      ftMint,
      authority.publicKey,
    );
    userFtTokenAccount = userFtTokenAcc.address;
    const walletFtTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      ftMint,
      walletPda,
      true,
    );
    walletFtTokenAccount = walletFtTokenAcc.address;

    const DEPOSIT_AMOUNT = 1_000_000;
    await mintTo(provider.connection, authority.payer, ftMint, userFtTokenAccount, authority.publicKey, DEPOSIT_AMOUNT);

    await program.methods
      .deposit(new anchor.BN(DEPOSIT_AMOUNT))
      .accounts({
        mint: ftMint,
        wallet: walletPda,
        user: authority.publicKey,
        userTokenAccount: userFtTokenAccount,
        walletTokenAccount: walletFtTokenAccount,
      } as any)
      .rpc();

    const walletToken = await getAccount(provider.connection, walletFtTokenAccount);
    const userToken = await getAccount(provider.connection, userFtTokenAccount);
    expect(Number(walletToken.amount)).to.equal(DEPOSIT_AMOUNT);
    expect(Number(userToken.amount)).to.equal(0);
  });

  it("Should fail - User withdraws FT from the wallet", async () => {
    const WITHDRAW_AMOUNT = 500_000;
    try {
      await program.methods
        .withdraw(new anchor.BN(WITHDRAW_AMOUNT))
        .accounts({
          mint: ftMint,
          wallet: walletPda,
          authority: user.publicKey,
          userTokenAccount: userFtTokenAccount,
          walletTokenAccount: walletFtTokenAccount,
        } as any)
        .signers([user])
        .rpc();
      assert.fail("User should not be able to withdraw");
    } catch (err) {
      expect(err.message).to.include("Only the wallet owner can call this function.");
    }
  });

  it("Admin can withdraw FT from the wallet", async () => {
    const DEPOSIT_AMOUNT = 1_000_000;
    const WITHDRAW_AMOUNT = 500_000;

    await program.methods
      .withdraw(new anchor.BN(WITHDRAW_AMOUNT))
      .accounts({
        mint: ftMint,
        wallet: walletPda,
        authority: authority.publicKey,
        userTokenAccount: userFtTokenAccount,
        walletTokenAccount: walletFtTokenAccount,
      } as any)
      .rpc();

    const walletToken = await getAccount(provider.connection, walletFtTokenAccount);
    const userToken = await getAccount(provider.connection, userFtTokenAccount);
    expect(Number(walletToken.amount)).to.equal(DEPOSIT_AMOUNT - WITHDRAW_AMOUNT);
    expect(Number(userToken.amount)).to.equal(WITHDRAW_AMOUNT);
  });

  it("Admin can deposit NFT to the wallet", async () => {
    nftMint = await createMint(provider.connection, authority.payer, authority.publicKey, null, 0);
    const userNftTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      nftMint,
      authority.publicKey,
    );
    userNftTokenAccount = userNftTokenAcc.address;
    const walletNftTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      nftMint,
      walletPda,
      true,
    );
    walletNftTokenAccount = walletNftTokenAcc.address;

    await mintTo(provider.connection, authority.payer, nftMint, userNftTokenAccount, authority.publicKey, 1);

    await program.methods
      .deposit(new anchor.BN(1))
      .accounts({
        mint: nftMint,
        wallet: walletPda,
        user: authority.publicKey,
        userTokenAccount: userNftTokenAccount,
        walletTokenAccount: walletNftTokenAccount,
      } as any)
      .rpc();

    const walletToken = await getAccount(provider.connection, walletNftTokenAccount);
    const userToken = await getAccount(provider.connection, userNftTokenAccount);
    expect(Number(walletToken.amount)).to.equal(1);
    expect(Number(userToken.amount)).to.equal(0);
  });

  it("Admin can withdraw NFT from the wallet", async () => {
    const WITHDRAW_AMOUNT = 1;

    await program.methods
      .withdraw(new anchor.BN(WITHDRAW_AMOUNT))
      .accounts({
        mint: nftMint,
        wallet: walletPda,
        authority: authority.publicKey,
        userTokenAccount: userNftTokenAccount,
        walletTokenAccount: walletNftTokenAccount,
      } as any)
      .rpc();

    const walletToken = await getAccount(provider.connection, walletNftTokenAccount);
    const userToken = await getAccount(provider.connection, userNftTokenAccount);
    expect(Number(walletToken.amount)).to.equal(0);
    expect(Number(userToken.amount)).to.equal(1);
  });
});
