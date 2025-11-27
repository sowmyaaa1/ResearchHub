// Hedera blockchain integration
import { ethers } from "ethers";
import { Client, PrivateKey, AccountId, TransferTransaction, Hbar } from "@hashgraph/sdk";

interface HederaTransactionResult {
  transactionHash: string;
  timestamp: string;
  verified: boolean;
}

const CONTRACT_ADDRESS = "0x6a530AD1Df533BA8fF4Fd23B72A9AceC08e38Dcc";
const ABI = [
  "function publishPaper(uint256 id, string title) external payable",
  "event PaperPublished(uint256 indexed id, string title, address indexed author)",
  "function recordReview(uint256 id, uint256 paperId) external",
  "function hbarBalance(address user) view returns (uint256)",
  "function incrementReputation(address reviewer, uint256 amount) external"
];

export async function recordPaperOnBlockchain(
  paperId: string,
  paperTitle: string,
  authorAddress: string,
  authorPrivateKey: string
): Promise<HederaTransactionResult> {
  // Connect to Hedera EVM testnet
  const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
  const signer = new ethers.Wallet(authorPrivateKey, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  // Call publishPaper with 10 HBAR
  const tx = await contract.publishPaper(Number(paperId), paperTitle, {
    value: ethers.parseEther("10")
  });
  const receipt = await tx.wait();

  // Find PaperPublished event
  const event = receipt.logs
    .map((log: any) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e: any) => e && e.name === "PaperPublished");

  return {
    transactionHash: receipt.hash,
    timestamp: new Date().toISOString(),
    verified: !!event,
  };
}

export async function recordReviewOnBlockchain(
  reviewId: string,
  paperId: string,
  reviewerAddress: string,
  reviewerPrivateKey: string
): Promise<HederaTransactionResult> {
  try {
    console.log("[recordReviewOnBlockchain] Recording review on Hedera network:", { reviewId, paperId, reviewerAddress });
    
    // For now, we'll use a simplified approach that records the review completion
    // In a full production setup, you would deploy a Hedera smart contract service
    
    // Use Hedera SDK to create a transaction memo with review data
    const client = Client.forTestnet();
    
    // Parse private key (try ECDSA first, then ED25519)
    let privateKey: PrivateKey;
    try {
      privateKey = PrivateKey.fromStringECDSA(reviewerPrivateKey);
      console.log('[recordReviewOnBlockchain] Using ECDSA key');
    } catch {
      try {
        privateKey = PrivateKey.fromStringED25519(reviewerPrivateKey);
        console.log('[recordReviewOnBlockchain] Using ED25519 key');
      } catch {
        throw new Error('Invalid private key format for Hedera transaction');
      }
    }
    
    client.setOperator(AccountId.fromString(reviewerAddress), privateKey);
    
    // Create a transaction with memo containing review data
    const reviewData = `REVIEW:${reviewId}:PAPER:${paperId}:COMPLETED:${Date.now()}`;
    
    // Use a minimal HBAR transfer to self with review data in memo
    const transaction = new TransferTransaction()
      .addHbarTransfer(reviewerAddress, new Hbar(-0.001)) // Minimal fee
      .addHbarTransfer(reviewerAddress, new Hbar(0.001))  // Return to self
      .setTransactionMemo(reviewData);
    
    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    client.close();
    
    console.log('[recordReviewOnBlockchain] Review recorded with transaction:', txResponse.transactionId.toString());
    
    return {
      transactionHash: txResponse.transactionId.toString(),
      timestamp: new Date().toISOString(),
      verified: receipt.status.toString() === "SUCCESS",
    };
  } catch (error) {
    console.error('[recordReviewOnBlockchain] Error recording review:', error);
    // Return a mock result but log that blockchain recording failed
    return {
      transactionHash: `mock_review_${Date.now()}`,
      timestamp: new Date().toISOString(),
      verified: false,
    };
  }
}

export async function claimReviewOnBlockchain(
  paperId: string,
  dueDate: number,
  reviewerAddress: string,
  reviewerPrivateKey: string
): Promise<HederaTransactionResult> {
  console.log("[claimReviewOnBlockchain] Processing claim for paper:", paperId, "reviewer:", reviewerAddress);
  
  // Validate that we have a Hedera private key
  if (!reviewerPrivateKey || reviewerPrivateKey.length < 32) {
    throw new Error("Invalid Hedera private key provided");
  }
  
  // For now, mock the blockchain claim since we're using Hedera accounts
  // In production, this would interact with a Hedera smart contract service
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate a mock transaction hash
  const mockTxHash = `0.0.${Math.floor(Math.random() * 1000000)}.${Date.now()}`;
  
  console.log("[claimReviewOnBlockchain] Mock claim successful, tx:", mockTxHash);
  
  return {
    transactionHash: mockTxHash,
    timestamp: new Date().toISOString(),
    verified: true,
  };
}

export async function verifyPaperOnBlockchain(
  blockchainHash: string
): Promise<boolean> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // In production, verify against actual Hedera network
  return true;
}

export async function generateWalletAddress(): Promise<string> {
  // Generate mock Hedera account ID
  return `0.0.${Math.floor(Math.random() * 1000000)}`;
}

// Real HBAR transfer using @hashgraph/sdk

export async function transferHbar(
  senderAccountId: string,
  senderPrivateKey: string,
  recipientAccountId: string,
  amount: number
): Promise<{ transactionId: string; status: string }> {
  const client = Client.forTestnet();
  
  // Try ECDSA first (secp256k1), then fall back to ED25519
  let privateKey: PrivateKey;
  try {
    privateKey = PrivateKey.fromStringECDSA(senderPrivateKey);
    console.log('Using ECDSA key');
  } catch {
    try {
      privateKey = PrivateKey.fromStringED25519(senderPrivateKey);
      console.log('Using ED25519 key');
    } catch {
      throw new Error('Invalid private key format - not ECDSA or ED25519');
    }
  }
  
  client.setOperator(AccountId.fromString(senderAccountId), privateKey);

  const transaction = new TransferTransaction()
    .addHbarTransfer(senderAccountId, new Hbar(-amount))
    .addHbarTransfer(recipientAccountId, new Hbar(amount));

  const txResponse = await transaction.execute(client);
  const receipt = await txResponse.getReceipt(client);

  return {
    transactionId: txResponse.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

// Fetch real HBAR balance from Hedera
import { AccountBalanceQuery, HbarUnit } from "@hashgraph/sdk";

export async function getHbarBalance(accountId: string): Promise<number> {
  const client = Client.forTestnet();
  const balance = await new AccountBalanceQuery()
    .setAccountId(AccountId.fromString(accountId))
    .execute(client);
  return balance.hbars.to(HbarUnit.Hbar).toNumber();
}
