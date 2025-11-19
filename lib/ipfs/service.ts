// IPFS integration service for ResearchHub
// Handles paper and review content storage with Hedera HCS anchoring

import { TopicMessageSubmitTransaction, Client, PrivateKey, TopicId, AccountId } from '@hashgraph/sdk';

export interface IPFSUploadResult {
  cid: string;
  size: number;
  pinned: boolean;
  hcsSequenceNumber?: string;
  hederaTxId?: string;
}

export interface PaperMetadata {
  title: string;
  abstract: string;
  authors: string[];
  keywords: string[];
  submissionDate: string;
  submitterAccount: string;
  contentType: 'application/pdf' | 'text/plain' | 'application/json';
}

export interface ReviewMetadata {
  paperId: string;
  reviewerAccount: string;
  verdict: number; // 1-4 scale
  submissionDate: string;
  contentType: 'text/plain' | 'application/json';
}

export class IPFSService {
  private hederaClient: Client;
  private hcsTopicId: TopicId;
  private operatorPrivateKey: PrivateKey;
  private operatorAccountId: AccountId;
  private ipfsGateway: string;

  constructor(
    hederaTopicId: string,
    hederaOperatorKey: string,
    hederaOperatorAccountId: string,
    hederaNetwork: 'testnet' | 'mainnet' = 'testnet',
    ipfsGateway: string = 'https://ipfs.io/api/v0'
  ) {
    // Initialize Hedera client
    this.hederaClient = hederaNetwork === 'testnet' 
      ? Client.forTestnet() 
      : Client.forMainnet();
    
    this.hcsTopicId = TopicId.fromString(hederaTopicId);
    this.operatorPrivateKey = PrivateKey.fromString(hederaOperatorKey);
    this.operatorAccountId = AccountId.fromString(hederaOperatorAccountId);
    this.ipfsGateway = ipfsGateway;
    
    // Set operator for HCS submissions
    this.hederaClient.setOperator(this.operatorAccountId, this.operatorPrivateKey);
  }

  /**
   * Upload paper content to IPFS and anchor metadata to Hedera HCS
   */
  async uploadPaper(
    content: Buffer | Uint8Array,
    metadata: PaperMetadata
  ): Promise<IPFSUploadResult> {
    try {
      console.log('[IPFS] Uploading paper content...');
      
      // Upload content to IPFS using HTTP API
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(content)], { type: metadata.contentType });
      formData.append('file', blob, 'paper.pdf');
      
      const response = await fetch(`${this.ipfsGateway}/add?pin=true`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      const cid = result.Hash;

      console.log(`[IPFS] Paper uploaded with CID: ${cid}`);

      // Create HCS message with paper metadata
      const hcsMessage = {
        type: 'paper_submission',
        ipfsCid: cid,
        metadata: {
          ...metadata,
          uploadTimestamp: new Date().toISOString(),
          size: result.Size
        }
      };

      // Submit to Hedera Consensus Service
      const hcsResult = await this.submitToHCS(JSON.stringify(hcsMessage));

      return {
        cid,
        size: parseInt(result.Size),
        pinned: true,
        hcsSequenceNumber: hcsResult.sequenceNumber,
        hederaTxId: hcsResult.transactionId
      };

    } catch (error) {
      console.error('[IPFS] Error uploading paper:', error);
      throw new Error(`Failed to upload paper to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload review content to IPFS and anchor to HCS
   */
  async uploadReview(
    content: string | Buffer,
    metadata: ReviewMetadata
  ): Promise<IPFSUploadResult> {
    try {
      console.log('[IPFS] Uploading review content...');

      // Convert content to buffer if string
      const contentBuffer = typeof content === 'string' 
        ? Buffer.from(content, 'utf-8')
        : content;

      // Upload content to IPFS
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(contentBuffer)], { type: metadata.contentType });
      formData.append('file', blob, 'review.json');
      
      const response = await fetch(`${this.ipfsGateway}/add?pin=true`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      const cid = result.Hash;

      console.log(`[IPFS] Review uploaded with CID: ${cid}`);

      // Create HCS message with review metadata
      const hcsMessage = {
        type: 'review_submission',
        ipfsCid: cid,
        metadata: {
          ...metadata,
          uploadTimestamp: new Date().toISOString(),
          size: result.Size
        }
      };

      // Submit to Hedera Consensus Service
      const hcsResult = await this.submitToHCS(JSON.stringify(hcsMessage));

      return {
        cid,
        size: parseInt(result.Size),
        pinned: true,
        hcsSequenceNumber: hcsResult.sequenceNumber,
        hederaTxId: hcsResult.transactionId
      };

    } catch (error) {
      console.error('[IPFS] Error uploading review:', error);
      throw new Error(`Failed to upload review to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve content from IPFS using CID
   */
  async getContent(cid: string): Promise<Uint8Array> {
    try {
      console.log(`[IPFS] Retrieving content for CID: ${cid}`);
      
      const response = await fetch(`${this.ipfsGateway}/cat?arg=${cid}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`IPFS retrieval failed: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error(`[IPFS] Error retrieving content for CID ${cid}:`, error);
      throw new Error(`Failed to retrieve content from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get content as text (for reviews)
   */
  async getContentAsText(cid: string): Promise<string> {
    const content = await this.getContent(cid);
    return new TextDecoder().decode(content);
  }

  /**
   * Submit message to Hedera Consensus Service
   */
  private async submitToHCS(message: string): Promise<{
    transactionId: string;
    sequenceNumber?: string;
  }> {
    try {
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(this.hcsTopicId)
        .setMessage(message);

      const response = await transaction.execute(this.hederaClient);
      const receipt = await response.getReceipt(this.hederaClient);

      console.log(`[HCS] Message submitted with transaction ID: ${response.transactionId.toString()}`);

      return {
        transactionId: response.transactionId.toString(),
        sequenceNumber: receipt.topicSequenceNumber?.toString()
      };
    } catch (error) {
      console.error('[HCS] Error submitting message:', error);
      throw new Error(`Failed to submit to HCS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      this.hederaClient.close();
    } catch (error) {
      console.error('[IPFS] Error during cleanup:', error);
    }
  }
}

// Environment configuration helper
export function createIPFSServiceFromEnv(): IPFSService {
  const hcsTopicId = process.env.HCS_TOPIC_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_PRIVATE_KEY;
  const operatorAccountId = process.env.HEDERA_OPERATOR_ACCOUNT_ID;
  const network = process.env.HEDERA_NETWORK as 'testnet' | 'mainnet' || 'testnet';
  const ipfsGateway = process.env.IPFS_GATEWAY || 'https://ipfs.io/api/v0';

  if (!hcsTopicId || !operatorKey || !operatorAccountId) {
    throw new Error('Missing required environment variables: HCS_TOPIC_ID, HEDERA_OPERATOR_PRIVATE_KEY, HEDERA_OPERATOR_ACCOUNT_ID');
  }

  return new IPFSService(hcsTopicId, operatorKey, operatorAccountId, network, ipfsGateway);
}