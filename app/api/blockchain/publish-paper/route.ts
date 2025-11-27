import { createClient } from "@/lib/supabase/server";
import { recordPaperOnBlockchain, transferHbar } from "@/lib/blockchain/hedera";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { paperId, authorAccountId, authorPrivateKey, stakingContractAddress } = await request.json();

    if (!paperId || !authorAccountId || !authorPrivateKey || !stakingContractAddress) {
      return NextResponse.json(
        { error: "Paper ID, author account ID, author private key, and staking contract address required" },
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

    // Transfer 10 HBAR from author to staking contract
    const transferResult = await transferHbar(
      authorAccountId,
      authorPrivateKey,
      stakingContractAddress,
      10
    );

    // Record the wallet transaction
    const { error: transactionError } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: user.id,
        type: "paper_publication_stake",
        amount: -10, // Negative because it's a deduction
        description: `Publication stake for paper: ${paper.title}`,
        timestamp: new Date().toISOString(),
        hbar_transaction_id: transferResult.transactionId,
        hbar_status: transferResult.status
      });

    if (transactionError) {
      console.error("Failed to record wallet transaction:", transactionError);
    }

    // Update user's wallet balance in their profile
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", user.id)
      .single();

    if (currentProfile) {
      const newBalance = (currentProfile.wallet_balance || 0) - 10;
      await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("id", user.id);
    }

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
