import { createClient } from "@/lib/supabase/server";
import { recordPaperOnBlockchain } from "@/lib/blockchain/hedera";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { paperId } = await request.json();

    if (!paperId) {
      return NextResponse.json(
        { error: "Paper ID required" },
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

    const blockchainResult = await recordPaperOnBlockchain(
      paperId,
      paper.title,
      paper.profiles?.wallet_address || user.id
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

    return NextResponse.json({
      success: true,
      transactionHash: blockchainResult.transactionHash,
      message: "Paper published and verified on blockchain",
    });
  } catch (error) {
    console.error("Blockchain publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish paper" },
      { status: 500 }
    );
  }
}
