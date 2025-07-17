import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

export const requestAirdrop = async (connection: Connection, publicKey: PublicKey, lamports: number) => {
  const sig = await connection.requestAirdrop(publicKey, lamports);
  await connection.confirmTransaction({
    signature: sig,
    blockhash: (await connection.getLatestBlockhash()).blockhash,
    lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
  });
};

export const getUsableSOLBalance = async (connection: Connection, pda: PublicKey) => {
  const accountInfo = await connection.getAccountInfo(pda);
  if (!accountInfo) throw new Error("Account not found");

  const rentExempt = await connection.getMinimumBalanceForRentExemption(accountInfo.data.length);
  return accountInfo.lamports - rentExempt;
};
