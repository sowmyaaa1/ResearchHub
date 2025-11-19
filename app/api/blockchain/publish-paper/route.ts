import { createClient } from "@/lib/supabase/server";
import { recordPaperOnBlockchain, transferHbar } from "@/lib/blockchain/hedera";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { paperId, authorAccountId, authorPrivateKey, platformAccountId } = await request.json();

    if (!paperId || !authorAccountId || !authorPrivateKey || !platformAccountId) {
      return NextResponse.json(
        { error: "Paper ID, author account ID, author private key, and platform account ID required" },
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

    const { data: paper, error: paperError } = await supabase
      .from("papers")
      .select("*, profiles:author_id(wallet_address)")
      .eq("id", paperId)
      .eq("author_id", user.id)
      .single();

    if (paperError || !paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    // Record on smart contract
    const blockchainResult = await recordPaperOnBlockchain(
      paperId,
      paper.title,
      paper.profiles?.wallet_address || authorAccountId,
      authorPrivateKey
    );

    // Transfer 10 HBAR from author to platform
    const transferResult = await transferHbar(
      authorAccountId,
      authorPrivateKey,
      platformAccountId,
      10
    );

    const { error: updateError } = await supabase
      .from("papers")
      .update({
        blockchain_hash: blockchainResult.transactionHash,
        status: "published",
        publication_date: new Date().toISOString(),
      })
      .eq("id", paperId);

    if (updateError) throw updateError;

    const { error: verificationError } = await supabase
      .from("blockchain_verifications")
      .insert({
        entity_id: paperId,
        entity_type: "paper",
        transaction_hash: blockchainResult.transactionHash,
        timestamp: new Date(blockchainResult.timestamp),
        verified: blockchainResult.verified,
      });

    if (verificationError) console.error("Verification record error:", verificationError);

    // Automatically create review assignments with status "unassigned"
    // Example: create 3 assignments for demo reviewers (replace with your logic)
    const demoReviewerIds = ["reviewer1", "reviewer2", "reviewer3"];
    for (const reviewerId of demoReviewerIds) {
      await supabase
        .from("review_assignments")
        .insert({
          paper_id: paperId,
          reviewer_id: reviewerId,
          status: "unassigned",
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
    }

    return NextResponse.json({
      success: true,
      transactionHash: blockchainResult.transactionHash,
      hbarTransactionId: transferResult.transactionId,
      hbarStatus: transferResult.status,
      message: "Paper published, verified on blockchain, and HBAR transferred",
    });
  } catch (error) {
    console.error("Blockchain publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish paper" },
      { status: 500 }
    );
  }
}
