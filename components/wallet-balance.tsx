"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface WalletBalanceProps {
  userId: string;
}

export default function WalletBalance({ userId }: WalletBalanceProps) {
  const [balance, setBalance] = useState<string>("-- HBAR");
  const [dbBalance, setDbBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const supabase = createClient();
        
        // Get user's account ID and database balance
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_address, wallet_balance")
          .eq("id", userId)
          .single();

        if (profile) {
          setDbBalance(profile.wallet_balance || 0);
        }

        if (profile?.wallet_address) {
          // Validate account ID format
          const accountIdRegex = /^0\.0\.\d+$/;
          if (!accountIdRegex.test(profile.wallet_address)) {
            setBalance("Invalid Account ID");
            setError("Invalid Hedera account ID format");
            return;
          }

          try {
            // Fetch real balance from Hedera
            const response = await fetch('/api/hedera/balance', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                accountId: profile.wallet_address
              }),
            });

            if (response.ok) {
              const data = await response.json();
              setBalance(`${data.hbar} HBAR`);
            } else {
              // Fallback to account ID display if API fails
              setBalance(`${profile.wallet_address}`);
              setError("Unable to fetch balance");
            }
          } catch (balanceError) {
            console.error("Balance fetch error:", balanceError);
            setBalance(`${profile.wallet_address}`);
            setError("Balance unavailable");
          }
        } else {
          setBalance("-- HBAR");
        }
      } catch (error) {
        console.error("Error fetching wallet info:", error);
        setBalance("-- HBAR");
        setError("Error loading wallet");
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchBalance();
    }
  }, [userId]);

  if (loading) {
    return <span>Loading...</span>;
  }

  if (error) {
    return (
      <span className="text-xs text-muted-foreground" title={error}>
        {balance}
      </span>
    );
  }

  return (
    <span className="text-3xl font-bold">
      {balance}
    </span>
  );
}