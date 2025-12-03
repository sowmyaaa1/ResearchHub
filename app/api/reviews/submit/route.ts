import { createClient } from "@/lib/supabase/server";
import { recordReviewOnBlockchain, transferHbar } from "@/lib/blockchain/hedera";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const {
      assignmentId,
      submissionId,
      paperId,
      noveltyScore,
      technicalCorrectnessScore,
      clarityScore,
      significanceScore,
      recommendation,
      comments
    } = await request.json();

    console.log("[reviews/submit] Received:", {
      assignmentId,
      submissionId,
      paperId,
      noveltyScore,
      technicalCorrectnessScore,
      clarityScore,
      significanceScore,
      recommendation
    });

    // Get reviewer's wallet details
    const { data: reviewerProfile } = await supabase
      .from("profiles")
      .select("wallet_address, private_key")
      .eq("id", user.id)
      .single();

    if (!reviewerProfile?.wallet_address || !reviewerProfile?.private_key) {
      return NextResponse.json(
        { error: "Reviewer wallet not configured. Please set up your wallet in profile." },
        { status: 400 }
      );
    }

    // Platform wallet details - using the staking account for reward distribution
    const PLATFORM_ACCOUNT_ID = "0.0.7281579";
    const PLATFORM_PRIVATE_KEY = "3030020100300706052b8104000a0422042041c6b4b954c336eb0a70bb09439e9f1547d3c794390c814624f6e5eff99125e5";

    let blockchainHash = `mock_tx_${Date.now()}`;
    let transferResult = null;

    // Process real blockchain transactions
    try {
      console.log("[reviews/submit] Processing real blockchain operations...");
      
      // Record review on blockchain
      const reviewResult = await recordReviewOnBlockchain(
        assignmentId,
        paperId,
        reviewerProfile.wallet_address,
        reviewerProfile.private_key
      );
      blockchainHash = reviewResult.transactionHash;
      console.log("[reviews/submit] Review recorded on blockchain:", reviewResult.transactionHash);

      // Transfer 5 HBAR reward from platform to reviewer
      transferResult = await transferHbar(
        PLATFORM_ACCOUNT_ID,
        PLATFORM_PRIVATE_KEY,
        reviewerProfile.wallet_address,
        5 // 5 HBAR reward
      );

      console.log("[reviews/submit] HBAR transfer successful:", {
        transactionId: transferResult.transactionId,
        status: transferResult.status,
        from: PLATFORM_ACCOUNT_ID,
        to: reviewerProfile.wallet_address,
        amount: "5 HBAR"
      });

    } catch (blockchainError) {
      console.error("[reviews/submit] Blockchain operation failed:", blockchainError);
      console.log("[reviews/submit] Continuing with database insertion despite blockchain failure");
    }

    // Insert review submission into database
    const reviewData: any = {
      assignment_id: assignmentId,
      reviewer_id: user.id,
      novelty_score: noveltyScore,
      technical_correctness_score: technicalCorrectnessScore,
      clarity_score: clarityScore,
      significance_score: significanceScore,
      recommendation,
      comments,
      status: "completed",
      reward_amount: 5,
      blockchain_hash: blockchainHash
    };

    // Only add submission_id if it exists (not null)
    if (submissionId) {
      reviewData.submission_id = submissionId;
    }

    console.log("[reviews/submit] Inserting review data:", reviewData);

    const { data: reviewSubmission, error: insertError } = await supabase
      .from("review_submissions")
      .insert(reviewData)
      .select()
      .single();

    if (insertError) {
      console.error("[reviews/submit] Database insertion error:", insertError);
      return NextResponse.json(
        { error: "Failed to submit review", details: insertError.message },
        { status: 500 }
      );
    }

    console.log("[reviews/submit] Review submitted successfully:", reviewSubmission.id);

    // Update assignment status
    const { error: assignError } = await supabase
      .from("review_assignments")
      .update({ status: "completed" })
      .eq("id", assignmentId);

    if (assignError) {
      console.error("[reviews/submit] Assignment update error:", assignError);
    }

    // Check if paper now has enough completed reviews to be published
    console.log("[reviews/submit] Checking if paper meets publication criteria...");
    
    // Get the required number of reviews from assignment rules
    const { data: rules } = await supabase
      .from("review_assignment_rules")
      .select("reviewer_count")
      .single();
    
    const requiredReviews = rules?.reviewer_count || 2;
    
    // Count completed reviews for this paper and get their recommendations
    const { data: completedReviews } = await supabase
      .from("review_assignments")
      .select(`
        id,
        review_submissions!inner(
          id, 
          status, 
          recommendation
        )
      `)
      .eq("paper_id", paperId)
      .eq("status", "completed")
      .eq("review_submissions.status", "completed");
    
    const completedReviewCount = completedReviews?.length || 0;
    console.log(`[reviews/submit] Paper ${paperId}: ${completedReviewCount}/${requiredReviews} reviews completed`);
    
    // Only publish if we have enough completed reviews
    if (completedReviewCount >= requiredReviews) {
      console.log("[reviews/submit] Sufficient reviews completed - checking consensus...");
      
      // Calculate consensus based on recommendations
      const recommendations = completedReviews.map(r => r.review_submissions[0]?.recommendation);
      const acceptCount = recommendations.filter(rec => rec === "accept" || rec === "minor_revisions").length;
      const rejectCount = recommendations.filter(rec => rec === "major_revisions" || rec === "reject").length;
      
      // Require majority acceptance for publication
      const shouldPublish = acceptCount > rejectCount;
      
      console.log(`[reviews/submit] Consensus check: ${acceptCount} accept, ${rejectCount} reject - ${shouldPublish ? 'PUBLISHING' : 'REJECTING'}`);
      
      if (shouldPublish) {
        console.log("[reviews/submit] Publishing paper - sufficient reviews completed with positive consensus");
      if (shouldPublish) {
        console.log("[reviews/submit] Publishing paper - sufficient reviews completed with positive consensus");
        const { error: paperError } = await supabase
          .from("papers")
          .update({ 
            status: "published",
            publication_date: new Date().toISOString()
          })
          .eq("id", paperId);

        if (paperError) {
          console.error("[reviews/submit] Paper publication error:", paperError);
        } else {
          console.log(`[reviews/submit] Paper ${paperId} successfully published`);
          
          // Also update corresponding submission status
          const { error: submissionError } = await supabase
            .from("submissions")
            .update({ 
              status: "published",
              updated_at: new Date().toISOString()
            })
            .eq("paper_id", paperId);

          if (submissionError) {
            console.error("[reviews/submit] Submission status update error:", submissionError);
          } else {
            console.log(`[reviews/submit] Submission for paper ${paperId} status updated to published`);
          }
        }
      } else {
        console.log("[reviews/submit] Rejecting paper - negative consensus");
        const { error: paperError } = await supabase
          .from("papers")
          .update({ 
            status: "rejected",
            updated_at: new Date().toISOString()
          })
          .eq("id", paperId);

        if (paperError) {
          console.error("[reviews/submit] Paper rejection error:", paperError);
        } else {
          console.log(`[reviews/submit] Paper ${paperId} successfully rejected`);
          
          // Also update corresponding submission status
          const { error: submissionError } = await supabase
            .from("submissions")
            .update({ 
              status: "rejected",
              updated_at: new Date().toISOString()
            })
            .eq("paper_id", paperId);

          if (submissionError) {
            console.error("[reviews/submit] Submission status update error:", submissionError);
          } else {
            console.log(`[reviews/submit] Submission for paper ${paperId} status updated to rejected`);
          }
        }
      }
      }
    } else {
      console.log(`[reviews/submit] Paper ${paperId} not published yet - needs ${requiredReviews - completedReviewCount} more reviews`);
    }

    // Record wallet transaction if HBAR transfer was successful
    if (transferResult) {
      const { error: txError } = await supabase
        .from("wallet_transactions")
        .insert({
          user_id: user.id,
          tx_hash: blockchainHash,
          hbar_transaction_id: transferResult.transactionId,
          type: "reward",
          amount: 5,
          hbar_status: transferResult.status,
        });

      if (txError) {
        console.error("[reviews/submit] Transaction record error:", txError);
      } else {
        console.log("[reviews/submit] Wallet transaction recorded");
      }
    }

    return NextResponse.json({
      success: true,
      reviewId: reviewSubmission.id,
      message: "Review submitted successfully",
      hbarTransferred: !!transferResult,
      transactionId: transferResult?.transactionId,
      blockchainHash: blockchainHash
    });
  } catch (error) {
    console.error("[reviews/submit] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit review", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
