import { Client, AccountBalanceQuery, AccountId } from "@hashgraph/sdk";

export class HederaClient {
  private client: Client;

  constructor() {
    // Initialize client for testnet (change to mainnet if needed)
    this.client = Client.forTestnet();
  }

  async getAccountBalance(accountId: string) {
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(accountId))
        .execute(this.client);
      
      return {
        hbar: balance.hbars.toString(),
        tokens: balance.tokens
      };
    } catch (error) {
      console.error("Error fetching balance:", error);
      throw new Error("Failed to fetch account balance");
    }
  }

  close() {
    this.client.close();
  }
}
