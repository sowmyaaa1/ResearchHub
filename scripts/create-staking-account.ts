#!/usr/bin/env tsx
/**
 * Script to create a new Hedera testnet account for staking
 * Run with: npx tsx scripts/create-staking-account.ts
 */

import { Client, PrivateKey, AccountCreateTransaction, Hbar, AccountId } from "@hashgraph/sdk";

async function createStakingAccount() {
  console.log("Creating new Hedera testnet account for staking...\n");

  // Connect to Hedera testnet
  const client = Client.forTestnet();

  // You need an existing testnet account with HBAR to create new accounts
  // Get free testnet HBAR from: https://portal.hedera.com/
  const operatorId = process.env.OPERATOR_ACCOUNT_ID || process.env.NEXT_PUBLIC_OPERATOR_ACCOUNT_ID;
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY || process.env.NEXT_PUBLIC_OPERATOR_PRIVATE_KEY;

  if (!operatorId || !operatorKey) {
    console.error("❌ Error: Missing operator credentials");
    console.log("\nPlease set the following environment variables:");
    console.log("  OPERATOR_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID");
    console.log("  OPERATOR_PRIVATE_KEY=your_private_key");
    console.log("\nGet a free testnet account at: https://portal.hedera.com/");
    process.exit(1);
  }

  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey));

  // Generate new key pair for the staking account
  const newPrivateKey = PrivateKey.generateED25519();
  const newPublicKey = newPrivateKey.publicKey;

  console.log("Generated new key pair:");
  console.log("  Private Key:", newPrivateKey.toString());
  console.log("  Public Key:", newPublicKey.toString());
  console.log();

  // Create the new account with initial balance
  const transaction = new AccountCreateTransaction()
    .setKey(newPublicKey)
    .setInitialBalance(new Hbar(100)); // Start with 100 HBAR for fees

  const txResponse = await transaction.execute(client);
  const receipt = await txResponse.getReceipt(client);
  const newAccountId = receipt.accountId;

  console.log("✅ Successfully created staking account!");
  console.log("\n=== Add these to your .env.local file ===");
  console.log(`STAKING_CONTRACT_ADDRESS=${newAccountId}`);
  console.log(`STAKING_CONTRACT_PRIVATE_KEY=${newPrivateKey}`);
  console.log("=========================================\n");

  console.log("Account Details:");
  console.log(`  Account ID: ${newAccountId}`);
  console.log(`  Initial Balance: 100 HBAR`);
  console.log(`  Network: Testnet`);

  client.close();
}

createStakingAccount().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
