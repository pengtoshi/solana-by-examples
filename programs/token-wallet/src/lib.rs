use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use std::mem::size_of;

declare_id!("D6w82MofZg4rTBcEmX1futPpnsj9Zs96MJ4Bf4su3ZhJ"); // 실제 배포 시에는 변경 필요

/*
    002 - Token Wallet
    - Anyone can send tokens(FT, NFT) to the wallet.
    - Only the wallet owner can withdraw.
*/

#[program]
pub mod token_wallet {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.wallet.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let mint = &ctx.accounts.mint;
        let is_nft = mint.decimals == 0 && mint.supply == 1;

        require!(!is_nft || amount == 1, WalletError::InvalidNFTAmount);

        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.wallet_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_context, amount)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let mint = &ctx.accounts.mint;
        let is_nft = mint.decimals == 0 && mint.supply == 1;

        require!(!is_nft || amount == 1, WalletError::InvalidNFTAmount);
        require_keys_eq!(
            ctx.accounts.wallet.authority,
            ctx.accounts.authority.key(),
            WalletError::Unauthorized
        );

        let seeds = &[
            b"wallet",
            ctx.accounts.wallet.authority.as_ref(),
            &[ctx.bumps.wallet],
        ];
        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.wallet_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.wallet.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_context, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [b"wallet", authority.key().as_ref()], bump, space = 8 + size_of::<WalletAccount>())]
    pub wallet: Account<'info, WalletAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(seeds = [b"wallet", wallet.authority.key().as_ref()], bump)]
    pub wallet: Account<'info, WalletAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub wallet_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(seeds = [b"wallet", wallet.authority.key().as_ref()], bump)]
    pub wallet: Account<'info, WalletAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub wallet_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct WalletAccount {
    pub authority: Pubkey,
}

#[error_code]
pub enum WalletError {
    #[msg("Only the wallet owner can call this function.")]
    Unauthorized,
    #[msg("Only 1 NFT can be deposited.")]
    InvalidNFTAmount,
}
