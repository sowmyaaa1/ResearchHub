// Expertise-based reviewer assignment algorithm
// Matches papers with qualified reviewers based on expertise and on-chain reputation
// Used for automatic reviewer assignment in decentralized system

import { createClient } from '@/lib/supabase/server';

export interface ReviewerScore {
  accountId: string;
  profileId: string;
  expertiseScore: number;
  reputationScore: number;
  stakingCapacity: number;
  availabilityScore: number;
  totalScore: number;
  matchedExpertiseTags: string[];
  isEligible: boolean;
}

export interface PaperAssignmentRequest {
  paperId: string;
  title: string;
  abstract: string;
  keywords: string[];
  authorId: string;
  requiredReviews: number;
  minimumReputation?: number;
  minimumStake?: number;
  excludeAccounts?: string[];
}

export interface AssignmentResult {
  paperId: string;
  assignedReviewers: ReviewerScore[];
  eligibleReviewers: ReviewerScore[];
  assignmentTimestamp: Date;
  success: boolean;
  reason?: string;
}

/**
 * Expertise matching algorithm using TF-IDF and semantic similarity
 */
export class ExpertiseMatchingEngine {
  private static readonly EXPERTISE_WEIGHT = 0.4;
  private static readonly REPUTATION_WEIGHT = 0.3;
  private static readonly STAKING_WEIGHT = 0.2;
  private static readonly AVAILABILITY_WEIGHT = 0.1;

  /**
   * Calculate expertise similarity between paper keywords and reviewer expertise
   */
  static calculateExpertiseScore(
    paperKeywords: string[],
    reviewerExpertise: string[]
  ): { score: number; matchedTags: string[] } {
    if (!paperKeywords.length || !reviewerExpertise.length) {
      return { score: 0, matchedTags: [] };
    }

    // Normalize keywords to lowercase for comparison
    const normalizedPaperKeywords = paperKeywords.map(k => k.toLowerCase().trim());
    const normalizedReviewerExpertise = reviewerExpertise.map(e => e.toLowerCase().trim());

    // Direct keyword matching
    const directMatches = normalizedPaperKeywords.filter(keyword =>
      normalizedReviewerExpertise.some(expertise =>
        expertise.includes(keyword) || keyword.includes(expertise)
      )
    );

    // Semantic matching for related terms
    const semanticMatches = this.findSemanticMatches(
      normalizedPaperKeywords,
      normalizedReviewerExpertise
    );

    const totalMatches = [...new Set([...directMatches, ...semanticMatches])];
    const matchPercentage = totalMatches.length / normalizedPaperKeywords.length;
    
    // Score calculation: 0-100 based on match percentage and quality
    const baseScore = Math.min(matchPercentage * 100, 100);
    const qualityBonus = directMatches.length * 10; // Bonus for direct matches
    
    return {
      score: Math.min(baseScore + qualityBonus, 100),
      matchedTags: totalMatches
    };
  }

  /**
   * Find semantic matches between keywords using domain knowledge
   */
  private static findSemanticMatches(
    paperKeywords: string[],
    reviewerExpertise: string[]
  ): string[] {
    const semanticMap: { [key: string]: string[] } = {
      'ai': ['artificial intelligence', 'machine learning', 'deep learning', 'neural networks'],
      'machine learning': ['ml', 'ai', 'artificial intelligence', 'data science'],
      'blockchain': ['distributed ledger', 'cryptocurrency', 'smart contracts', 'dlt'],
      'cryptography': ['encryption', 'security', 'crypto', 'privacy'],
      'neural networks': ['deep learning', 'ai', 'machine learning', 'cnn', 'rnn'],
      'computer vision': ['image processing', 'cv', 'object detection', 'image recognition'],
      'nlp': ['natural language processing', 'text mining', 'language models', 'linguistics'],
      'cybersecurity': ['security', 'information security', 'network security', 'cyber'],
      'data science': ['analytics', 'big data', 'data mining', 'statistics'],
      'cloud computing': ['aws', 'azure', 'distributed systems', 'scalability'],
      'iot': ['internet of things', 'embedded systems', 'sensors', 'edge computing'],
      'quantum computing': ['quantum', 'quantum algorithms', 'qubits', 'quantum mechanics']
    };

    const matches: string[] = [];

    for (const keyword of paperKeywords) {
      for (const expertise of reviewerExpertise) {
        // Check if keyword has semantic mappings
        if (semanticMap[keyword]?.includes(expertise)) {
          matches.push(keyword);
        }
        // Check reverse mapping
        if (semanticMap[expertise]?.includes(keyword)) {
          matches.push(keyword);
        }
      }
    }

    return [...new Set(matches)];
  }

  /**
   * Calculate reputation score based on on-chain data
   */
  static calculateReputationScore(reputation: number): number {
    // Normalize reputation to 0-100 scale
    // Assuming reputation starts at 100 and can go up to 1000+
    const minRep = 0;
    const maxRep = 1000;
    const normalizedScore = Math.max(0, Math.min(100, 
      ((reputation - minRep) / (maxRep - minRep)) * 100
    ));
    
    return normalizedScore;
  }

