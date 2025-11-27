"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function ClaimReviewButton({
  paperId,
  reviewerId,
  reviewerPrivateKey
}: {
  paperId: string,
  reviewerId: string,
  reviewerPrivateKey: string
}) {
  const [loading, setLoading] = useState(false);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[claim-review-button] Starting claim with:", {
      paperId,
      reviewerId, 
      reviewerPrivateKey: reviewerPrivateKey ? "[PRESENT]" : "[MISSING]",
      privateKeyLength: reviewerPrivateKey?.length || 0
    });
    
    if (!reviewerPrivateKey || reviewerPrivateKey.trim() === '') {
      alert("Please enter your private key before claiming the review.");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch("/api/review-assignments/assign/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId,
          reviewerIds: [reviewerId],
          reviewerPrivateKeys: { [reviewerId]: reviewerPrivateKey },
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      const result = await res.json();
      
      if (res.ok && result.success) {
        alert(result.message || "Review claimed successfully.");
        window.location.reload();
      } else {
        alert("Failed to claim review: " + (result.error || result.message || JSON.stringify(result)));
      }
    } catch (error) {
      console.error("Claim review error:", error);
      alert("Network error occurred while claiming review.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleClaim}>
      <Button type="submit" className="w-full mt-4" disabled={loading}>
        {loading ? "Claiming..." : "Claim Review"}
      </Button>
    </form>
  );
}
