"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { convertDerToHex, validateHederaPrivateKey } from "@/lib/hedera/key-utils";
import PrivateKeyInput from "./private-key-input";

export default function ProfileForm({ initialProfile, userId }: any) {
  const [fullName, setFullName] = useState(initialProfile?.full_name || "");
  const [institution, setInstitution] = useState(initialProfile?.institution || "");
  const [bio, setBio] = useState(initialProfile?.bio || "");
  const [expertise, setExpertise] = useState(initialProfile?.expertise || "");
  const [walletAddress, setWalletAddress] = useState(initialProfile?.wallet_address || "");
  const [privateKey, setPrivateKey] = useState(initialProfile?.private_key || "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleIntent = searchParams.get('intent'); // Get role intent from URL

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsSaving(true);

    try {
      // Validate wallet address format if provided
      if (walletAddress.trim()) {
        const accountIdRegex = /^0\.0\.\d+$/;
        if (!accountIdRegex.test(walletAddress.trim())) {
          throw new Error("Invalid Hedera Account ID format. Use format: 0.0.123456");
        }
      }

      // Validate and convert private key if provided
      let processedPrivateKey = privateKey;
      if (privateKey.trim()) {
        const validation = validateHederaPrivateKey(privateKey);
        if (!validation.valid) {
          throw new Error(`Invalid private key format: ${validation.error}`);
        }
        processedPrivateKey = convertDerToHex(privateKey);
      }

      // Determine the new role based on private key and user intent
      let newRole = initialProfile?.role || "viewer";
      if (privateKey.trim() && processedPrivateKey) {
        // If user provides a valid private key, promote them based on intent
        if (roleIntent === 'reviewer') {
          newRole = "reviewer";
        } else if (roleIntent === 'submitter' || !roleIntent) {
          // Default to submitter if no specific intent or if intent is submitter
          newRole = "submitter";
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          institution,
          bio,
          expertise: expertise.trim() || null,
          wallet_address: walletAddress.trim() || null,
          private_key: processedPrivateKey,
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      const successMessage = (newRole !== initialProfile?.role && privateKey.trim()) 
        ? `Profile updated successfully! You are now a ${newRole} and can ${newRole === 'reviewer' ? 'review papers and earn HBAR tokens' : 'submit research papers'}.`
        : "Profile updated successfully! Private key validated and stored securely.";
      
      setMessage({ type: "success", text: successMessage });
      
      // If user just changed roles, redirect to dashboard after a brief delay
      if (newRole !== initialProfile?.role && privateKey.trim()) {
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh(); // Refresh to update the dashboard with new role
        }, 2000);
      } else {
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Dr. Jane Smith"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="institution">Institution</Label>
        <Input
          id="institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="University of Excellence"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about your research interests..."
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expertise">Research Expertise</Label>
        <Input
          id="expertise"
          value={expertise}
          onChange={(e) => setExpertise(e.target.value)}
          placeholder="blockchain, machine learning, cryptography, peer review"
        />
        <p className="text-xs text-muted-foreground">
          Enter your research areas separated by commas. This helps match you with relevant papers to review.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="walletAddress">Hedera Account ID</Label>
        <Input
          id="walletAddress"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="0.0.123456 (your Hedera account ID)"
        />
        <p className="text-xs text-muted-foreground">
          Your Hedera account ID (format: 0.0.123456) to display wallet balance and receive HBAR rewards
        </p>
      </div>

      <PrivateKeyInput
        label="Hedera Private Key"
        value={privateKey}
        onChange={setPrivateKey}
        placeholder="Enter your Hedera private key (DER, hex, or PEM format)"
        required={false}
        showValidation={true}
        showGenerator={true}
      />

      {/* Role Status Indicator */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Current Role: {initialProfile?.role || "viewer"}
            </p>
            {privateKey.trim() && (initialProfile?.role === "viewer") && (
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                ✨ You'll become a "{roleIntent === 'reviewer' ? 'reviewer' : 'submitter'}" when you save with a valid private key
              </p>
            )}
            {(initialProfile?.role === "submitter") && (
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                ✅ You can submit research papers
              </p>
            )}
            {(initialProfile?.role === "reviewer") && (
              <div>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  ✅ You can review papers and earn HBAR tokens
                </p>
                {!expertise.trim() && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    💡 Add expertise areas above to get matched with relevant papers
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
