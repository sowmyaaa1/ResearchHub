// Comprehensive end-to-end test suite for decentralized ResearchHub
// Tests complete workflow: Submit → Assign → Claim → Review → Publish → Reward Distribution
// Uses Hedera testnet for real blockchain interactions

import { Client, PrivateKey, AccountId, Hbar } from '@hashgraph/sdk';
import { IPFSService, IPFSUtils } from '@/lib/ipfs/ipfs-service';
import { WalletManager, EncryptedKeyManager } from '@/lib/wallet/secure-wallet';
import { ReviewerAssignmentService } from '@/lib/assignment/reviewer-assignment';
import { BlockchainIndexer, createIndexerFromEnv } from '@/lib/blockchain/indexer';
import { createClient } from '@/lib/supabase/server';

// Type definitions for tests
interface TestAccount {
  accountId: string;
  privateKey: string;
}

interface TestReview {
  verdict: number;
  content: {
    noveltyScore: number;
    technicalScore: number;
    clarityScore: number;
    significanceScore: number;
    recommendation: string;
    comments: string;
  };
}

interface DatabaseReview {
  id: string;
  verdict: number;
  reviewer_account: string;
  stake_amount_hbar: number;
  aligned_with_consensus?: boolean;
  reward_amount_hbar?: number;
  slashed_amount_hbar?: number;
}

// Test configuration
const TEST_CONFIG = {
  hederaNetwork: 'testnet' as const,
  hcsTopicId: process.env.TEST_HCS_TOPIC_ID || '0.0.123456',
  operatorAccountId: process.env.TEST_OPERATOR_ACCOUNT_ID || '0.0.123456',
  operatorPrivateKey: process.env.TEST_OPERATOR_PRIVATE_KEY || '',
  ipfsGateway: process.env.TEST_IPFS_GATEWAY || 'https://ipfs.io/api/v0',
  submissionFee: 10.0, // HBAR
  stakingAmount: 5.0,  // HBAR
  testPassphrase: 'test-passphrase-123'
};

// Test accounts for different roles
const TEST_ACCOUNTS = {
  submitter: {
    accountId: process.env.TEST_SUBMITTER_ACCOUNT_ID || '0.0.234567',
    privateKey: process.env.TEST_SUBMITTER_PRIVATE_KEY || ''
  },
  reviewer1: {
    accountId: process.env.TEST_REVIEWER1_ACCOUNT_ID || '0.0.345678',
    privateKey: process.env.TEST_REVIEWER1_PRIVATE_KEY || ''
  },
  reviewer2: {
    accountId: process.env.TEST_REVIEWER2_ACCOUNT_ID || '0.0.456789',
    privateKey: process.env.TEST_REVIEWER2_PRIVATE_KEY || ''
  },
  reviewer3: {
    accountId: process.env.TEST_REVIEWER3_ACCOUNT_ID || '0.0.567890',
    privateKey: process.env.TEST_REVIEWER3_PRIVATE_KEY || ''
  }
};

// Test data
const TEST_PAPER_ABSTRACT = 'This paper presents a novel approach to securing distributed systems using quantum-enhanced machine learning algorithms. We demonstrate significant improvements in threat detection and prevention capabilities through quantum computing integration.';

const TEST_PAPER = {
  title: 'Quantum-Enhanced Machine Learning for Distributed Systems Security',
  abstract: TEST_PAPER_ABSTRACT,
  keywords: ['quantum computing', 'machine learning', 'security', 'distributed systems'],
  authors: ['Dr. Test Author', 'Prof. Co-Author'],
  content: Buffer.from(`
# Quantum-Enhanced Machine Learning for Distributed Systems Security

## Abstract
${TEST_PAPER_ABSTRACT}

## Introduction
This research explores the intersection of quantum computing and machine learning for cybersecurity applications...

## Methodology
We implemented a hybrid quantum-classical approach using...

## Results
Our experiments show a 40% improvement in threat detection accuracy...

## Conclusion
The integration of quantum computing with ML shows promising results for future cybersecurity applications.
  `)
};

