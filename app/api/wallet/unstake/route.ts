// POST /api/wallet/unstake
import { NextRequest, NextResponse } from "next/server";
import { transferHbar } from "@/lib/blockchain/hedera";
import { normalizeHederaPrivateKey } from "@/lib/hedera/key-utils";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { amount } = body;

    if (!amount) {
      return NextResponse.json({ 
        error: "Missing required parameter: amount" 
      }, { status: 400 });
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ 
        error: "Invalid amount. Must be greater than 0." 
      }, { status: 400 });
    }

    // Fetch user's profile to get wallet address
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json({ 
        error: "Failed to fetch user profile" 
      }, { status: 500 });
    }

    if (!userProfile) {
      return NextResponse.json({ 
        error: "User profile not found. Please complete your profile setup." 
      }, { status: 404 });
    }

    if (!userProfile.wallet_address) {
      return NextResponse.json({ 
        error: "Wallet address not found. Please connect your wallet first." 
      }, { status: 400 });
    }

    // Staking pool account - users stake TO this account and unstake FROM this account
    const STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS || "0.0.7281579";
    const STAKING_ACCOUNT_PRIVATE_KEY = process.env.STAKING_ACCOUNT_PRIVATE_KEY;

    if (!STAKING_ACCOUNT_PRIVATE_KEY) {
      console.error("Missing STAKING_ACCOUNT_PRIVATE_KEY environment variable");
      return NextResponse.json({
        error: "Staking system not configured. Please contact support."
      }, { status: 500 });
    }

    // Check if user has a staking record
    const { data: stakingRecord, error: stakingError } = await supabase
      .from("staking")
      .select("*")
      .eq("reviewer_id", user.id)
      .maybeSingle();

    if (stakingError) {
      console.error("Error fetching staking record:", stakingError);
      return NextResponse.json({ 
        error: "Failed to fetch staking record" 
      }, { status: 500 });
    }

    if (!stakingRecord) {
      return NextResponse.json({ 
        error: "No staking record found. You need to stake tokens first." 
      }, { status: 404 });
    }

    // Check if user has enough staked amount
    if (stakingRecord.staked_amount < amount) {
      return NextResponse.json({ 
        error: `Insufficient staked balance. You have ${stakingRecord.staked_amount} HBAR staked, but requested ${amount} HBAR.` 
      }, { status: 400 });
    }

    // Use staking contract private key from user profile
    // Normalize the staking account private key
    const stakingKeyNorm = normalizeHederaPrivateKey(STAKING_ACCOUNT_PRIVATE_KEY);
    if (stakingKeyNorm.type === 'unknown' || !/^[0-9a-fA-F]{64}$/.test(stakingKeyNorm.raw)) {
      console.error("Invalid staking account private key configuration");
      return NextResponse.json({
        error: "Staking system configuration error. Please contact support."
      }, { status: 500 });
    }

    console.log('=== UNSTAKE DEBUG ===');
    console.log('Staking Account ID:', STAKING_CONTRACT_ADDRESS);
    console.log('Staking Private Key (DER):', STAKING_ACCOUNT_PRIVATE_KEY);
    console.log('Staking Private Key (normalized hex):', stakingKeyNorm.raw);
    console.log('User Wallet Address:', userProfile.wallet_address);
    console.log('Amount to unstake:', amount);
    
    // Verify the key by deriving public key
    try {
      const { PrivateKey: PK } = await import("@hashgraph/sdk");
      const testKey = PK.fromStringED25519(stakingKeyNorm.raw);
      const publicKey = testKey.publicKey;
      console.log('Derived Public Key:', publicKey.toString());
      console.log('Expected Public Key format should be visible on HashScan for account', STAKING_CONTRACT_ADDRESS);
    } catch (err) {
      console.error('Failed to derive public key:', err);
    }
    
    console.log('====================');

    // Transfer HBAR from staking contract back to user's wallet
    const transferResult = await transferHbar(
      STAKING_CONTRACT_ADDRESS,
      stakingKeyNorm.raw,
      userProfile.wallet_address,
      amount
    );

    if (!transferResult) {
      return NextResponse.json({ 
        error: "Transfer failed: " + ( "Unknown error") 
      }, { status: 500 });
    }

    // Update or delete staking record
    const newAmount = stakingRecord.staked_amount - amount;
    
    console.log('Updating database - newAmount:', newAmount, 'reviewer_id:', user.id);
    
    if (newAmount <= 0) {
      // Remove staking record completely if unstaking everything
      const { data: deleteData, error: deleteError, count } = await supabase
        .from("staking")
        .delete()
        .eq("reviewer_id", user.id)
        .select();

      console.log('Delete operation result:', { 
        deleteData, 
        deleteError, 
        count,
        affectedRows: deleteData?.length 
      });

      if (deleteError) {
        console.error("Error deleting staking record:", deleteError);
        // Note: Transfer succeeded but DB update failed
        return NextResponse.json({ 
          success: true, 
          transferResult,
          warning: "Transfer completed but failed to update database. Please contact support." 
        });
      }
      
      if (!deleteData || deleteData.length === 0) {
        console.error("Delete operation returned no affected rows - possible RLS issue");
        return NextResponse.json({ 
          success: true, 
          transferResult,
          warning: "Transfer completed but database record was not deleted (RLS policy may be blocking). Please contact support." 
        });
      }
      
      console.log('Successfully deleted staking record for user:', user.id, 'Affected rows:', deleteData.length);
    } else {
      // Update the remaining staked amount
      const { error: updateError } = await supabase
        .from("staking")
        .update({
          staked_amount: newAmount,
          tx_hash: transferResult.transactionId,
        })
        .eq("reviewer_id", user.id)
        .select();

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error(`Failed to update staking record: ${updateError.message}`);
      }

      // If user has unstaked everything, remove reviewer status
      if (newAmount === 0) {
        await supabase
          .from('profiles')
          .update({ is_reviewer: false })
          .eq('id', user.id);
      }      console.log('Successfully updated staking record for user:', user.id, 'new amount:', newAmount);
    }

    return NextResponse.json({ 
      success: true, 
      transferResult,
      remainingStake: Math.max(0, newAmount),
      message: `Successfully unstaked ${amount} HBAR. ${newAmount > 0 ? `Remaining stake: ${newAmount} HBAR` : 'All tokens unstaked.'}`
    });

  } catch (error) {
    console.error("Unstake error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }, { status: 500 });
  }
}
