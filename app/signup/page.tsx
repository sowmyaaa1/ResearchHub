"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useState } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("viewer");
  const [walletAddress, setWalletAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (role !== "viewer" && !walletAddress) {
      setError("Wallet address is required for Submitter and Reviewer roles");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            wallet_address: walletAddress,
          },
          // Email confirmation is now disabled - users are auto-confirmed
        },
      });

      if (authError) throw authError;
      
      if (data?.user) {
        router.push("/dashboard");
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Join the decentralized research network</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Dr. Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <Label>I want to:</Label>
              <RadioGroup value={role} onValueChange={setRole} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="viewer" id="role-viewer" />
                  <Label htmlFor="role-viewer" className="font-normal cursor-pointer">
                    Browse published papers (Viewer)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="submitter" id="role-submitter" />
                  <Label htmlFor="role-submitter" className="font-normal cursor-pointer">
                    Submit papers for review (Submitter)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="reviewer" id="role-reviewer" />
                  <Label htmlFor="role-reviewer" className="font-normal cursor-pointer">
                    Review papers and earn rewards (Reviewer)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {role !== "viewer" && (
              <div className="space-y-2">
                <Label htmlFor="wallet">Hedera Wallet Address</Label>
                <Input
                  id="wallet"
                  placeholder="0.0.xxxxx or hedera address"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Required for submitting and reviewing papers
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
