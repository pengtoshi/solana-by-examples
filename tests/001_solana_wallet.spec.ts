import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { SolanaWallet } from "../target/types/solana_wallet";
import { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

const getSolanaWalletBalance = async (connection: Connection, walletPda: PublicKey) => {
  const accountInfo = await connection.getAccountInfo(walletPda);
  if (!accountInfo) return { total: 0, usable: 0 };
  const rentExempt = await connection.getMinimumBalanceForRentExemption(accountInfo.data.length);
  return {
    total: accountInfo.lamports,
    usable: accountInfo.lamports - rentExempt,
  };
};

describe("solana-wallet", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaWallet as Program<SolanaWallet>;

  let walletAccount: anchor.web3.Keypair;
  const admin = provider.wallet;
  const user = anchor.web3.Keypair.generate();

  const LAMPORTS = anchor.web3.LAMPORTS_PER_SOL;

  before(async () => {
    // Fund user
    const tx = await provider.connection.requestAirdrop(user.publicKey, 2 * LAMPORTS);
    await provider.connection.confirmTransaction(tx);
  });

  it("Admin can initialize the wallet", async () => {
    walletAccount = anchor.web3.Keypair.generate();

    await program.methods
      .initialize()
      .accounts({
        walletAccount: walletAccount.publicKey,
        owner: admin.publicKey,
      })
      .signers([walletAccount])
      .rpc();

    const account = await program.account.walletAccount.fetch(walletAccount.publicKey);
    assert.ok(account.owner.equals(admin.publicKey));
  });

  it("Admin can deposit SOL to the vault", async () => {
    const sig = await provider.connection.requestAirdrop(admin.publicKey, 1 * LAMPORTS);
    await provider.connection.confirmTransaction(sig);

    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: walletAccount.publicKey,
        lamports: 0.5 * LAMPORTS,
      }),
    );
    await provider.sendAndConfirm(tx, []);

    const { usable: balance } = await getSolanaWalletBalance(provider.connection, walletAccount.publicKey);
    expect(balance).to.equal(0.5 * LAMPORTS);
  });

  it("User can deposit SOL to the vault", async () => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: user.publicKey,
        toPubkey: walletAccount.publicKey,
        lamports: 0.3 * LAMPORTS,
      }),
    );
    await provider.sendAndConfirm(tx, [user]);

    const { usable: balance } = await getSolanaWalletBalance(provider.connection, walletAccount.publicKey);
    expect(balance).to.equal(0.8 * LAMPORTS);
  });

  it("Admin can withdraw SOL from the vault", async () => {
    const adminBalanceBefore = await provider.connection.getBalance(admin.publicKey);

    await program.methods
      .withdraw(new anchor.BN(0.4 * LAMPORTS))
      .accounts({
        walletAccount: walletAccount.publicKey,
        owner: admin.publicKey,
      })
      .rpc();

    const { usable: walletBalance } = await getSolanaWalletBalance(provider.connection, walletAccount.publicKey);
    expect(walletBalance).to.equal(0.4 * LAMPORTS);
  });

  it("Should fail - User tries to withdraw SOL from the vault", async () => {
    try {
      await program.methods
        .withdraw(new anchor.BN(0.1 * LAMPORTS))
        .accounts({
          walletAccount: walletAccount.publicKey,
          owner: user.publicKey,
        })
        .signers([user])
        .rpc();
      assert.fail("User should not be able to withdraw");
    } catch (err) {
      expect(err.message).to.include("Only the wallet owner can call this function");
    }
  });
});
