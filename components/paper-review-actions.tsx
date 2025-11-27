"use client";

import ClaimReviewButton from "@/components/claim-review-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function PaperReviewActions({
  paperId,
  reviewerId,
}: {
  paperId: string,
  reviewerId: string,
}) {
  const [assignmentStatus, setAssignmentStatus] = useState<"unassigned" | "claimed" | "completed" | "already_reviewed" | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [reviewerPrivateKey, setReviewerPrivateKey] = useState<string>("");
  const [keyFetchError, setKeyFetchError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch assignment status and private key
    const loadData = async () => {
      try {
        // Fetch assignment status
        const statusRes = await fetch(`/api/reviews/assigned?paperId=${paperId}&reviewerId=${reviewerId}`);
        const statusData = await statusRes.json();
        setAssignmentStatus(statusData.status);
        setAssignmentId(statusData.assignmentId || null);

        // Fetch reviewer's private key from profile
        const supabase = createClient();
        console.log("[paper-review-actions] Fetching private key for reviewer:", reviewerId);
        
        // First check if the private_key column exists
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, private_key")
          .eq("id", reviewerId)
          .maybeSingle();
        
        console.log("[paper-review-actions] Profile query result:", { profile, profileError });
        
        if (profileError) {
          console.error("[paper-review-actions] Profile fetch error:", profileError.message);
          setKeyFetchError(`Database error: ${profileError.message}`);
        } else if (!profile) {
          console.error("[paper-review-actions] No profile found for reviewer:", reviewerId);
          setKeyFetchError("Reviewer profile not found");
        } else if (!profile.hasOwnProperty('private_key')) {
          console.error("[paper-review-actions] private_key column does not exist");
          setKeyFetchError("Private key column missing - need to run migration 008");
        } else if (!profile.private_key || profile.private_key.trim() === '') {
          console.warn("[paper-review-actions] Private key is null or empty for reviewer:", reviewerId);
          setKeyFetchError("Private key not set in profile");
        } else {
          console.log("[paper-review-actions] Private key found in profile");
          setReviewerPrivateKey(profile.private_key);
          setKeyFetchError(null);
        }
      } catch (error) {
        console.error("Error loading review data:", error);
        setAssignmentStatus(null);
        setKeyFetchError(`Load error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    loadData();
  }, [paperId, reviewerId]);

  if (assignmentStatus === "unassigned" || assignmentStatus === null) {
    if (keyFetchError) {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 text-sm">
              <strong>Cannot claim review:</strong> {keyFetchError}
            </p>
            {keyFetchError.includes('migration 008') && (
              <p className="text-red-600 text-xs mt-2">
                Admin needs to run: <code>scripts/008_add_private_key_support.sql</code>
              </p>
            )}
            {keyFetchError.includes('Private key not set') && (
              <p className="text-red-600 text-xs mt-2">
                Go to your profile to set up your private key.
              </p>
            )}
          </div>
        </div>
      );
    }
    
    if (!reviewerPrivateKey) {
      return (
        <div className="space-y-4">
          <div className="text-center text-gray-500">
            Loading private key...
          </div>
        </div>
      );
    }
    
    return (
      <ClaimReviewButton
        paperId={paperId}
        reviewerId={reviewerId}
        reviewerPrivateKey={reviewerPrivateKey}
      />
    );
  }

  if (assignmentStatus === "claimed" && assignmentId) {
    return (
      <Button className="w-full mt-4" onClick={() => window.location.href = `/reviews/submit/${assignmentId}`}>
        Review Paper
      </Button>
    );
  }

  if (assignmentStatus === "completed") {
    return (
      <Button className="w-full mt-4" disabled>
        Review Completed
      </Button>
    );
  }

  if (assignmentStatus === "already_reviewed") {
    return (
      <Button className="w-full mt-4" disabled>
        Already Reviewed
      </Button>
    );
  }

  return null;
}
