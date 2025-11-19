// Hedera blockchain indexer service
// Indexes HCS messages and smart contract events
// NO business logic - only data indexing and caching

import { 
  Client, 
  TopicId, 
  TopicMessageQuery, 
  ContractId,
  AccountId,
  PrivateKey,
  Hbar
} from '@hashgraph/sdk';
import { createClient } from '@/lib/supabase/server';

export interface HCSMessage {
  consensusTimestamp: string;
  sequenceNumber: string;
  topicId: string;
  message: string;
  payerAccountId: string;
  runningHash: string;
}

export interface SmartContractEvent {
  contractId: string;
  eventName: string;
  eventData: any;
  transactionId: string;
  consensusTimestamp: string;
}

export interface IndexerConfig {
  hederaNetwork: 'testnet' | 'mainnet';
  hcsTopicId: string;
  contractAddresses: string[];
  operatorAccountId: string;
  operatorPrivateKey: string;
  indexingStartTime?: Date;
}

/**
 * Hedera Consensus Service (HCS) indexer
 * Subscribes to topic messages and indexes them to database
 */
export class HCSIndexer {
  private client: Client;
  private topicId: TopicId;
  private isRunning = false;
  private subscription: any;

  constructor(private config: IndexerConfig) {
    this.client = config.hederaNetwork === 'testnet' 
      ? Client.forTestnet() 
      : Client.forMainnet();
    
    this.topicId = TopicId.fromString(config.hcsTopicId);
    
    // Set operator for queries
    this.client.setOperator(
      AccountId.fromString(config.operatorAccountId),
      PrivateKey.fromString(config.operatorPrivateKey)
    );
  }

