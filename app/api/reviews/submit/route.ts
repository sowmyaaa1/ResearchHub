import { createClient } from "@/lib/supabase/server";
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
      noveltyScore,
      technicalCorrectnessScore,
      clarityScore,
      significanceScore,
      recommendation,
      comments,
    } = await request.json();

    const rewardAmount = 5; // 5 HBAR reward per review
    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;

    const { error: reviewError } = await supabase
      .from("review_submissions")
      .insert({
        assignment_id: assignmentId,
        reviewer_id: user.id,
        submission_id: submissionId,
        novelty_score: noveltyScore,
        technical_correctness_score: technicalCorrectnessScore,
        clarity_score: clarityScore,
        significance_score: significanceScore,
        recommendation,
        comments,
        reward_amount: rewardAmount,
        reward_tx_hash: txHash,
        status: "rewarded",
      });

    if (reviewError) throw reviewError;

    // Record reward transaction
    const { error: txError } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: user.id,
        tx_hash: txHash,
        type: "reward",
        amount: rewardAmount,
      });

    if (txError) throw txError;

    // Update assignment status
    const { error: assignError } = await supabase
      .from("review_assignments")
      .update({ status: "completed" })
      .eq("id", assignmentId);

    if (assignError) throw assignError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    );
  }
}
