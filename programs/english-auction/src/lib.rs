use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use std::mem::size_of;

declare_id!("C2oTbMX7GGWw4w3pmF1c4wkvyMvARg5dqPkH5TS9Niip"); // 실제 배포 시에는 변경 필요

/*
    003 - English Auction
    The code below is Solana version of the following example code.
    https://solidity-by-example.org/app/english-auction/

    - Seller of NFT deploys this program.
    - Participants can bid by depositing SOL greater than the current highest bidder.
    - All bidders can withdraw their bid before the bidder gets the NFT.
*/

#[program]
pub mod english_auction {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, starting_bid: u64) -> Result<()> {
        ctx.accounts.auction.seller = ctx.accounts.seller.key();
        ctx.accounts.auction.is_started = false;
        ctx.accounts.auction.is_ended = false;
        ctx.accounts.auction.starting_bid = starting_bid;
        ctx.accounts.auction.highest_bidder = Pubkey::default();
        ctx.accounts.auction.highest_bid = starting_bid;
        Ok(())
    }

    pub fn start(ctx: Context<Start>) -> Result<()> {
        require!(
            !ctx.accounts.auction.is_started,
            AuctionError::AlreadyStarted
        );

        let mint = &ctx.accounts.mint;
        let is_nft = mint.decimals == 0 && mint.supply == 1;

        require!(is_nft, AuctionError::InvalidNFT);

        ctx.accounts.auction.is_started = true;
        ctx.accounts.auction.nft_mint = ctx.accounts.mint.key();

        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.auction_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );
        token::transfer(cpi_context, 1)?;

        Ok(())
    }

    pub fn bid(ctx: Context<Bid>, bid_amount: u64) -> Result<()> {
        require!(ctx.accounts.auction.is_started, AuctionError::NotStarted);
        require!(!ctx.accounts.auction.is_ended, AuctionError::AlreadyEnded);
        require!(
            bid_amount > ctx.accounts.auction.highest_bid,
            AuctionError::InsufficientBidAmount
        );

        ctx.accounts.auction.highest_bidder = ctx.accounts.bidder.key();
        ctx.accounts.auction.highest_bid = bid_amount;
        ctx.accounts.bid_account.bidder = ctx.accounts.bidder.key();
        ctx.accounts.bid_account.amount = bid_amount;

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.bidder.to_account_info(),
                to: ctx.accounts.auction.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, bid_amount)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let bid_amount = ctx.accounts.bid_account.amount;

        if ctx.accounts.bid_account.bidder == ctx.accounts.auction.highest_bidder {
            ctx.accounts.auction.highest_bidder = Pubkey::default();
            ctx.accounts.auction.highest_bid = ctx.accounts.auction.starting_bid;
        }
        ctx.accounts.bid_account.amount = 0;

        **ctx.accounts.auction.to_account_info().try_borrow_mut_lamports()? -= bid_amount;
        **ctx.accounts.bidder.to_account_info().try_borrow_mut_lamports()? += bid_amount;

        Ok(())
    }

    pub fn end(ctx: Context<End>) -> Result<()> {
        require!(!ctx.accounts.auction.is_ended, AuctionError::AlreadyEnded);

        ctx.accounts.auction.is_ended = true;

        let seeds = &[
            b"auction",
            ctx.accounts.auction.seller.as_ref(),
            &[ctx.bumps.auction],
        ];
        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.auction_token_account.to_account_info(),
                to: ctx.accounts.highest_bidder_token_account.to_account_info(),
                authority: ctx.accounts.auction.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_context, 1)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = seller, seeds = [b"auction", seller.key().as_ref()], bump, space = 8 + size_of::<Auction>())]
    pub auction: Account<'info, Auction>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Start<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut, 
        seeds = [b"auction", auction.seller.key().as_ref()], 
        bump,
        constraint = seller.key() == auction.seller @ AuctionError::Unauthorized
    )]
    pub auction: Account<'info, Auction>,

    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub auction_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Bid<'info> {
    #[account(mut, seeds = [b"auction", auction.seller.key().as_ref()], bump)]
    pub auction: Account<'info, Auction>,

    #[account(
        init_if_needed, 
        payer = bidder, 
        seeds = [b"bid", bidder.key().as_ref()], 
        bump, 
        space = 8 + size_of::<BidAccount>()
    )]
    pub bid_account: Account<'info, BidAccount>,

    #[account(mut)]
    pub bidder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"auction", auction.seller.key().as_ref()], bump)]
    pub auction: Account<'info, Auction>,

    #[account(
        mut, 
        seeds = [b"bid", bidder.key().as_ref()], 
        bump, 
        constraint = bid_account.bidder == bidder.key() @ AuctionError::Unauthorized,
    )]
    pub bid_account: Account<'info, BidAccount>,

    #[account(mut)]
    pub bidder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct End<'info> {
    #[account(
        mut, 
        seeds = [b"auction", auction.seller.key().as_ref()], 
        bump,
        constraint = seller.key() == auction.seller @ AuctionError::Unauthorized
    )]
    pub auction: Account<'info, Auction>,

    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        constraint = highest_bidder_token_account.owner == auction.highest_bidder @ AuctionError::InvalidTokenAccount
    )]
    pub highest_bidder_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub auction_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Auction {
    pub nft_mint: Pubkey,
    pub seller: Pubkey,
    pub is_started: bool,
    pub is_ended: bool,
    pub starting_bid: u64,
    pub highest_bidder: Pubkey,
    pub highest_bid: u64,
}

#[account]
pub struct BidAccount {
    pub bidder: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum AuctionError {
    #[msg("Only the auction seller can call this function.")]
    Unauthorized,
    #[msg("Auction is already started.")]
    AlreadyStarted,
    #[msg("Auction is not started.")]
    NotStarted,
    #[msg("Auction is already ended.")]
    AlreadyEnded,
    #[msg("Auction is not ended.")]
    NotEnded,
    #[msg("Insufficient bid amount.")]
    InsufficientBidAmount,
    #[msg("Invalid token account.")]
    InvalidTokenAccount,
    #[msg("No bid to withdraw.")]
    NoBidToWithdraw,
    #[msg("Only NFT can be auctioned.")]
    InvalidNFT,
}
