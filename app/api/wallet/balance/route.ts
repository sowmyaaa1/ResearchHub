import { createClient } from "@/lib/supabase/server";
import { getHbarBalance } from "@/lib/blockchain/hedera";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's wallet address
    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", user.id)
      .single();

    if (!profile?.wallet_address) {
      return NextResponse.json(
        { error: "Wallet not configured. Please set up your wallet in profile." },
        { status: 400 }
      );
    }

    // Get real HBAR balance from Hedera network
    try {
      const balance = await getHbarBalance(profile.wallet_address);
      console.log("[wallet/balance] Retrieved balance for", profile.wallet_address, ":", balance, "HBAR");

      return NextResponse.json({
        balance: balance,
        accountId: profile.wallet_address,
        currency: "HBAR"
      });
    } catch (balanceError) {
      console.error("[wallet/balance] Failed to get balance:", balanceError);
      return NextResponse.json(
        { error: "Failed to retrieve balance from Hedera network", details: balanceError instanceof Error ? balanceError.message : "Unknown error" },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("[wallet/balance] Error:", error);
    return NextResponse.json(
      { error: "Failed to get wallet balance", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}