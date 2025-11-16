import { createClient } from "@/lib/supabase/server";
import { recordReviewOnBlockchain } from "@/lib/blockchain/hedera";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { reviewId } = await request.json();

    if (!reviewId) {
      return NextResponse.json(
        { error: "Review ID required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("*, profiles:reviewer_id(wallet_address)")
      .eq("id", reviewId)
      .eq("reviewer_id", user.id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404 }
      );
    }

    const blockchainResult = await recordReviewOnBlockchain(
      reviewId,
      review.paper_id,
      review.profiles?.wallet_address || user.id
    );

    const { error: updateError } = await supabase
      .from("reviews")
      .update({
        blockchain_hash: blockchainResult.transactionHash,
      })
      .eq("id", reviewId);

    if (updateError) throw updateError;

    const { error: verificationError } = await supabase
      .from("blockchain_verifications")
      .insert({
        entity_id: reviewId,
        entity_type: "review",
        transaction_hash: blockchainResult.transactionHash,
        timestamp: new Date(blockchainResult.timestamp),
        verified: blockchainResult.verified,
      });

    if (verificationError) console.error("Verification record error:", verificationError);

    return NextResponse.json({
      success: true,
      transactionHash: blockchainResult.transactionHash,
      message: "Review recorded on blockchain",
    });
  } catch (error) {
    console.error("Blockchain review error:", error);
    return NextResponse.json(
      { error: "Failed to record review" },
      { status: 500 }
    );
  }
}
