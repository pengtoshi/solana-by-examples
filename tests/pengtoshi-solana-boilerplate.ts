import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PengtoshiSolanaBoilerplate } from "../target/types/pengtoshi_solana_boilerplate";

describe("pengtoshi-solana-boilerplate", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .pengtoshiSolanaBoilerplate as Program<PengtoshiSolanaBoilerplate>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
