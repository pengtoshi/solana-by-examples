pub mod error;
pub mod instructions;
pub mod states;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("CcaQw8DK7EPSavtcQEAvW6BS4bsA2YZ8qy4XehgnJxP2");

#[program]
pub mod pengtoshi_solana_boilerplate {
    use super::*;

    pub fn initialize(ctx: Context<InitializeVault>, mint: Pubkey) -> Result<()> {
        instructions::initialize(ctx, mint)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw(ctx, amount)
    }
}
