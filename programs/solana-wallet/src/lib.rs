use anchor_lang::prelude::*;
use std::mem::size_of;

declare_id!("6QRjNW4qou9kZ6A1ZkVqCfGk25gxdHj81tPrkF5byTmw"); // 실제 배포 시에는 변경 필요

/*
    001 - Solana Wallet
    The code below is Solana version of the following example code.
    https://solidity-by-example.org/app/ether-wallet/

    - Anyone can send SOL to the wallet.
    - Only the wallet owner can withdraw.
*/

#[program]
pub mod solana_wallet {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.wallet_account.owner = ctx.accounts.owner.key();
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let wallet_account = &ctx.accounts.wallet_account;
        require_keys_eq!(
            wallet_account.owner,
            ctx.accounts.owner.key(),
            WalletError::Unauthorized
        );

        **ctx
            .accounts
            .wallet_account
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.owner.try_borrow_mut_lamports()? += amount;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = owner, space = 8 + size_of::<WalletAccount>())]
    pub wallet_account: Account<'info, WalletAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub wallet_account: Account<'info, WalletAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[account]
pub struct WalletAccount {
    pub owner: Pubkey,
}

#[error_code]
pub enum WalletError {
    #[msg("Only the wallet owner can call this function.")]
    Unauthorized,
}
