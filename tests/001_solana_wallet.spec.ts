import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { SolanaWallet } from "../target/types/solana_wallet";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const requestAirdrop = async (connection: Connection, publicKey: PublicKey, lamports: number) => {
  const sig = await connection.requestAirdrop(publicKey, lamports);
  await connection.confirmTransaction({
    signature: sig,
    blockhash: (await connection.getLatestBlockhash()).blockhash,
    lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
  });
};

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

  let walletAccount: Keypair;
  const admin = provider.wallet;
  const user = Keypair.generate();

  before(async () => {
    await requestAirdrop(provider.connection, admin.publicKey, 1 * LAMPORTS_PER_SOL);
    await requestAirdrop(provider.connection, user.publicKey, 2 * LAMPORTS_PER_SOL);
  });

  it("Admin can initialize the wallet", async () => {
    walletAccount = Keypair.generate();

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
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: walletAccount.publicKey,
        lamports: 0.5 * LAMPORTS_PER_SOL,
      }),
    );
    await provider.sendAndConfirm(tx, []);

    const { usable: balance } = await getSolanaWalletBalance(provider.connection, walletAccount.publicKey);
    expect(balance).to.equal(0.5 * LAMPORTS_PER_SOL);
  });

  it("User can deposit SOL to the vault", async () => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: user.publicKey,
        toPubkey: walletAccount.publicKey,
        lamports: 0.3 * LAMPORTS_PER_SOL,
      }),
    );
    await provider.sendAndConfirm(tx, [user]);

    const { usable: balance } = await getSolanaWalletBalance(provider.connection, walletAccount.publicKey);
    expect(balance).to.equal(0.8 * LAMPORTS_PER_SOL);
  });

  it("Admin can withdraw SOL from the vault", async () => {
    await program.methods
      .withdraw(new anchor.BN(0.4 * LAMPORTS_PER_SOL))
      .accounts({
        walletAccount: walletAccount.publicKey,
        owner: admin.publicKey,
      })
      .rpc();

    const { usable: walletBalance } = await getSolanaWalletBalance(provider.connection, walletAccount.publicKey);
    expect(walletBalance).to.equal(0.4 * LAMPORTS_PER_SOL);
  });

  it("Should fail - User tries to withdraw SOL from the vault", async () => {
    try {
      await program.methods
        .withdraw(new anchor.BN(0.1 * LAMPORTS_PER_SOL))
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
