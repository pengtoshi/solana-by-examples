use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    pub admin: Pubkey,         // vault admin
    pub accepted_mint: Pubkey, // allowed token address
}

#[account]
pub struct UserDeposit {
    pub owner: Pubkey,
    pub amount: u64,
}
