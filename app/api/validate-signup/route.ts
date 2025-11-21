import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateHederaPrivateKey, normalizeHederaPrivateKey } from "@/lib/hedera/key-utils";
import { PrivateKey } from "@hashgraph/sdk";

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, email, privateKey } = await request.json();

    if (!walletAddress && !email && !privateKey) {
      return NextResponse.json(
        { error: "At least one field (wallet address, email, or private key) is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    const checks = [];
    
    // Validate private key format and derive public key if provided
    let derivedPublicKey = null;
    if (privateKey) {
      try {
        const validation = validateHederaPrivateKey(privateKey);
        if (!validation.valid) {
          checks.push({
            field: 'private_key',
            exists: false,
            message: `Invalid private key format: ${validation.error}`
          });
        } else {
          try {
            // Use the normalizeHederaPrivateKey function to get the raw key
            const normalized = normalizeHederaPrivateKey(privateKey);
            const privKey = PrivateKey.fromString(normalized.raw);
            derivedPublicKey = privKey.publicKey.toString();
          } catch (error) {
            checks.push({
              field: 'private_key',
              exists: false,
              message: 'Private key is not compatible with Hedera SDK'
            });
          }
        }
      } catch (error) {
        checks.push({
          field: 'private_key',
          exists: false,
          message: 'Failed to validate private key'
        });
      }
    }
    
    // Check for existing wallet address
    if (walletAddress) {
      const { data: walletCheck } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('wallet_address', walletAddress)
        .maybeSingle();
      
      if (walletCheck) {
        checks.push({
          field: 'wallet_address',
          exists: true,
          message: 'This wallet address is already registered to another account'
        });
      }
    }

    // Check for existing private key (if provided)
    if (privateKey && derivedPublicKey) {
      const { data: privateKeyCheck } = await supabase
        .from('profiles')
        .select('id, email, wallet_address')
        .eq('private_key', privateKey)
        .maybeSingle();
      
      if (privateKeyCheck) {
        checks.push({
          field: 'private_key',
          exists: true,
          message: 'This private key is already registered to another account'
        });
      }
    }

    // Check for existing email
    if (email) {
      const { data: emailCheck } = await supabase
        .from('profiles')
        .select('id, wallet_address')
        .eq('email', email)
        .maybeSingle();
      
      if (emailCheck) {
        checks.push({
          field: 'email',
          exists: true,
          message: 'This email address is already registered'
        });
      }
    }

    return NextResponse.json({
      checks,
      hasConflicts: checks.length > 0,
      derivedPublicKey: derivedPublicKey,
      validationInfo: {
        privateKeyValid: privateKey ? !checks.some(c => c.field === 'private_key' && !c.exists) : null,
        walletAddressAvailable: walletAddress ? !checks.some(c => c.field === 'wallet_address' && c.exists) : null,
        emailAvailable: email ? !checks.some(c => c.field === 'email' && c.exists) : null
      }
    });

  } catch (error) {
    console.error("Validation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}