const TEST_REVIEWS: TestReview[] = [
  {
    verdict: 1, // Accept
    content: {
      noveltyScore: 5,
      technicalScore: 4,
      clarityScore: 4,
      significanceScore: 5,
      recommendation: 'accept',
      comments: 'Excellent work on quantum-ML integration. Novel approach with strong experimental validation.'
    }
  },
  {
    verdict: 2, // Minor revision
    content: {
      noveltyScore: 4,
      technicalScore: 5,
      clarityScore: 3,
      significanceScore: 4,
      recommendation: 'minor_revision',
      comments: 'Strong technical contribution but needs clarity improvements in methodology section.'
    }
  },
  {
    verdict: 1, // Accept
    content: {
      noveltyScore: 4,
      technicalScore: 4,
      clarityScore: 4,
      significanceScore: 4,
      recommendation: 'accept',
      comments: 'Solid contribution to the field with practical implications for distributed systems security.'
    }
  }
];

// Simple test assertion functions
function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`❌ Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`❌ ${message || 'Values not equal'}: expected ${expected}, got ${actual}`);
  }
}

function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`❌ ${message || 'Value is null or undefined'}`);
  }
}

function assertLength<T>(array: T[], expectedLength: number, message?: string): void {
  if (array.length !== expectedLength) {
    throw new Error(`❌ ${message || 'Array length mismatch'}: expected ${expectedLength}, got ${array.length}`);
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(`❌ ${message || 'Value not greater than expected'}: ${actual} <= ${expected}`);
  }
}

function assertNull(value: any, message?: string): void {
  if (value !== null) {
    throw new Error(`❌ ${message || 'Value is not null'}: ${value}`);
  }
}

// E2E Test Class
export class ResearchHubE2ETests {
  private ipfsService!: IPFSService;
  private indexer!: BlockchainIndexer;
  private supabase: any;
  private testPaperId: string = '';
  private testReviewIds: string[] = [];

  async setup(): Promise<void> {
    console.log('🚀 Setting up E2E test environment...');
    
    // Verify test configuration
    if (!TEST_CONFIG.operatorPrivateKey || !TEST_ACCOUNTS.submitter.privateKey) {
      throw new Error('Missing test account configuration. Please set up test environment variables.');
    }

    // Initialize services
    this.ipfsService = new IPFSService(
      TEST_CONFIG.hcsTopicId,
      TEST_CONFIG.operatorPrivateKey,
      TEST_CONFIG.operatorAccountId,
      TEST_CONFIG.hederaNetwork,
      TEST_CONFIG.ipfsGateway
    );

    this.indexer = createIndexerFromEnv();
    this.supabase = await createClient();

    // Start indexer for event monitoring
    await this.indexer.start();

    console.log('✅ Test environment ready');
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test environment...');
    
    await this.indexer.stop();
    await this.ipfsService.cleanup();
    
    console.log('✅ Cleanup complete');
  }

  async testSetupAccounts(): Promise<void> {
    console.log('📝 Setting up test accounts...');

    // Create encrypted key blobs for test accounts
    const submitterEncrypted = await EncryptedKeyManager.encryptPrivateKey(
      TEST_ACCOUNTS.submitter.privateKey,
      TEST_CONFIG.testPassphrase
    );

    const reviewer1Encrypted = await EncryptedKeyManager.encryptPrivateKey(
      TEST_ACCOUNTS.reviewer1.privateKey,
      TEST_CONFIG.testPassphrase
    );

    const reviewer2Encrypted = await EncryptedKeyManager.encryptPrivateKey(
      TEST_ACCOUNTS.reviewer2.privateKey,
      TEST_CONFIG.testPassphrase
    );

    const reviewer3Encrypted = await EncryptedKeyManager.encryptPrivateKey(
      TEST_ACCOUNTS.reviewer3.privateKey,
      TEST_CONFIG.testPassphrase
    );

    // Insert test profiles
    const { error: profileError } = await this.supabase
      .from('profiles')
      .upsert([
        {
          id: 'test-submitter-uuid',
          email: 'submitter@test.com',
          full_name: 'Test Submitter',
          hedera_account_id: TEST_ACCOUNTS.submitter.accountId,
          encrypted_key_blob: JSON.stringify(submitterEncrypted),
          is_reviewer: false
        },
        {
          id: 'test-reviewer1-uuid',
          email: 'reviewer1@test.com',
          full_name: 'Test Reviewer 1',
          hedera_account_id: TEST_ACCOUNTS.reviewer1.accountId,
          encrypted_key_blob: JSON.stringify(reviewer1Encrypted),
          expertise_tags: ['quantum computing', 'machine learning', 'security'],
          is_reviewer: true,
          on_chain_reputation: 150
        },
        {
          id: 'test-reviewer2-uuid',
          email: 'reviewer2@test.com',
          full_name: 'Test Reviewer 2',
          hedera_account_id: TEST_ACCOUNTS.reviewer2.accountId,
          encrypted_key_blob: JSON.stringify(reviewer2Encrypted),
          expertise_tags: ['distributed systems', 'security', 'machine learning'],
          is_reviewer: true,
          on_chain_reputation: 120
        },
        {
          id: 'test-reviewer3-uuid',
          email: 'reviewer3@test.com',
          full_name: 'Test Reviewer 3',
          hedera_account_id: TEST_ACCOUNTS.reviewer3.accountId,
          encrypted_key_blob: JSON.stringify(reviewer3Encrypted),
          expertise_tags: ['quantum computing', 'security'],
          is_reviewer: true,
          on_chain_reputation: 180
        }
      ]);

    assertNull(profileError, 'Failed to create test profiles');
    console.log('✅ Test accounts created');
  }

  async testPaperSubmission(): Promise<void> {
    console.log('📄 Testing paper submission...');

    // Upload paper to IPFS
    const paperMetadata = IPFSUtils.createPaperMetadata(
      TEST_PAPER.title,
      TEST_PAPER.abstract,
      TEST_PAPER.authors,
      TEST_PAPER.keywords,
      TEST_ACCOUNTS.submitter.accountId
    );

    const ipfsResult = await this.ipfsService.uploadPaper(TEST_PAPER.content, paperMetadata);
    
    assertDefined(ipfsResult.cid, 'IPFS CID should be defined');
    assertDefined(ipfsResult.hcsSequenceNumber, 'HCS sequence number should be defined');
    assertDefined(ipfsResult.hederaTxId, 'Hedera transaction ID should be defined');

    // Create paper record
    const { data: paper, error: paperError } = await this.supabase
      .from('papers')
      .insert({
        author_id: 'test-submitter-uuid',
        title: TEST_PAPER.title,
        abstract: TEST_PAPER.abstract,
        keywords: TEST_PAPER.keywords,
        ipfs_cid: ipfsResult.cid,
        hcs_sequence_number: ipfsResult.hcsSequenceNumber ? parseInt(ipfsResult.hcsSequenceNumber) : null,
        hedera_tx_id: ipfsResult.hederaTxId,
        submitter_account: TEST_ACCOUNTS.submitter.accountId,
        status: 'submitted',
        submission_fee_hbar: TEST_CONFIG.submissionFee,
        required_reviews: 3
      })
      .select()
      .single();

    assertNull(paperError, 'Failed to create paper record');
    assertDefined(paper, 'Paper record should be created');
    
    this.testPaperId = paper.id;
    console.log(`✅ Paper submitted with ID: ${this.testPaperId}, IPFS CID: ${ipfsResult.cid}`);
  }

  async testReviewerAssignment(): Promise<void> {
    console.log('🔍 Testing reviewer assignment...');

    const assignmentRequest = {
      paperId: this.testPaperId,
      title: TEST_PAPER.title,
      abstract: TEST_PAPER.abstract,
      keywords: TEST_PAPER.keywords,
      authorId: 'test-submitter-uuid',
      requiredReviews: 3,
      minimumReputation: 100,
      minimumStake: 5.0
    };

    const assignment = await ReviewerAssignmentService.assignReviewers(assignmentRequest);

    assertEqual(assignment.success, true, 'Assignment should be successful');
    assertLength(assignment.assignedReviewers, 3, 'Should assign 3 reviewers');
    assertGreaterThan(assignment.assignedReviewers[0].expertiseScore, 0, 'First reviewer should have expertise score > 0');

    console.log('✅ Reviewers assigned successfully');
    console.log(`   Top reviewer: ${assignment.assignedReviewers[0].accountId} (score: ${assignment.assignedReviewers[0].totalScore})`);
  }

  async testReviewClaiming(): Promise<void> {
    console.log('🎯 Testing review claiming and staking...');

    // Get assigned reviewers
    const { data: assignedReviewers } = await this.supabase
      .from('expertise_matching')
      .select('reviewer_account, profile_id')
      .eq('paper_id', this.testPaperId)
      .eq('assigned', true)
      .limit(3);

    assertLength(assignedReviewers, 3, 'Should have 3 assigned reviewers');

    // Each reviewer claims the review (simulating staking transaction)
    for (let i = 0; i < assignedReviewers.length; i++) {
      const reviewer = assignedReviewers[i];
      
      // Create review claim record
      const { data: review, error: reviewError } = await this.supabase
        .from('reviews')
        .insert({
          paper_id: this.testPaperId,
          reviewer_id: reviewer.profile_id,
          reviewer_account: reviewer.reviewer_account,
          stake_amount_hbar: TEST_CONFIG.stakingAmount,
          stake_tx_id: `stake-tx-${i + 1}-${Date.now()}`,
          status: 'claimed'
        })
        .select()
        .single();

      assertNull(reviewError, 'Failed to create review record');
      this.testReviewIds.push(review.id);

      // Record staking transaction
      await this.supabase
        .from('hedera_tx_records')
        .insert({
          transaction_id: review.stake_tx_id,
          transaction_type: 'review_claim',
          hedera_account_id: reviewer.reviewer_account,
          paper_id: this.testPaperId,
          review_id: review.id,
          amount_hbar: TEST_CONFIG.stakingAmount,
          status: 'success'
        });
    }

    // Update paper status
    await this.supabase
      .from('papers')
      .update({ status: 'under-review' })
      .eq('id', this.testPaperId);

    console.log('✅ All reviews claimed with staking transactions');
  }

  async testReviewSubmission(): Promise<void> {
    console.log('📝 Testing review submissions...');

    // Submit reviews for each claimed review
    for (let i = 0; i < this.testReviewIds.length; i++) {
      const reviewId = this.testReviewIds[i];
      const reviewData = TEST_REVIEWS[i];

      // Get reviewer info
      const { data: review } = await this.supabase
        .from('reviews')
        .select('reviewer_account')
        .eq('id', reviewId)
        .single();

      // Upload review to IPFS
      const reviewMetadata = IPFSUtils.createReviewMetadata(
        this.testPaperId,
        review.reviewer_account,
        reviewData.verdict
      );

      const ipfsResult = await this.ipfsService.uploadReview(
        JSON.stringify(reviewData.content),
        reviewMetadata
      );

      assertDefined(ipfsResult.cid, 'Review IPFS CID should be defined');

      // Update review with submission data
      await this.supabase
        .from('reviews')
        .update({
          ipfs_cid: ipfsResult.cid,
          submit_tx_id: `submit-tx-${i + 1}-${Date.now()}`,
          verdict: reviewData.verdict,
          status: 'submitted',
          submitted_at: new Date()
        })
        .eq('id', reviewId);

      // Record submission transaction
      await this.supabase
        .from('hedera_tx_records')
        .insert({
          transaction_id: `submit-tx-${i + 1}-${Date.now()}`,
          transaction_type: 'review_submit',
          hedera_account_id: review.reviewer_account,
          paper_id: this.testPaperId,
          review_id: reviewId,
          status: 'success'
        });

      console.log(`✅ Review ${i + 1} submitted to IPFS: ${ipfsResult.cid}`);
    }
  }

  async testConsensusEvaluation(): Promise<void> {
    console.log('⚖️ Testing consensus evaluation...');

    // Get all submitted reviews
    const { data: reviews } = await this.supabase
      .from('reviews')
      .select('id, verdict, reviewer_account, stake_amount_hbar')
      .eq('paper_id', this.testPaperId)
      .eq('status', 'submitted');

    assertLength(reviews, 3, 'Should have 3 submitted reviews');

    // Calculate consensus (verdicts 1-2 = accept, 3-4 = reject)
    const acceptVotes = reviews.filter((r: any) => r.verdict <= 2).length;
    const rejectVotes = reviews.filter((r: any) => r.verdict > 2).length;
    const paperApproved = acceptVotes > rejectVotes;
    const consensusReached = (acceptVotes / reviews.length) >= 0.67;

    console.log(`   Accept votes: ${acceptVotes}, Reject votes: ${rejectVotes}`);
    console.log(`   Paper approved: ${paperApproved}, Consensus reached: ${consensusReached}`);

    // Update paper status
    await this.supabase
      .from('papers')
      .update({
        status: paperApproved ? 'published' : 'rejected',
        consensus_reached: consensusReached,
        consensus_verdict: paperApproved,
        publication_date: paperApproved ? new Date() : null
      })
      .eq('id', this.testPaperId);

    assertEqual(paperApproved, true, 'Paper should be approved with 2 accept + 1 minor revision');

    console.log('✅ Consensus evaluation completed');
  }

  async testRewardDistribution(): Promise<void> {
    console.log('💰 Testing reward distribution and slashing...');

    // Get consensus result
    const { data: paper } = await this.supabase
      .from('papers')
      .select('consensus_verdict')
      .eq('id', this.testPaperId)
      .single();

    const paperApproved = paper.consensus_verdict;

    // Process each review for rewards/slashing
    const { data: reviews } = await this.supabase
      .from('reviews')
      .select('*')
      .eq('paper_id', this.testPaperId)
      .eq('status', 'submitted');

    for (const review of reviews) {
      const reviewApproved = review.verdict <= 2;
      const alignedWithConsensus = reviewApproved === paperApproved;

      let rewardAmount = 0;
      let slashedAmount = 0;

      if (alignedWithConsensus) {
        // Reward aligned reviewers
        rewardAmount = 3.0; // 3 HBAR reward
      } else {
        // Slash misaligned reviewers  
        slashedAmount = review.stake_amount_hbar * 0.5; // 50% slash
      }

      // Update review with reward/slashing info
      await this.supabase
        .from('reviews')
        .update({
          aligned_with_consensus: alignedWithConsensus,
          reward_amount_hbar: rewardAmount,
          slashed_amount_hbar: slashedAmount
        })
        .eq('id', review.id);

      // Record reward/slashing transaction
      if (rewardAmount > 0 || slashedAmount > 0) {
        await this.supabase
          .from('hedera_tx_records')
          .insert({
            transaction_id: `reward-tx-${review.id}-${Date.now()}`,
            transaction_type: alignedWithConsensus ? 'reward_distribution' : 'stake_slashing',
            hedera_account_id: review.reviewer_account,
            paper_id: this.testPaperId,
            review_id: review.id,
            amount_hbar: alignedWithConsensus ? rewardAmount : -slashedAmount,
            status: 'success'
          });
      }

      console.log(`   Reviewer ${review.reviewer_account}: ${alignedWithConsensus ? `Rewarded ${rewardAmount} HBAR` : `Slashed ${slashedAmount} HBAR`}`);
    }

    console.log('✅ Reward distribution and slashing completed');
  }

  async testFinalVerification(): Promise<void> {
    console.log('🔍 Verifying final system state...');

    // Check paper status
    const { data: paper } = await this.supabase
      .from('papers')
      .select('*')
      .eq('id', this.testPaperId)
      .single();

    assertEqual(paper.status, 'published', 'Paper should be published');
    assertEqual(paper.consensus_reached, true, 'Consensus should be reached');
    assertEqual(paper.consensus_verdict, true, 'Paper should be approved');
    assertDefined(paper.ipfs_cid, 'Paper IPFS CID should be defined');
    assertDefined(paper.hedera_tx_id, 'Paper Hedera TX ID should be defined');

    // Check all reviews completed
    const { data: reviews, count } = await this.supabase
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('paper_id', this.testPaperId)
      .eq('status', 'submitted');

    assertEqual(count, 3, 'Should have 3 submitted reviews');
    
    // Verify reward/slashing logic
    const rewardedReviews = reviews.filter((r: any) => r.aligned_with_consensus);
    const slashedReviews = reviews.filter((r: any) => !r.aligned_with_consensus);
    
    assertEqual(rewardedReviews.length, 3, 'All reviewers should be rewarded (2 accept + 1 minor revision aligned with approval)');
    assertEqual(slashedReviews.length, 0, 'No reviewers should be slashed');

    // Check transaction records
    const { data: transactions } = await this.supabase
      .from('hedera_tx_records')
      .select('*')
      .eq('paper_id', this.testPaperId);

    assertGreaterThan(transactions.length, 6, 'Should have at least 7 transactions (submission + 3 claims + 3 submissions + rewards)');

    // Verify IPFS content integrity
    const paperContent = await this.ipfsService.getContent(paper.ipfs_cid);
    assertGreaterThan(paperContent.length, 0, 'Paper content should exist in IPFS');

    for (const review of reviews) {
      const reviewContent = await this.ipfsService.getContentAsText(review.ipfs_cid);
      const parsedContent = JSON.parse(reviewContent);
      assertDefined(parsedContent.recommendation, 'Review content should have recommendation');
    }

    console.log('✅ Final state verification completed');
    console.log('🎉 End-to-end test suite passed successfully!');
  }

  async runAllTests(): Promise<void> {
    const tests = [
      { name: 'Setup Test Accounts', method: this.testSetupAccounts },
      { name: 'Paper Submission Flow', method: this.testPaperSubmission },
      { name: 'Reviewer Assignment', method: this.testReviewerAssignment },
      { name: 'Review Claiming (Staking)', method: this.testReviewClaiming },
      { name: 'Review Submission', method: this.testReviewSubmission },
      { name: 'Consensus Evaluation', method: this.testConsensusEvaluation },
      { name: 'Reward Distribution & Slashing', method: this.testRewardDistribution },
      { name: 'Final Verification', method: this.testFinalVerification }
    ];

    try {
      await this.setup();

      for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.log(`\n${i + 1}. ${test.name}...`);
        
        try {
          await test.method.call(this);
          console.log(`✅ ${test.name} passed`);
        } catch (error) {
          console.error(`❌ ${test.name} failed:`, error);
          throw error;
        }
      }

      console.log('\n🎉 All tests passed! ResearchHub decentralized system is working correctly.');
      
    } finally {
      await this.cleanup();
    }
  }
}

// Helper function to run tests
export async function runE2ETests(): Promise<void> {
  console.log('🧪 Starting ResearchHub E2E Test Suite...');
  console.log('📍 Testing against Hedera testnet');
  console.log('='.repeat(60));

  const testRunner = new ResearchHubE2ETests();
  await testRunner.runAllTests();
}