// POST /api/wallet/stake
import { NextRequest, NextResponse } from "next/server";
import { transferHbar } from "@/lib/blockchain/hedera";
import { normalizeHederaPrivateKey } from "@/lib/hedera/key-utils";
import { createClient } from "@/lib/supabase/server";

// Staking pool account - users stake TO this account and unstake FROM this account
const STAKING_ACCOUNT_ID = "0.0.7281579";
const STAKING_ACCOUNT_PRIVATE_KEY = "3030020100300706052b8104000a0422042041c6b4b954c336eb0a70bb09439e9f1547d3c794390c814624f6e5eff99125e5";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, userAccountId, userPrivateKey } = body;

    if (!amount || !userAccountId || !userPrivateKey) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Normalize private key
    const norm = normalizeHederaPrivateKey(typeof userPrivateKey === 'string' ? userPrivateKey : JSON.stringify(userPrivateKey));
    if (norm.type === 'unknown' || !/^[0-9a-fA-F]{64}$/.test(norm.raw)) {
      return NextResponse.json({
        error: "Unsupported or invalid private key format. Provide a valid ED25519 Hedera private key (64 hex chars).",
        details: {
          receivedLength: norm.raw.length,
          exampleFormat: "302e020100300506032b657004220420<64 hex chars>",
          guidance: "If you exported a PEM/DER key, supply the final 64 hex characters or the SDK string from HashPack/Portal."
        }
      }, { status: 400 });
    }
    const hexPrivateKey = norm.raw;

    // Transfer HBAR from user to staking account
    const transferResult = await transferHbar(
      userAccountId,
      hexPrivateKey,
      STAKING_ACCOUNT_ID,
      amount
    );

    // Record staking in database
    const lockUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stakingRow, error: stakingError } = await supabase
      .from("staking")
      .upsert({
        reviewer_id: user.id,
        staked_amount: amount,
        lock_until: lockUntil,
        created_at: new Date().toISOString(),
        tx_hash: transferResult.transactionId,
      })
      .select()
      .single();

    if (stakingError) {
      return NextResponse.json({ error: stakingError.message }, { status: 500 });
    }

    // Automatically set user as reviewer when they stake
    await supabase
      .from('profiles')
      .update({ is_reviewer: true })
      .eq('id', user.id);

    return NextResponse.json({ success: true, transferResult });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
