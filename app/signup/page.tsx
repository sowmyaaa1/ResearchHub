"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from "react";
import { generateHederaKeyPair, validateHederaPrivateKey } from "@/lib/hedera/key-utils";
import PrivateKeyInput from "@/components/private-key-input";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("viewer");
  const [walletAddress, setWalletAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [walletValidation, setWalletValidation] = useState<{loading: boolean, error: string | null}>({loading: false, error: null});
  const [privateKeyValidation, setPrivateKeyValidation] = useState<{loading: boolean, error: string | null, publicKey: string | null}>({loading: false, error: null, publicKey: null});
  const router = useRouter();

  // Real-time wallet and private key validation
  const validateWalletAndPrivateKey = async (address: string, privKey: string) => {
    if (role === "viewer") {
      setWalletValidation({loading: false, error: null});
      setPrivateKeyValidation({loading: false, error: null, publicKey: null});
      return;
    }

    setWalletValidation({loading: true, error: null});
    setPrivateKeyValidation({loading: true, error: null, publicKey: null});
    
    try {
      const response = await fetch('/api/validate-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: address || null,
          privateKey: privKey || null
        })
      });

      if (!response.ok) {
        console.error('Validation API error:', response.status, response.statusText);
        setWalletValidation({loading: false, error: null});
        setPrivateKeyValidation({loading: false, error: null, publicKey: null});
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setWalletValidation({loading: false, error: null});
        setPrivateKeyValidation({loading: false, error: null, publicKey: null});
        return;
      }

      const validation = await response.json();
      
      // Handle wallet validation
      const walletError = validation.checks?.find((check: any) => check.field === 'wallet_address');
      setWalletValidation({
        loading: false, 
        error: walletError ? walletError.message : null
      });

      // Handle private key validation
      const privateKeyError = validation.checks?.find((check: any) => check.field === 'private_key');
      setPrivateKeyValidation({
        loading: false,
        error: privateKeyError ? privateKeyError.message : null,
        publicKey: validation.derivedPublicKey || null
      });

    } catch (error) {
      console.error('Validation error:', error);
      setWalletValidation({loading: false, error: null});
      setPrivateKeyValidation({loading: false, error: null, publicKey: null});
    }
  };

  // Debounced wallet and private key validation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if ((walletAddress || privateKey) && role !== "viewer") {
        validateWalletAndPrivateKey(walletAddress, privateKey);
      } else {
        setWalletValidation({loading: false, error: null});
        setPrivateKeyValidation({loading: false, error: null, publicKey: null});
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [walletAddress, privateKey, role]);  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (role !== "viewer" && !walletAddress) {
      setError("Wallet address is required for Submitter and Reviewer roles");
      setIsLoading(false);
      return;
    }

    if (role !== "viewer" && !privateKey) {
      setError("Private key is required for Submitter and Reviewer roles");
      setIsLoading(false);
      return;
    }

    // Validate private key format if provided
    if (privateKey) {
      const validation = validateHederaPrivateKey(privateKey);
      if (!validation.valid) {
        setError(`Invalid private key: ${validation.error}`);
        setIsLoading(false);
        return;
      }
    }

    try {
      // First, validate that email and wallet address are not already in use
      // This is optional - if it fails, we'll rely on database constraints
      try {
        const validationResponse = await fetch('/api/validate-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email, 
            walletAddress: role !== "viewer" ? walletAddress : null,
            privateKey: role !== "viewer" ? privateKey : null
          })
        });

        if (validationResponse.ok) {
          const contentType = validationResponse.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const validation = await validationResponse.json();
            
            if (validation.hasConflicts) {
              const conflicts = validation.checks.map((check: any) => check.message).join('. ');
              setError(conflicts);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (validationError) {
        console.warn('Pre-signup validation failed, proceeding with signup:', validationError);
        // Continue with signup - database constraints will catch duplicates
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            wallet_address: walletAddress,
            private_key: privateKey,
          },
          // Email confirmation is now disabled - users are auto-confirmed
        },
      });

      if (authError) throw authError;
      
      if (data?.user) {
        router.push("/dashboard");
      }
    } catch (error: unknown) {
      let errorMessage = "An error occurred during signup";
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        // Handle Supabase/PostgreSQL specific errors
        const errorObj = error as any;
        const code = errorObj?.code || errorObj?.status;
        const details = errorObj?.details?.toLowerCase() || '';
        const hint = errorObj?.hint?.toLowerCase() || '';
        
        // Handle database constraint violations with more specificity
        if (code === '23505' || message.includes('duplicate') || message.includes('unique')) {
          // PostgreSQL unique constraint violation
          if (details.includes('wallet_address') || message.includes('wallet address') || hint.includes('wallet')) {
            errorMessage = "This wallet address is already registered to another account. Please use a different wallet address or sign in to your existing account.";
          } else if (details.includes('private_key') || message.includes('private key') || hint.includes('private')) {
            errorMessage = "This private key is already registered to another account. Please use a different private key or sign in to your existing account.";
          } else if (details.includes('email') || message.includes('email') || hint.includes('email')) {
            errorMessage = "This email address is already registered. Please use a different email address or sign in to your existing account.";
          } else {
            errorMessage = "An account with these credentials already exists. Please check your email, wallet address, and private key, or try signing in to your existing account.";
          }
        } else if (code === '23514' || message.includes('check constraint')) {
          // PostgreSQL check constraint violation
          if (message.includes('wallet') || details.includes('wallet')) {
            errorMessage = "Invalid wallet address format. Please enter a valid Hedera account ID (e.g., 0.0.12345).";
          } else if (message.includes('private') || details.includes('private')) {
            errorMessage = "Invalid private key format. Please enter a valid Hedera private key.";
          } else {
            errorMessage = "Invalid data format. Please check your wallet address and private key.";
          }
        } else if (message.includes('wallet address') && message.includes('already')) {
          errorMessage = "This wallet address is already registered to another account. Please use a different wallet address or sign in to your existing account.";
        } else if (message.includes('private key') && message.includes('already')) {
          errorMessage = "This private key is already registered to another account. Please use a different private key or sign in to your existing account.";
        } else if (message.includes('email') && message.includes('already')) {
          errorMessage = "This email address is already registered. Please use a different email address or sign in to your existing account.";
        } else if (message.includes('invalid') && message.includes('private key')) {
          errorMessage = "The private key format is invalid. Please enter a valid Hedera private key in DER or hex format.";
        } else if (message.includes('invalid') && message.includes('wallet')) {
          errorMessage = "The wallet address format is invalid. Please enter a valid Hedera account ID (e.g., 0.0.12345).";
        } else if (message.includes('network') || message.includes('connection')) {
          errorMessage = "Network error occurred. Please check your internet connection and try again.";
        } else if (message.includes('rate limit')) {
          errorMessage = "Too many signup attempts. Please wait a few minutes before trying again.";
        } else if (message.includes('password') && message.includes('weak')) {
          errorMessage = "Password is too weak. Please use a stronger password with at least 8 characters.";
        } else if (message.includes('database error saving new user')) {
          // Extract more specific information from the error
          if (details || hint) {
            errorMessage = `Database error: ${details || hint}. Please check your information and try again.`;
          } else {
            errorMessage = "Database error occurred while creating your account. This might be due to duplicate wallet address, private key, or email. Please try different credentials or sign in to your existing account.";
          }
        } else {
          // For any other error, provide the original message but with better context
          errorMessage = `Signup failed: ${error.message}. Please try again or contact support if the issue persists.`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-foreground">
            ResearchHub
          </Link>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" asChild size="sm">
              <Link href="/login">Sign In</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      
      <div className="min-h-screen flex items-center justify-center p-4">
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
              <>
                <div className="space-y-2">
                  <Label htmlFor="wallet">Hedera Wallet Address</Label>
                  <Input
                    id="wallet"
                    placeholder="0.0.xxxxx or hedera address"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className={walletValidation.error ? "border-destructive" : ""}
                    required
                  />
                  {walletValidation.loading && (
                    <p className="text-xs text-muted-foreground">Checking availability...</p>
                  )}
                  {walletValidation.error && (
                    <p className="text-xs text-destructive">{walletValidation.error}</p>
                  )}
                  {!walletValidation.loading && !walletValidation.error && walletAddress && role !== "viewer" && (
                    <p className="text-xs text-green-600">Wallet address is available</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Required for submitting and reviewing papers
                  </p>
                </div>

                <PrivateKeyInput
                  label="Hedera Private Key"
                  value={privateKey}
                  onChange={setPrivateKey}
                  placeholder="Enter your private key or click Generate"
                  required={true}
                  showValidation={true}
                  showGenerator={true}
                />
                
                {/* Private Key Validation Feedback */}
                {privateKeyValidation.loading && (
                  <p className="text-xs text-muted-foreground">Validating private key...</p>
                )}
                {privateKeyValidation.error && (
                  <p className="text-xs text-destructive">{privateKeyValidation.error}</p>
                )}
                {!privateKeyValidation.loading && !privateKeyValidation.error && privateKey && privateKeyValidation.publicKey && (
                  <div className="space-y-1">
                    <p className="text-xs text-green-600">✓ Private key is valid</p>
                    <p className="text-xs text-muted-foreground">
                      Public key: {privateKeyValidation.publicKey.substring(0, 20)}...
                    </p>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">{error}</p>
                {error.includes('already registered') && (
                  <p className="text-xs text-muted-foreground mt-2">
                    If you already have an account, you can{" "}
                    <Link href="/login" className="text-primary hover:underline">
                      sign in here
                    </Link>
                  </p>
                )}
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={
                isLoading || 
                walletValidation.loading || 
                privateKeyValidation.loading ||
                (walletValidation.error !== null && role !== "viewer") ||
                (privateKeyValidation.error !== null && role !== "viewer")
              }
            >
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
    </div>
  );
}
