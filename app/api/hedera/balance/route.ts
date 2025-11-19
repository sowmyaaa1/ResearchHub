import { NextRequest, NextResponse } from "next/server";
import { HederaClient } from "@/lib/hedera/client";

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Validate account ID format
    const accountIdRegex = /^0\.0\.\d+$/;
    if (!accountIdRegex.test(accountId)) {
      return NextResponse.json(
        { error: "Invalid account ID format" },
        { status: 400 }
      );
    }

    const client = new HederaClient();
    
    try {
      const balance = await client.getAccountBalance(accountId);
      
      return NextResponse.json({
        accountId,
        hbar: balance.hbar,
        tokens: balance.tokens
      });
      
    } catch (error) {
      console.error("Hedera balance fetch error:", error);
      return NextResponse.json(
        { 
          error: "Failed to fetch balance from Hedera network",
          accountId 
        },
        { status: 503 }
      );
    } finally {
      client.close();
    }

  } catch (error) {
    console.error("Balance API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}