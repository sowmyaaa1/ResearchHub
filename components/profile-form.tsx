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
      // Get current user to access email
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user?.email) throw new Error("User email not found");

      // Enhanced validation for active roles (submitter/reviewer)
      const isActiveRole = roleIntent || (initialProfile?.role !== 'viewer');
      
      if (isActiveRole && !fullName.trim()) {
        throw new Error("Full Name is required");
      }
      
      if (isActiveRole && !walletAddress.trim()) {
        throw new Error("Hedera Account ID is required");
      }
      
      // Expertise is required only for reviewers
      const isReviewer = roleIntent === 'reviewer' || initialProfile?.role === 'reviewer';
      if (isReviewer && !expertise.trim()) {
        throw new Error("Research Expertise is required for reviewers");
      }
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
      
      console.log("Profile Form Debug:");
      console.log("- Initial profile:", initialProfile);
      console.log("- Role intent:", roleIntent);
      console.log("- User ID:", userId);
      console.log("- Has private key:", !!privateKey.trim());
      
      // Only change role if:
      // 1. User didn't have a role before (new user), OR
      // 2. There's a specific roleIntent from URL parameter
      if (privateKey.trim() && processedPrivateKey) {
        if (roleIntent === 'reviewer') {
          newRole = "reviewer";
        } else if (roleIntent === 'submitter') {
          newRole = "submitter";
        } else if (!initialProfile?.role || initialProfile?.role === 'viewer') {
          // Only auto-promote viewers to submitter, don't change existing roles
          newRole = "submitter";
        }
        // Otherwise, keep the existing role (don't change reviewer to submitter)
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: userId, // Include the user ID for upsert
          email: user.email, // Include email from auth user
          full_name: fullName,
          institution,
          bio,
          expertise: expertise.trim() || null,
          wallet_address: walletAddress.trim() || null,
          private_key: processedPrivateKey,
          role: newRole,
          updated_at: new Date().toISOString(),
        });

      console.log("Profile upsert result:", { error, newRole });

      if (error) throw error;

      // Check if role actually changed
      const roleChanged = newRole !== initialProfile?.role;
      
      const successMessage = (roleChanged && privateKey.trim()) 
        ? `Profile updated successfully! You are now a ${newRole} and can ${newRole === 'reviewer' ? 'review papers and earn HBAR tokens' : 'submit research papers'}.`
        : "Profile updated successfully!";
      
      setMessage({ type: "success", text: successMessage });
      
      // If user just changed roles, redirect to dashboard after a brief delay
      if (roleChanged && privateKey.trim()) {
        setTimeout(() => {
          // Use window.location for hard refresh to ensure dashboard updates
          window.location.href = "/dashboard";
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
      {/* Role Intent Notice */}
      {roleIntent && (
        <div className={`p-4 rounded-lg border ${
          roleIntent === 'reviewer' 
            ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        }`}>
          <div className="flex items-center gap-2">
            {roleIntent === 'reviewer' ? (
              <div className="text-purple-600 dark:text-purple-400">👨‍🔬</div>
            ) : (
              <div className="text-green-600 dark:text-green-400">📝</div>
            )}
            <div>
              <p className={`text-sm font-medium ${
                roleIntent === 'reviewer' 
                  ? 'text-purple-900 dark:text-purple-100'
                  : 'text-green-900 dark:text-green-100'
              }`}>
                Setting up {roleIntent === 'reviewer' ? 'Reviewer' : 'Submitter'} Profile
              </p>
              <p className={`text-xs mt-1 ${
                roleIntent === 'reviewer'
                  ? 'text-purple-700 dark:text-purple-300'
                  : 'text-green-700 dark:text-green-300'
              }`}>
                {roleIntent === 'reviewer' 
                  ? 'Required: Research expertise, Hedera account, and private key to review papers and earn HBAR'
                  : 'Required: Full name, Hedera account, and private key to submit papers and stake HBAR'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name {(roleIntent || (initialProfile?.role !== 'viewer')) && <span className="text-red-500">*</span>}</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Dr. Jane Smith"
          required={!!(roleIntent || (initialProfile?.role !== 'viewer'))}
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

      {(roleIntent === 'reviewer' || initialProfile?.role === 'reviewer') && (
        <div className="space-y-2">
          <Label htmlFor="expertise">Research Expertise <span className="text-red-500">*</span></Label>
          <Input
            id="expertise"
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
            placeholder="blockchain, machine learning, cryptography, peer review"
            required
          />
          <p className="text-xs text-muted-foreground">
            Enter your research areas separated by commas. This helps match you with relevant papers to review.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="walletAddress">Hedera Account ID {(roleIntent || (initialProfile?.role !== 'viewer')) && <span className="text-red-500">*</span>}</Label>
        <Input
          id="walletAddress"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="0.0.123456 (your Hedera account ID)"
          required={!!(roleIntent || (initialProfile?.role !== 'viewer'))}
        />
        <p className="text-xs text-muted-foreground">
          Your Hedera account ID (format: 0.0.123456) to {roleIntent === 'reviewer' || initialProfile?.role === 'reviewer' ? 'receive review rewards and stake HBAR' : roleIntent === 'submitter' || initialProfile?.role === 'submitter' ? 'pay publication fees and stake HBAR' : 'display wallet balance and receive HBAR rewards'}
        </p>
      </div>

      <PrivateKeyInput
        label={`Hedera Private Key${(roleIntent || (initialProfile?.role !== 'viewer')) ? ' *' : ''}`}
        value={privateKey}
        onChange={setPrivateKey}
        placeholder="Enter your Hedera private key (DER, hex, or PEM format)"
        required={!!(roleIntent || (initialProfile?.role !== 'viewer'))}
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
