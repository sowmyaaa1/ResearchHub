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
  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchBalance = async () => {
    if (!profile?.wallet_address) return;
    
    setBalanceLoading(true);
    try {
      const response = await fetch("/api/wallet/balance");
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance.toString());
        console.log("Balance fetched:", data.balance, "HBAR");
      } else {
        console.error("Failed to fetch balance");
        setBalance("Error");
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance("Error");
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!profile) return;
    
    try {
      const supabase = createClient();
      const { data: transData, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", profile.id)
        .order("timestamp", { ascending: false });

      if (!error && transData) {
        setTransactions(transData);
        console.log("Transactions fetched:", transData.length);
      } else {
        console.error("Failed to fetch transactions:", error);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

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
            fetchBalance();
          }
        }

        // Fetch transactions after profile is loaded
        if (!profileError && profileData) {
          const { data: transData, error: transError } = await supabase
            .from("wallet_transactions")
            .select("*")
            .eq("user_id", profileData.id)
            .order("timestamp", { ascending: false });

          if (!transError && transData) {
            setTransactions(transData);
            console.log("Transactions loaded:", transData.length);
          } else {
            console.error("Failed to load transactions:", transError);
          }
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
              <p className="text-3xl font-bold">
                {balanceLoading ? "Loading..." : `${balance} HBAR`}
              </p>
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
            <CardTitle className="flex items-center justify-between">
              Transaction History
              <Button size="sm" variant="outline" onClick={fetchTransactions}>
                Refresh
              </Button>
            </CardTitle>
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
