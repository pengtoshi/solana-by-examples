import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PengtoshiSolanaBoilerplate } from "../target/types/pengtoshi_solana_boilerplate";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, mintTo, getOrCreateAssociatedTokenAccount, getAccount } from "@solana/spl-token";
import { assert } from "chai";

describe("sample-program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PengtoshiSolanaBoilerplate as Program<PengtoshiSolanaBoilerplate>;

  const admin = provider.wallet;
  const user = Keypair.generate();

  let mint: PublicKey;
  let userTokenAccount: PublicKey;
  let vaultTokenAccount: PublicKey;
  let vaultPda: PublicKey;
  let userDepositPda: PublicKey;

  const MINT_TO_AMOUNT = LAMPORTS_PER_SOL;
  const DEPOSIT_AMOUNT = LAMPORTS_PER_SOL * 0.5;
  const WITHDRAW_AMOUNT = LAMPORTS_PER_SOL * 0.25;

  it("Airdrops SOL to user", async () => {
    const sig = await provider.connection.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction({
      signature: sig,
      blockhash: (await provider.connection.getLatestBlockhash()).blockhash,
      lastValidBlockHeight: (await provider.connection.getLatestBlockhash()).lastValidBlockHeight,
    });

    const userBalance = await provider.connection.getBalance(user.publicKey);
    assert.equal(userBalance, 2 * LAMPORTS_PER_SOL);
  });

  it("Creates test SPL token mint", async () => {
    mint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 6);

    const userTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      mint,
      user.publicKey,
    );
    userTokenAccount = userTokenAcc.address;

    await mintTo(provider.connection, admin.payer, mint, userTokenAccount, admin.publicKey, MINT_TO_AMOUNT);

    const userToken = await getAccount(provider.connection, userTokenAccount);
    assert.equal(Number(userToken.amount), MINT_TO_AMOUNT);
  });

  it("Initializes the vault", async () => {
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), admin.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .initialize(mint)
      .accounts({ admin: admin.publicKey, vault: vaultPda, systemProgram: SystemProgram.programId } as any)
      .rpc();
  });

  it("Creates the vault's token account (ATA)", async () => {
    const vaultTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      mint,
      vaultPda, // the vault PDA is the owner
      true, // allowOwnerOffCurve=true since PDA is not a keypair
    );
    vaultTokenAccount = vaultTokenAcc.address;
  });

  it("User deposits tokens to the vault", async () => {
    [userDepositPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), vaultPda.toBuffer(), user.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .deposit(new anchor.BN(DEPOSIT_AMOUNT))
      .accounts({
        user: user.publicKey,
        userTokenAccount,
        vaultTokenAccount,
        vault: vaultPda,
        userDeposit: userDepositPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([user])
      .rpc();

    const userToken = await getAccount(provider.connection, userTokenAccount);
    const vaultToken = await getAccount(provider.connection, vaultTokenAccount);
    const userDeposit = await program.account.userDeposit.fetch(userDepositPda);

    assert.equal(Number(userToken.amount), MINT_TO_AMOUNT - DEPOSIT_AMOUNT);
    assert.equal(Number(vaultToken.amount), DEPOSIT_AMOUNT);
    assert.equal(Number(userDeposit.amount), DEPOSIT_AMOUNT);
  });

  it("User withdraws tokens from the vault", async () => {
    await program.methods
      .withdraw(new anchor.BN(WITHDRAW_AMOUNT))
      .accounts({
        user: user.publicKey,
        userTokenAccount,
        vaultTokenAccount,
        vault: vaultPda,
        userDeposit: userDepositPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([user])
      .rpc();

    const userToken = await getAccount(provider.connection, userTokenAccount);
    const vaultToken = await getAccount(provider.connection, vaultTokenAccount);
    const userDeposit = await program.account.userDeposit.fetch(userDepositPda);

    assert.equal(Number(userToken.amount), MINT_TO_AMOUNT - DEPOSIT_AMOUNT + WITHDRAW_AMOUNT);
    assert.equal(Number(vaultToken.amount), DEPOSIT_AMOUNT - WITHDRAW_AMOUNT);
    assert.equal(Number(userDeposit.amount), DEPOSIT_AMOUNT - WITHDRAW_AMOUNT);
  });
});
