# Setting Up Your Staking Account

## Quick Start (Recommended)

### Option 1: Use Hedera Portal (No coding required)

1. Visit https://portal.hedera.com/
2. Click "Create Account" and select "Testnet"
3. Save your Account ID (format: `0.0.123456`) and Private Key
4. Add to `.env.local`:
   ```bash
   STAKING_CONTRACT_ADDRESS=0.0.YOUR_ACCOUNT_ID
   STAKING_CONTRACT_PRIVATE_KEY=your_private_key_here
   ```

### Option 2: Use the Script (Requires existing testnet account)

If you already have a Hedera testnet account with HBAR:

1. Add your operator credentials to `.env.local`:
   ```bash
   OPERATOR_ACCOUNT_ID=0.0.YOUR_EXISTING_ACCOUNT
   OPERATOR_PRIVATE_KEY=your_existing_private_key
   ```

2. Run the script:
   ```bash
   npx tsx scripts/create-staking-account.ts
   ```

3. Copy the output to your `.env.local` file

## What is the Staking Address?

The staking address is a Hedera account that acts as a pool where users' staked HBAR is held:

- **When users STAKE**: HBAR transfers FROM user → TO staking account
- **When users UNSTAKE**: HBAR transfers FROM staking account → TO user

## Important Notes

- For **testnet**: Get free HBAR from https://portal.hedera.com/
- For **mainnet**: You'll need real HBAR and a funded account
- Keep your staking account private key secure - it controls all staked funds
- The staking account needs enough HBAR to cover transaction fees

## Current Default

The code currently uses `0.0.123456` as a fallback. This is a placeholder - you **must** replace it with your actual account to enable staking functionality.
