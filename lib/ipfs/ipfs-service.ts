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
      const blob = new Blob([content], { type: metadata.contentType });
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
      const blob = new Blob([contentBuffer], { type: metadata.contentType });
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
   * Pin content to ensure persistence
   */
  async pinContent(cid: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.ipfsGateway}/pin/add?arg=${cid}`, {
        method: 'POST',
      });

      if (response.ok) {
        console.log(`[IPFS] Content pinned: ${cid}`);
        return true;
      } else {
        console.error(`[IPFS] Failed to pin content ${cid}: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error(`[IPFS] Error pinning content ${cid}:`, error);
      return false;
    }
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
   * Verify IPFS content integrity
   */
  async verifyContentIntegrity(cid: string, expectedHash?: string): Promise<boolean> {
    try {
      // Retrieve content
      const content = await this.getContent(cid);
      
      // If expected hash provided, verify it
      if (expectedHash) {
        const crypto = await import('crypto');
        const actualHash = crypto.createHash('sha256').update(content).digest('hex');
        return actualHash === expectedHash;
      }
      
      // Just check if content exists and is retrievable
      return content.length > 0;
    } catch (error) {
      console.error(`[IPFS] Error verifying content integrity for ${cid}:`, error);
      return false;
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

// Export utility functions
export const IPFSUtils = {
  /**
   * Create paper metadata object
   */
  createPaperMetadata(
    title: string,
    abstract: string,
    authors: string[],
    keywords: string[],
    submitterAccount: string
  ): PaperMetadata {
    return {
      title,
      abstract,
      authors,
      keywords,
      submissionDate: new Date().toISOString(),
      submitterAccount,
      contentType: 'application/pdf'
    };
  },

  /**
   * Create review metadata object
   */
  createReviewMetadata(
    paperId: string,
    reviewerAccount: string,
    verdict: number
  ): ReviewMetadata {
    return {
      paperId,
      reviewerAccount,
      verdict,
      submissionDate: new Date().toISOString(),
      contentType: 'application/json'
    };
  },

  /**
   * Convert file to buffer for upload
   */
  async fileToBuffer(file: File): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(Buffer.from(reader.result));
        } else {
          reject(new Error('Failed to convert file to buffer'));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Validate CID format
   */
  isValidCID(cid: string): boolean {
    // Basic CID validation - starts with appropriate prefix
    return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|ba[A-Za-z2-7]{56}|baf[A-Za-z2-7]{55})$/.test(cid);
  }
};

  /**
   * Upload paper content to IPFS and anchor metadata to Hedera HCS
   */
  async uploadPaper(
    content: Buffer | Uint8Array,
    metadata: PaperMetadata
  ): Promise<IPFSUploadResult> {
    try {
      console.log('[IPFS] Uploading paper content...');
      
      // Upload content to IPFS
      const result = await this.ipfs.add(content, {
        pin: true,
        cidVersion: 1,
        hashAlg: 'sha2-256'
      });

      console.log(`[IPFS] Paper uploaded with CID: ${result.cid.toString()}`);

      // Create HCS message with paper metadata
      const hcsMessage = {
        type: 'paper_submission',
        ipfsCid: result.cid.toString(),
        metadata: {
          ...metadata,
          uploadTimestamp: new Date().toISOString(),
          size: result.size
        }
      };

      // Submit to Hedera Consensus Service
      const hcsResult = await this.submitToHCS(JSON.stringify(hcsMessage));

      return {
        cid: result.cid.toString(),
        size: result.size,
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
      const result = await this.ipfs.add(contentBuffer, {
        pin: true,
        cidVersion: 1,
        hashAlg: 'sha2-256'
      });

      console.log(`[IPFS] Review uploaded with CID: ${result.cid.toString()}`);

      // Create HCS message with review metadata
      const hcsMessage = {
        type: 'review_submission',
        ipfsCid: result.cid.toString(),
        metadata: {
          ...metadata,
          uploadTimestamp: new Date().toISOString(),
          size: result.size
        }
      };

      // Submit to Hedera Consensus Service
      const hcsResult = await this.submitToHCS(JSON.stringify(hcsMessage));

      return {
        cid: result.cid.toString(),
        size: result.size,
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
      
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.ipfs.cat(cid)) {
        chunks.push(chunk);
      }
      
      // Concatenate all chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result;
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
   * Pin content to ensure persistence
   */
  async pinContent(cid: string): Promise<boolean> {
    try {
      await this.ipfs.pin.add(cid);
      console.log(`[IPFS] Content pinned: ${cid}`);
      return true;
    } catch (error) {
      console.error(`[IPFS] Error pinning content ${cid}:`, error);
      return false;
    }
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
   * Verify IPFS content integrity
   */
  async verifyContentIntegrity(cid: string, expectedHash?: string): Promise<boolean> {
    try {
      // Retrieve content
      const content = await this.getContent(cid);
      
      // If expected hash provided, verify it
      if (expectedHash) {
        const crypto = await import('crypto');
        const actualHash = crypto.createHash('sha256').update(content).digest('hex');
        return actualHash === expectedHash;
      }
      
      // Just check if content exists and is retrievable
      return content.length > 0;
    } catch (error) {
      console.error(`[IPFS] Error verifying content integrity for ${cid}:`, error);
      return false;
    }
  }

  /**
   * Get IPFS node information
   */
  async getNodeInfo(): Promise<any> {
    try {
      return await this.ipfs.id();
    } catch (error) {
      console.error('[IPFS] Error getting node info:', error);
      return null;
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
  const ipfsUrl = process.env.IPFS_URL || 'https://ipfs.infura.io:5001';
  const hcsTopicId = process.env.HCS_TOPIC_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_PRIVATE_KEY;
  const network = process.env.HEDERA_NETWORK as 'testnet' | 'mainnet' || 'testnet';

  if (!hcsTopicId || !operatorKey) {
    throw new Error('Missing required environment variables: HCS_TOPIC_ID, HEDERA_OPERATOR_PRIVATE_KEY');
  }

  return new IPFSService(ipfsUrl, hcsTopicId, operatorKey, network);
}

// Export utility functions
export const IPFSUtils = {
  /**
   * Create paper metadata object
   */
  createPaperMetadata(
    title: string,
    abstract: string,
    authors: string[],
    keywords: string[],
    submitterAccount: string
  ): PaperMetadata {
    return {
      title,
      abstract,
      authors,
      keywords,
      submissionDate: new Date().toISOString(),
      submitterAccount,
      contentType: 'application/pdf'
    };
  },

  /**
   * Create review metadata object
   */
  createReviewMetadata(
    paperId: string,
    reviewerAccount: string,
    verdict: number
  ): ReviewMetadata {
    return {
      paperId,
      reviewerAccount,
      verdict,
      submissionDate: new Date().toISOString(),
      contentType: 'application/json'
    };
  },

  /**
   * Convert file to buffer for upload
   */
  async fileToBuffer(file: File): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(Buffer.from(reader.result));
        } else {
          reject(new Error('Failed to convert file to buffer'));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Validate CID format
   */
  isValidCID(cid: string): boolean {
    // Basic CID validation - starts with appropriate prefix
    return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|ba[A-Za-z2-7]{56}|baf[A-Za-z2-7]{55})$/.test(cid);
  }
};