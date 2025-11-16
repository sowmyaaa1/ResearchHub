"use client";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useState } from "react";
import Link from "next/link";
import { verifyWalletBalance } from "@/lib/blockchain/hedera-real";
import { HederaClient } from "@/lib/hedera/client";

export default function WalletPage() {
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState("0");

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!profileError && profileData) {
          setProfile(profileData);
          // Fetch HBAR balance if wallet address exists
          if (profileData.wallet_address) {
            try {
              console.log("Fetching Hedera balance for address:", profileData.wallet_address);
              const hederaClient = new HederaClient();
              const balanceResult = await hederaClient.getAccountBalance(profileData.wallet_address);
              console.log("HederaClient.getAccountBalance result:", balanceResult);
              setBalance(balanceResult.hbar);
              hederaClient.close();
            } catch (err) {
              console.error("Error fetching Hedera balance:", err);
              setBalance("Error");
            }
          }
        }

        const { data: transData, error: transError } = await supabase
          .from("wallet_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("timestamp", { ascending: false });

        if (!transError && transData) {
          setTransactions(transData);
        }
      } catch (error) {
        console.error("Error loading wallet data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <div className="text-center py-12">Loading...</div>;

  const typeColors: Record<string, string> = {
    fee: "bg-red-100 text-red-800",
    reward: "bg-green-100 text-green-800",
    stake: "bg-blue-100 text-blue-800",
    unstake: "bg-yellow-100 text-yellow-800",
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Wallet & Transactions</h1>
          <Link href="/dashboard" className="text-primary hover:underline">← Back to Dashboard</Link>
        </div>

        {/* Wallet Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Address</CardTitle>
            </CardHeader>
            <CardContent>
              {profile?.wallet_address ? (
                <p className="font-mono text-sm break-all">{profile.wallet_address}</p>
              ) : (
                <p className="text-muted-foreground">Not connected</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>HBAR Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{balance} HBAR</p>
              <Button
                className="mt-4"
                size="sm"
                onClick={async () => {
                  if (profile?.wallet_address) {
                    setLoading(true);
                    try {
                      console.log("Syncing Hedera balance for address:", profile.wallet_address);
                      const hederaClient = new HederaClient();
                      const balanceResult = await hederaClient.getAccountBalance(profile.wallet_address);
                      console.log("HederaClient.getAccountBalance result:", balanceResult);
                      setBalance(balanceResult.hbar);
                      hederaClient.close();
                    } catch (err) {
                      console.error("Error syncing Hedera balance:", err);
                      setBalance("Error");
                    }
                    setLoading(false);
                  }
                }}
              >
                Sync Balance
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All wallet transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Transaction Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Badge className={typeColors[tx.type] || "bg-gray-100"}>
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {tx.type === "fee" || tx.type === "stake" ? "-" : "+"}{tx.amount} HBAR
                        </TableCell>
                        <TableCell>{new Date(tx.timestamp).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs">{tx.tx_hash.substring(0, 16)}...</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground">No transactions yet</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