  /**
   * Calculate staking capacity score
   */
  static calculateStakingScore(
    availableBalance: number,
    totalStaked: number,
    minimumStake: number = 5
  ): number {
    const stakingCapacity = availableBalance - totalStaked;
    
    if (stakingCapacity < minimumStake) {
      return 0; // Cannot meet minimum stake requirement
    }

    // Score based on how much above minimum they can stake
    const excessCapacity = stakingCapacity - minimumStake;
    const maxExcess = 100; // Assume 100 HBAR is very high capacity
    
    return Math.min(100, (excessCapacity / maxExcess) * 100);
  }

  /**
   * Calculate availability score based on current workload
   */
  static calculateAvailabilityScore(
    activeReviews: number,
    maxConcurrentReviews: number = 3
  ): number {
    if (activeReviews >= maxConcurrentReviews) {
      return 0; // Fully occupied
    }

    const availabilityRatio = (maxConcurrentReviews - activeReviews) / maxConcurrentReviews;
    return availabilityRatio * 100;
  }

  /**
   * Calculate overall reviewer score
   */
  static calculateOverallScore(
    expertiseScore: number,
    reputationScore: number,
    stakingScore: number,
    availabilityScore: number
  ): number {
    return (
      expertiseScore * this.EXPERTISE_WEIGHT +
      reputationScore * this.REPUTATION_WEIGHT +
      stakingScore * this.STAKING_WEIGHT +
      availabilityScore * this.AVAILABILITY_WEIGHT
    );
  }
}

/**
 * Main reviewer assignment service
 */
