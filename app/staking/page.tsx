"use client";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import Link from "next/link";
import { isValidHederaAddress, initiateHederaTransaction } from "@/lib/blockchain/hedera-real";

export default function StakingPage() {
  const [staking, setStaking] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MIN_STAKE = 100;

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setUserProfile(profile);

        const { data } = await supabase
          .from("staking")
          .select("*")
          .eq("reviewer_id", user.id)
          .single();

        setStaking(data);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) < MIN_STAKE) {
      setError(`Minimum stake is ${MIN_STAKE} HBAR`);
      return;
    }

    if (!userProfile?.wallet_address) {
      setError("Wallet address not found in profile");
      return;
    }

    if (!isValidHederaAddress(userProfile.wallet_address)) {
      setError("Invalid wallet address format");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const transaction = await initiateHederaTransaction(
        userProfile.wallet_address,
        parseFloat(stakeAmount),
        `Staking ${stakeAmount} HBAR for reviewer role`
      );

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const lockUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { error: dbError } = await supabase.from("staking").insert({
        reviewer_id: user.id,
        staked_amount: parseFloat(stakeAmount),
        lock_until: lockUntil.toISOString(),
      });

      if (dbError) throw dbError;

      // Record transaction
      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        tx_hash: transaction.transactionHash,
        type: "stake",
        amount: parseFloat(stakeAmount),
      });

      setStakeAmount("");
      setStaking(null);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staking failed");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reviewer Staking</h1>
          <p className="text-muted-foreground">Lock HBAR to qualify as a reviewer</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>

      {staking ? (
        <Card>
          <CardHeader>
            <CardTitle>Current Stake</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Staked Amount</p>
              <p className="text-2xl font-bold">{staking.staked_amount} HBAR</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Locked Until</p>
              <p className="text-lg">{new Date(staking.lock_until).toLocaleDateString()}</p>
            </div>
            {userProfile?.wallet_address && (
              <div>
                <p className="text-sm text-muted-foreground">Your Wallet</p>
                <p className="text-sm font-mono">{userProfile.wallet_address}</p>
              </div>
            )}
            <Button variant="outline" className="w-full">
              Unstake
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Stake HBAR</CardTitle>
            <CardDescription>Minimum stake: {MIN_STAKE} HBAR</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userProfile?.wallet_address && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                <p className="text-xs text-muted-foreground">Your Wallet Address:</p>
                <p className="text-sm font-mono break-all">{userProfile.wallet_address}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Stake Amount (HBAR)</Label>
              <Input
                id="amount"
                type="number"
                min={MIN_STAKE}
                step="1"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder={MIN_STAKE.toString()}
              />
              <p className="text-xs text-muted-foreground">
                Your stake will be locked for 30 days
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button 
              onClick={handleStake} 
              disabled={isProcessing || !stakeAmount}
              className="w-full"
            >
              {isProcessing ? "Processing..." : "Stake HBAR"}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
