use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid token mint")]
    InvalidMint,

    #[msg("Insufficient balance")]
    InsufficientBalance,
}
