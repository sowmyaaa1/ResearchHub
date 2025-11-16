import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const mockBalance = Math.floor(Math.random() * 10000) / 100;

    const { data: transactions } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id);

    return NextResponse.json({
      balance: mockBalance,
      transactions,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync wallet" },
      { status: 500 }
    );
  }
}
