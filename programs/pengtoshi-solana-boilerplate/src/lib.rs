use anchor_lang::prelude::*;

declare_id!("7KoJWHdmBYpdHfVN71gi38FgWZKf6pxYQ7kcRwBe6qS7");

#[program]
pub mod pengtoshi_solana_boilerplate {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
