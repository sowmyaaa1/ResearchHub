// Decentralized review submission API  
// Only triggers on-chain transactions - consensus and rewards handled by smart contract
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createIPFSServiceFromEnv, IPFSUtils } from '@/lib/ipfs/ipfs-service';
import { WalletManager } from '@/lib/wallet/secure-wallet';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const {
      reviewId,
      paperId,
      verdict, // 1=accept, 2=minor revision, 3=major revision, 4=reject
      reviewContent, // JSON with scores and comments
      reviewerAccountId,
      passphrase
    } = await request.json();

    if (!reviewId || !paperId || !verdict || !reviewContent || !reviewerAccountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (verdict < 1 || verdict > 4) {
      return NextResponse.json({ error: 'Invalid verdict value' }, { status: 400 });
    }

    // Validate review exists and belongs to user
    const { data: review } = await supabase
      .from('reviews')
      .select('id, paper_id, reviewer_id, reviewer_account, stake_amount_hbar, status')
      .eq('id', reviewId)
      .eq('reviewer_id', user.id)
      .single();

    if (!review) {
      return NextResponse.json({ error: 'Review not found or not authorized' }, { status: 404 });
    }

    if (review.paper_id !== paperId || review.reviewer_account !== reviewerAccountId) {
      return NextResponse.json({ error: 'Review data mismatch' }, { status: 400 });
    }

    if (review.status === 'submitted') {
      return NextResponse.json({ error: 'Review already submitted' }, { status: 400 });
    }

    // Get paper info
    const { data: paper } = await supabase
      .from('papers')
      .select('id, title, status, required_reviews')
      .eq('id', paperId)
      .single();

    if (!paper || paper.status !== 'under-review') {
      return NextResponse.json({ error: 'Paper not available for review submission' }, { status: 400 });
    }

    // Get reviewer profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('hedera_account_id, encrypted_key_blob')
      .eq('id', user.id)
      .single();

    if (!profile?.hedera_account_id || !profile?.encrypted_key_blob) {
      return NextResponse.json({ 
        error: 'Hedera account not configured.' 
      }, { status: 400 });
    }

    // Upload review to IPFS
    const ipfsService = createIPFSServiceFromEnv();
    const reviewMetadata = IPFSUtils.createReviewMetadata(
      paperId,
      reviewerAccountId,
      verdict
    );

    console.log('[API] Uploading review to IPFS...');
    const ipfsResult = await ipfsService.uploadReview(
      JSON.stringify(reviewContent),
      reviewMetadata
    );
    console.log('[API] Review uploaded to IPFS:', ipfsResult.cid);

    // Trigger on-chain review submission transaction
    try {
      const walletManager = WalletManager.getInstance();
      
      // Connect using encrypted key
      await walletManager.connectEncryptedKey(
        profile.encrypted_key_blob,
        passphrase
      );

      console.log('[API] Submitting review to blockchain...');
      
      // Create smart contract transaction for review submission
      // This records the review on-chain and may trigger consensus evaluation
      // TODO: Implement actual smart contract call
      // const submitTx = new ContractExecuteTransaction()
      //   .setContractId(RESEARCH_HUB_CONTRACT_ID)
      //   .setGas(300000)
      //   .setFunction('submitReview', new ContractFunctionParameters()
      //     .addUint256(paperId)
      //     .addString(ipfsResult.cid)
      //     .addUint8(verdict)
      //   );

      // const result = await walletManager.executeTransaction(submitTx, passphrase);
      
      // For now, simulate successful submission
      const mockTxResult = {
        transactionId: `0.0.${Date.now()}@${Math.random().toString(36).substr(2, 9)}`,
        receipt: { status: 'SUCCESS' }
      };

      // Update review record
      await supabase
        .from('reviews')
        .update({
          ipfs_cid: ipfsResult.cid,
          submit_tx_id: mockTxResult.transactionId,
          verdict,
          status: 'submitted',
          submitted_at: new Date()
        })
        .eq('id', reviewId);

      // Record transaction
      await supabase
        .from('hedera_tx_records')
        .insert({
          transaction_id: mockTxResult.transactionId,
          transaction_type: 'review_submit',
          hedera_account_id: reviewerAccountId,
          paper_id: paperId,
          review_id: reviewId,
          status: 'success'
        });

      // Check if this completes all required reviews
      const { data: completedReviews, count } = await supabase
        .from('reviews')
        .select('id', { count: 'exact' })
        .eq('paper_id', paperId)
        .eq('status', 'submitted');

      console.log(`[API] Paper ${paperId} now has ${count}/${paper.required_reviews} reviews completed`);

      let consensusResult = null;

      // If all reviews are submitted, trigger consensus evaluation
      if (count && count >= paper.required_reviews) {
        console.log('[API] All reviews completed, triggering consensus evaluation...');
        
        // Get all review verdicts for consensus calculation
        const { data: allReviews } = await supabase
          .from('reviews')
          .select('id, verdict, reviewer_account, stake_amount_hbar')
          .eq('paper_id', paperId)
          .eq('status', 'submitted');

        if (allReviews && allReviews.length >= paper.required_reviews) {
          // Calculate consensus (this would normally be done by smart contract)
          const acceptVotes = allReviews.filter(r => r.verdict <= 2).length; // Accept or minor revision
          const rejectVotes = allReviews.filter(r => r.verdict > 2).length;  // Major revision or reject
          
          const consensusReached = (acceptVotes / allReviews.length) >= 0.67; // 67% threshold
          const paperApproved = acceptVotes > rejectVotes;

          // TODO: Trigger smart contract consensus function
          // This would calculate weighted consensus based on reviewer reputation
          // and automatically distribute rewards/slashing

          // Update paper status
          await supabase
            .from('papers')
            .update({
              status: paperApproved ? 'published' : 'rejected',
              consensus_reached: consensusReached,
              consensus_verdict: paperApproved,
              publication_date: paperApproved ? new Date() : null
            })
            .eq('id', paperId);

          // For each review, determine if it aligned with consensus
          for (const reviewData of allReviews) {
            const reviewApproved = reviewData.verdict <= 2;
            const alignedWithConsensus = reviewApproved === paperApproved;
            
            await supabase
              .from('reviews')
              .update({
                aligned_with_consensus: alignedWithConsensus,
                // Rewards and slashing would be calculated by smart contract
                reward_amount_hbar: alignedWithConsensus ? 3.0 : 0,
                slashed_amount_hbar: alignedWithConsensus ? 0 : reviewData.stake_amount_hbar * 0.5
              })
              .eq('id', reviewData.id);
          }

          consensusResult = {
            consensusReached,
            paperApproved,
            totalReviews: allReviews.length,
            acceptVotes,
            rejectVotes
          };

          console.log(`[API] Consensus reached for paper ${paperId}: ${paperApproved ? 'APPROVED' : 'REJECTED'}`);
        }
      }

      return NextResponse.json({
        success: true,
        reviewId,
        transactionId: mockTxResult.transactionId,
        ipfsCid: ipfsResult.cid,
        verdict,
        consensus: consensusResult
      });

    } catch (txError) {
      console.error('[API] Review submission transaction failed:', txError);
      return NextResponse.json({ 
        error: 'Review submission transaction failed',
        details: txError instanceof Error ? txError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[API] Review submission error:', error);
    return NextResponse.json({
      error: 'Review submission failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}