export class ReviewerAssignmentService {
  /**
   * Find and assign optimal reviewers for a paper
   */
  static async assignReviewers(request: PaperAssignmentRequest): Promise<AssignmentResult> {
    try {
      console.log(`[Assignment] Finding reviewers for paper: ${request.title}`);

      const supabase = await createClient();

      // Get all eligible reviewers (excluding paper author)
      const { data: reviewers, error } = await supabase
        .from('profiles')
        .select(`
          id,
          hedera_account_id,
          expertise_tags,
          on_chain_reputation,
          is_reviewer
        `)
        .eq('is_reviewer', true)
        .neq('id', request.authorId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!reviewers || reviewers.length === 0) {
        return {
          paperId: request.paperId,
          assignedReviewers: [],
          eligibleReviewers: [],
          assignmentTimestamp: new Date(),
          success: false,
          reason: 'No eligible reviewers found'
        };
      }

      // Get cached wallet and reputation data
      const accountIds = reviewers.map(r => r.hedera_account_id).filter(Boolean);
      
      const { data: walletCache } = await supabase
        .from('wallet_cache')
        .select('*')
        .in('hedera_account_id', accountIds);

      const { data: reputationCache } = await supabase
        .from('reputation_cache')
        .select('*')
        .in('hedera_account_id', accountIds);

      // Get current active review counts
      const { data: activeReviewCounts } = await supabase
        .rpc('get_active_review_counts', { reviewer_ids: reviewers.map(r => r.id) });

      // Score each reviewer
      const scoredReviewers: ReviewerScore[] = await Promise.all(
        reviewers.map(async reviewer => {
          const walletInfo = walletCache?.find(w => w.hedera_account_id === reviewer.hedera_account_id);
          const reputationInfo = reputationCache?.find(r => r.hedera_account_id === reviewer.hedera_account_id);
          const activeReviews = activeReviewCounts?.find((c: any) => c.reviewer_id === reviewer.id)?.count || 0;

          // Calculate individual scores
          const expertiseResult = ExpertiseMatchingEngine.calculateExpertiseScore(
            request.keywords,
            reviewer.expertise_tags || []
          );

          const reputationScore = ExpertiseMatchingEngine.calculateReputationScore(
            reviewer.on_chain_reputation || 100
          );

          const stakingScore = ExpertiseMatchingEngine.calculateStakingScore(
            walletInfo?.available_balance || 0,
            walletInfo?.staked_amount || 0,
            request.minimumStake
          );

          const availabilityScore = ExpertiseMatchingEngine.calculateAvailabilityScore(activeReviews);

          const totalScore = ExpertiseMatchingEngine.calculateOverallScore(
            expertiseResult.score,
            reputationScore,
            stakingScore,
            availabilityScore
          );

          // Check eligibility criteria
          const isEligible = this.checkEligibility(reviewer, request, {
            expertiseScore: expertiseResult.score,
            reputationScore,
            stakingScore,
            availabilityScore
          });

          return {
            accountId: reviewer.hedera_account_id,
            profileId: reviewer.id,
            expertiseScore: expertiseResult.score,
            reputationScore,
            stakingCapacity: stakingScore,
            availabilityScore,
            totalScore,
            matchedExpertiseTags: expertiseResult.matchedTags,
            isEligible
          };
        })
      );

      // Filter eligible reviewers and sort by score
      const eligibleReviewers = scoredReviewers
        .filter(r => r.isEligible)
        .sort((a, b) => b.totalScore - a.totalScore);

      // Select top reviewers for assignment
      const selectedReviewers = eligibleReviewers.slice(0, request.requiredReviews);

      if (selectedReviewers.length < request.requiredReviews) {
        return {
          paperId: request.paperId,
          assignedReviewers: selectedReviewers,
          eligibleReviewers,
          assignmentTimestamp: new Date(),
          success: false,
          reason: `Only ${selectedReviewers.length} eligible reviewers found, need ${request.requiredReviews}`
        };
      }

      // Store assignment in expertise_matching table  
      await this.storeAssignmentScores(request.paperId, scoredReviewers);
      
      // Mark selected reviewers as assigned
      await this.markSelectedReviewersAssigned(request.paperId, selectedReviewers);

      console.log(`[Assignment] Successfully assigned ${selectedReviewers.length} reviewers to paper ${request.paperId}`);

      return {
        paperId: request.paperId,
        assignedReviewers: selectedReviewers,
        eligibleReviewers,
        assignmentTimestamp: new Date(),
        success: true
      };

    } catch (error) {
      console.error('[Assignment] Error assigning reviewers:', error);
      return {
        paperId: request.paperId,
        assignedReviewers: [],
        eligibleReviewers: [],
        assignmentTimestamp: new Date(),
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if reviewer meets eligibility criteria
   */
  private static checkEligibility(
    reviewer: any,
    request: PaperAssignmentRequest,
    scores: {
      expertiseScore: number;
      reputationScore: number;
      stakingScore: number;
      availabilityScore: number;
    }
  ): boolean {
    // Minimum expertise requirement
    if (scores.expertiseScore < 20) return false;

    // Minimum reputation requirement
    if (request.minimumReputation && scores.reputationScore < request.minimumReputation) return false;

    // Minimum staking capacity
    if (scores.stakingScore === 0) return false;

    // Must be available
    if (scores.availabilityScore === 0) return false;

    // Not in exclusion list
    if (request.excludeAccounts?.includes(reviewer.hedera_account_id)) return false;

    return true;
  }

  /**
   * Store assignment scores in database for audit trail
   */
  private static async storeAssignmentScores(
    paperId: string,
    scoredReviewers: ReviewerScore[]
  ): Promise<void> {
    const supabase = await createClient();

    const assignmentData = scoredReviewers.map((reviewer, index) => ({
      paper_id: paperId,
      reviewer_account: reviewer.accountId,
      profile_id: reviewer.profileId,
      expertise_score: reviewer.expertiseScore,
      reputation_score: reviewer.reputationScore,
      available_stake: reviewer.stakingCapacity,
      assignment_priority: index + 1,
      assigned: index < 3, // Top 3 get assigned
      assigned_at: index < 3 ? new Date() : null
    }));

    await supabase
      .from('expertise_matching')
      .insert(assignmentData);
  }

  /**
   * Get assignment history for a paper
   */
  static async getAssignmentHistory(paperId: string): Promise<any[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('expertise_matching')
      .select(`
        *,
        profiles:profile_id(full_name, hedera_account_id)
      `)
      .eq('paper_id', paperId)
      .order('assignment_priority', { ascending: true });

    if (error) {
      console.error('[Assignment] Error fetching history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Mark selected reviewers as assigned during initial assignment
   */
  private static async markSelectedReviewersAssigned(
    paperId: string,
    selectedReviewers: ReviewerScore[]
  ): Promise<void> {
    const supabase = await createClient();
    
    for (const reviewer of selectedReviewers) {
      await supabase
        .from('expertise_matching')
        .update({
          assigned: true,
          assigned_at: new Date()
        })
        .eq('paper_id', paperId)
        .eq('reviewer_account', reviewer.accountId);
    }
  }

  /**
   * Update assignment when reviewer claims review
   */
  static async markReviewerAssigned(
    paperId: string,
    reviewerAccountId: string
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('expertise_matching')
      .update({
        assigned: true,
        assigned_at: new Date()
      })
      .eq('paper_id', paperId)
      .eq('reviewer_account', reviewerAccountId);
  }
}

// Database function helper (to be added to migration)
export const createActiveReviewCountsFunction = `
CREATE OR REPLACE FUNCTION get_active_review_counts(reviewer_ids UUID[])
RETURNS TABLE(reviewer_id UUID, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ra.reviewer_id,
    COUNT(*)::BIGINT as count
  FROM review_assignments ra
  WHERE ra.reviewer_id = ANY(reviewer_ids)
    AND ra.status IN ('pending', 'accepted', 'in_progress')
  GROUP BY ra.reviewer_id;
END;
$$ LANGUAGE plpgsql;
`;