  /**
   * Start indexing HCS messages
   */
  async startIndexing(): Promise<void> {
    if (this.isRunning) {
      console.log('[HCS Indexer] Already running');
      return;
    }

    try {
      console.log(`[HCS Indexer] Starting to index topic: ${this.config.hcsTopicId}`);
      
      const query = new TopicMessageQuery()
        .setTopicId(this.topicId)
        .setStartTime(this.config.indexingStartTime || new Date(0));

      this.subscription = query.subscribe(this.client, null, (message) => {
        this.handleHCSMessage({
          consensusTimestamp: message.consensusTimestamp.toString(),
          sequenceNumber: message.sequenceNumber.toString(),
          topicId: this.topicId.toString(),
          message: Buffer.from(message.contents).toString('utf-8'),
          payerAccountId: message.initialTransactionId?.accountId?.toString() || '',
          runningHash: message.runningHash ? Buffer.from(message.runningHash).toString('hex') : ''
        });
      });

      this.isRunning = true;
      console.log('[HCS Indexer] Successfully started');

    } catch (error) {
      console.error('[HCS Indexer] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop indexing
   */
  stopIndexing(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.isRunning = false;
    console.log('[HCS Indexer] Stopped');
  }

  /**
   * Handle incoming HCS message
   */
  private async handleHCSMessage(message: HCSMessage): Promise<void> {
    try {
      console.log(`[HCS Indexer] New message: seq=${message.sequenceNumber}`);

      // Parse message data
      let parsedData;
      try {
        parsedData = JSON.parse(message.message);
      } catch {
        console.warn(`[HCS Indexer] Invalid JSON in message ${message.sequenceNumber}`);
        return;
      }

      // Index to database
      await this.indexHCSMessage(message, parsedData);

      // Process based on message type
      switch (parsedData.type) {
        case 'paper_submission':
          await this.processPaperSubmission(message, parsedData);
          break;
        case 'review_submission':
          await this.processReviewSubmission(message, parsedData);
          break;
        case 'consensus_reached':
          await this.processConsensusReached(message, parsedData);
          break;
        default:
          console.log(`[HCS Indexer] Unknown message type: ${parsedData.type}`);
      }

    } catch (error) {
      console.error(`[HCS Indexer] Error processing message ${message.sequenceNumber}:`, error);
    }
  }

  /**
   * Index HCS message to database
   */
  private async indexHCSMessage(message: HCSMessage, parsedData: any): Promise<void> {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('hcs_messages')
      .upsert({
        topic_id: message.topicId,
        sequence_number: parseInt(message.sequenceNumber),
        consensus_timestamp: new Date(message.consensusTimestamp),
        message_type: parsedData.type,
        message_data: parsedData,
        processed: false
      }, {
        onConflict: 'topic_id,sequence_number'
      });
    
    if (error) {
      console.error('[HCS Indexer] Database error:', error);
    }
  }

  /**
   * Process paper submission message
   */
  private async processPaperSubmission(message: HCSMessage, data: any): Promise<void> {
    const supabase = await createClient();
    
    // Update papers table with HCS information
    await supabase
      .from('papers')
      .update({
        hcs_sequence_number: parseInt(message.sequenceNumber),
        ipfs_cid: data.ipfsCid,
        status: 'submitted'
      })
      .eq('submitter_account', data.metadata?.submitterAccount)
      .eq('title', data.metadata?.title);

    console.log(`[HCS Indexer] Processed paper submission: ${data.metadata?.title}`);
  }

  /**
   * Process review submission message
   */
  private async processReviewSubmission(message: HCSMessage, data: any): Promise<void> {
    const supabase = await createClient();
    
    // Update reviews table with HCS information
    await supabase
      .from('reviews')
      .update({
        ipfs_cid: data.ipfsCid,
        submit_tx_id: message.consensusTimestamp
      })
      .eq('reviewer_account', data.metadata?.reviewerAccount)
      .eq('paper_id', data.metadata?.paperId);

    console.log(`[HCS Indexer] Processed review submission for paper: ${data.metadata?.paperId}`);
  }

  /**
   * Process consensus reached message
   */
  private async processConsensusReached(message: HCSMessage, data: any): Promise<void> {
    const supabase = await createClient();
    
    // Update paper status based on consensus
    await supabase
      .from('papers')
      .update({
        consensus_reached: true,
        consensus_verdict: data.approved,
        status: data.approved ? 'published' : 'rejected',
        publication_date: data.approved ? new Date() : null
      })
      .eq('id', data.paperId);

    console.log(`[HCS Indexer] Processed consensus for paper: ${data.paperId}, verdict: ${data.approved}`);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopIndexing();
    this.client.close();
  }
}

/**
 * Smart contract event indexer
 * Monitors contract events and updates database accordingly
 */
export class ContractEventIndexer {
  private client: Client;
  private contractIds: ContractId[];
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastProcessedTimestamp: Date;

  constructor(private config: IndexerConfig) {
    this.client = config.hederaNetwork === 'testnet' 
      ? Client.forTestnet() 
      : Client.forMainnet();
    
    this.contractIds = config.contractAddresses.map(addr => ContractId.fromString(addr));
    this.lastProcessedTimestamp = config.indexingStartTime || new Date();
    
    this.client.setOperator(
      AccountId.fromString(config.operatorAccountId),
      PrivateKey.fromString(config.operatorPrivateKey)
    );
  }

  /**
   * Start indexing contract events
   */
  startIndexing(): void {
    if (this.isRunning) {
      console.log('[Contract Indexer] Already running');
      return;
    }

    console.log('[Contract Indexer] Starting to index smart contract events');
    
    this.isRunning = true;
    this.pollInterval = setInterval(() => {
      this.pollContractEvents();
    }, 10000); // Poll every 10 seconds

    console.log('[Contract Indexer] Successfully started');
  }

  /**
   * Stop indexing
   */
  stopIndexing(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log('[Contract Indexer] Stopped');
  }

  /**
   * Poll for new contract events
   */
  private async pollContractEvents(): Promise<void> {
    try {
      // Note: Actual Hedera event querying would use mirror node REST API
      // This is a simplified version showing the structure
      
      for (const contractId of this.contractIds) {
        await this.queryContractEvents(contractId);
      }

    } catch (error) {
      console.error('[Contract Indexer] Error polling events:', error);
    }
  }

  /**
   * Query events for a specific contract
   */
  private async queryContractEvents(contractId: ContractId): Promise<void> {
    // Implementation would use Hedera Mirror Node REST API
    // to query contract logs and events
    console.log(`[Contract Indexer] Querying events for contract: ${contractId.toString()}`);
    
    // Example of processing different event types:
    // - PaperSubmitted
    // - ReviewClaimed  
    // - ReviewSubmitted
    // - ConsensusReached
    // - RewardsDistributed
    // - StakeSlashed
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopIndexing();
    this.client.close();
  }
}

/**
 * Main blockchain indexer orchestrating HCS and contract indexing
 */
export class BlockchainIndexer {
  private hcsIndexer: HCSIndexer;
  private contractIndexer: ContractEventIndexer;
  private isRunning = false;

  constructor(private config: IndexerConfig) {
    this.hcsIndexer = new HCSIndexer(config);
    this.contractIndexer = new ContractEventIndexer(config);
  }

  /**
   * Start all indexing services
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Blockchain Indexer] Already running');
      return;
    }

    console.log('[Blockchain Indexer] Starting blockchain indexing services...');

    try {
      await this.hcsIndexer.startIndexing();
      this.contractIndexer.startIndexing();
      
      this.isRunning = true;
      console.log('[Blockchain Indexer] Successfully started all services');
    } catch (error) {
      console.error('[Blockchain Indexer] Failed to start:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop all indexing services
   */
  async stop(): Promise<void> {
    console.log('[Blockchain Indexer] Stopping all services...');
    
    this.hcsIndexer.stopIndexing();
    this.contractIndexer.stopIndexing();
    
    this.isRunning = false;
    console.log('[Blockchain Indexer] Stopped all services');
  }

  /**
   * Get indexer status
   */
  getStatus(): {
    isRunning: boolean;
    hcsTopicId: string;
    contractAddresses: string[];
  } {
    return {
      isRunning: this.isRunning,
      hcsTopicId: this.config.hcsTopicId,
      contractAddresses: this.config.contractAddresses
    };
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    this.hcsIndexer.cleanup();
    this.contractIndexer.cleanup();
  }
}

/**
 * Cache management for blockchain data
 */
export class BlockchainCache {
  /**
   * Update reputation cache from on-chain data
   */
  static async updateReputationCache(accountId: string, reputation: number): Promise<void> {
    const supabase = await createClient();
    
    await supabase
      .from('reputation_cache')
      .upsert({
        hedera_account_id: accountId,
        on_chain_reputation: reputation,
        last_updated: new Date()
      }, {
        onConflict: 'hedera_account_id'
      });
  }

  /**
   * Update wallet cache from on-chain data
   */
  static async updateWalletCache(
    accountId: string, 
    hbarBalance: string, 
    paperTokenBalance: string,
    stakedAmount: string
  ): Promise<void> {
    const supabase = await createClient();
    
    await supabase
      .from('wallet_cache')
      .upsert({
        hedera_account_id: accountId,
        hbar_balance: parseFloat(hbarBalance),
        paper_token_balance: parseFloat(paperTokenBalance),
        staked_amount: parseFloat(stakedAmount),
        available_balance: parseFloat(hbarBalance) - parseFloat(stakedAmount),
        last_sync: new Date()
      }, {
        onConflict: 'hedera_account_id'
      });
  }

  /**
   * Record transaction in audit trail
   */
  static async recordTransaction(
    transactionId: string,
    type: string,
    accountId: string,
    amount?: number,
    paperId?: string,
    reviewId?: string
  ): Promise<void> {
    const supabase = await createClient();
    
    await supabase
      .from('hedera_tx_records')
      .insert({
        transaction_id: transactionId,
        transaction_type: type,
        hedera_account_id: accountId,
        amount_hbar: amount,
        paper_id: paperId,
        review_id: reviewId,
        status: 'success',
        created_at: new Date()
      });
  }
}

// Environment configuration helper
export function createIndexerFromEnv(): BlockchainIndexer {
  const config: IndexerConfig = {
    hederaNetwork: process.env.HEDERA_NETWORK as 'testnet' | 'mainnet' || 'testnet',
    hcsTopicId: process.env.HCS_TOPIC_ID!,
    contractAddresses: process.env.CONTRACT_ADDRESSES?.split(',') || [],
    operatorAccountId: process.env.HEDERA_OPERATOR_ACCOUNT_ID!,
    operatorPrivateKey: process.env.HEDERA_OPERATOR_PRIVATE_KEY!,
    indexingStartTime: process.env.INDEXING_START_TIME 
      ? new Date(process.env.INDEXING_START_TIME) 
      : undefined
  };

  return new BlockchainIndexer(config);
}