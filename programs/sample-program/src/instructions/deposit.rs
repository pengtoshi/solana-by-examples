use crate::error::ErrorCode;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault", vault.admin.as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 8,
        seeds = [b"deposit", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(
        ctx.accounts.user_token_account.mint == ctx.accounts.vault.accepted_mint,
        ErrorCode::InvalidMint
    );

    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    let deposit = &mut ctx.accounts.user_deposit;
    deposit.owner = ctx.accounts.user.key();
    deposit.amount += amount;

    Ok(())
}
