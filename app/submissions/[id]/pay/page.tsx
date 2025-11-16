"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import Link from "next/link";
import { isValidHederaAddress, initiateHederaTransaction } from "@/lib/blockchain/hedera-real";

export default function PaymentPage() {
  const params = useParams();
  const submissionId = params.id as string;
  const router = useRouter();
  const [submission, setSubmission] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch user profile to get wallet address
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setUserProfile(profile);

        const { data, error: err } = await supabase
          .from("submissions")
          .select("*")
          .eq("id", submissionId)
          .single();

        if (err) throw err;
        setSubmission(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load submission");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [submissionId, router]);

  const handlePayment = async () => {
    setError(null);
    setProcessing(true);

    try {
      if (!userProfile?.wallet_address) {
        throw new Error("Wallet address not found in profile");
      }

      if (!isValidHederaAddress(userProfile.wallet_address)) {
        throw new Error("Invalid wallet address format");
      }

      // Initiate real Hedera transaction
      const transaction = await initiateHederaTransaction(
        userProfile.wallet_address,
        parseFloat(submission.submission_fee_amount),
        `Submission fee for paper: ${submission.title}`
      );

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Update submission with payment info
      const { error: updateErr } = await supabase
        .from("submissions")
        .update({
          status: "under-review",
          submission_fee_tx_hash: transaction.transactionHash,
        })
        .eq("id", submissionId);

      if (updateErr) throw updateErr;

      // Record wallet transaction
      const { error: txErr } = await supabase
        .from("wallet_transactions")
        .insert({
          user_id: user.id,
          tx_hash: transaction.transactionHash,
          type: "fee",
          amount: submission.submission_fee_amount,
        });

      if (txErr) throw txErr;

      router.push(`/submissions/${submissionId}?payment=success`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setProcessing(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!submission) return <div className="text-center py-12">Submission not found</div>;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Complete Payment</CardTitle>
          <CardDescription>Pay the submission fee to publish your research</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-t border-b py-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paper:</span>
              <span className="font-medium">{submission.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fee:</span>
              <span className="font-medium">{submission.submission_fee_amount} HBAR</span>
            </div>
            {/* Display wallet address */}
            {userProfile?.wallet_address && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Wallet:</span>
                <span className="font-mono text-sm">{userProfile.wallet_address}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-400">
              Click the button below to initiate a Hedera transaction from your wallet.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button 
            onClick={handlePayment} 
            className="w-full" 
            size="lg"
            disabled={processing}
          >
            {processing ? "Processing..." : "Pay with Hedera Wallet"}
          </Button>

          {/* Add back to dashboard button */}
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
