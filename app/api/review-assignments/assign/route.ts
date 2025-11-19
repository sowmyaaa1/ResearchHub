import { createClient } from "@/lib/supabase/server";
import { claimReviewOnBlockchain } from "@/lib/blockchain/hedera";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  console.log("[assign] POST request received");
  try {
    const body = await request.json();
    console.log("[assign] Request body:", body);
    const { paperId, reviewerIds, dueDate, reviewerPrivateKeys } = body;

    if (!paperId || !reviewerIds || reviewerIds.length === 0 || !reviewerPrivateKeys) {
      console.log("[assign] Missing required parameters");
      return NextResponse.json(
        { error: "Paper ID, reviewer IDs, and reviewer private keys required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const results: any[] = [];
    console.log("[assign] Starting claim process for paper", paperId, "reviewers", reviewerIds);
    for (let i = 0; i < reviewerIds.length; i++) {
      const reviewerId = reviewerIds[i];
      const reviewerPrivateKey = reviewerPrivateKeys[reviewerId];
      if (!reviewerPrivateKey) {
        results.push({ reviewerId, error: "Missing private key" });
        continue;
      }
      try {
        // Convert UUID to stable numeric ID for blockchain (fallback method)
        // Take first 16 hex chars, parse as bigint, mod by large prime for safety
        const uuidHex = paperId.replace(/-/g, '').substring(0, 16);
        console.log("[assign] UUID hex extract:", uuidHex);
        
        let chainPaperId;
        try {
          const bigIntValue = BigInt('0x' + uuidHex);
          chainPaperId = (bigIntValue % BigInt('999999999989')).toString();
        } catch (bigIntError) {
          console.error("[assign] BigInt conversion failed:", bigIntError);
          // Fallback to simple hash
          let hash = 0;
          for (let i = 0; i < uuidHex.length; i++) {
            hash = ((hash << 5) - hash + uuidHex.charCodeAt(i)) & 0xffffffff;
          }
          chainPaperId = Math.abs(hash).toString();
        }
        
        console.log("[assign] Using UUID-derived chain paper id:", chainPaperId, "for UUID:", paperId);
        const blockchainResult = await claimReviewOnBlockchain(
          chainPaperId,
          dueDate || Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
          reviewerId,
          reviewerPrivateKey
        );
        console.log("[assign] Blockchain claim success", { reviewerId, paperId, tx: blockchainResult });
        // Insert or update review assignment row
        const { data: existing, error: existingError } = await supabase
          .from("review_assignments")
          .select("id, status")
          .eq("paper_id", paperId)
          .eq("reviewer_id", reviewerId)
          .maybeSingle();
        if (existingError) {
          console.warn("[assign] Existing assignment lookup error", existingError.message);
        }

        let assignmentId = existing?.id;
        if (!existing) {
          const { data: inserted, error: insertError } = await supabase
            .from("review_assignments")
            .insert({
              paper_id: paperId,
              reviewer_id: reviewerId,
              status: "claimed",
              due_date: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            })
            .select()
            .maybeSingle();
          if (insertError) {
            console.error("[assign] Insert failed", insertError.message);
            results.push({ reviewerId, error: `Blockchain success but DB insert failed: ${insertError.message}` });
            continue;
          }
          assignmentId = inserted?.id;
          console.log("[assign] Inserted assignment", assignmentId);
        } else if (existing.status !== "claimed") {
          const { error: updateError } = await supabase
            .from("review_assignments")
            .update({ status: "claimed" })
            .eq("id", existing.id);
          if (updateError) {
            console.error("[assign] Update failed", updateError.message);
            results.push({ reviewerId, error: `Blockchain success but DB update failed: ${updateError.message}` });
            continue;
          }
          console.log("[assign] Updated existing assignment to claimed", existing.id);
        }
        results.push({ reviewerId, blockchainResult, assignmentId });
      } catch (err) {
        console.error("[assign] Error claiming review", reviewerId, err);
        results.push({ reviewerId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const errors = results.filter(r => r.error);
    if (errors.length === results.length) {
      return NextResponse.json({
        success: false,
        results,
        message: "All reviewer claims failed",
      }, { status: 500 });
    }
    if (errors.length > 0) {
      return NextResponse.json({
        success: true,
        partial: true,
        results,
        message: `Some assignments succeeded (${results.length - errors.length}/${results.length})`,
      });
    }
    return NextResponse.json({
      success: true,
      results,
      message: `Assigned ${reviewerIds.length} reviewer(s) via smart contract`,
    });
  } catch (error) {
    console.error("[assign] Top-level error:", error);
    return NextResponse.json(
      { error: "Failed to assign reviewers", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
