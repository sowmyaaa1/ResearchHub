"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface AssignReviewersFormProps {
  paperId: string;
  availableReviewers: Array<{
    id: string;
    full_name: string;
    institution: string;
  }>;
}

export default function AssignReviewersForm({
  paperId,
  availableReviewers,
}: AssignReviewersFormProps) {
  const [selectedReviewers, setSelectedReviewers] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const toggleReviewer = (reviewerId: string) => {
    const newSet = new Set(selectedReviewers);
    if (newSet.has(reviewerId)) {
      newSet.delete(reviewerId);
    } else {
      newSet.add(reviewerId);
    }
    setSelectedReviewers(newSet);
  };

  const handleAssign = async () => {
    if (selectedReviewers.size === 0) {
      setMessage({ type: "error", text: "Please select at least one reviewer" });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const assignments = Array.from(selectedReviewers).map((reviewerId) => ({
        paper_id: paperId,
        reviewer_id: reviewerId,
        status: "pending",
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks
      }));

      const { error } = await supabase
        .from("review_assignments")
        .insert(assignments);

      if (error) throw error;

      setMessage({
        type: "success",
        text: `Assigned ${selectedReviewers.size} reviewer(s)`,
      });

      // Update paper status
      await supabase
        .from("papers")
        .update({ status: "under_review" })
        .eq("id", paperId);

      setSelectedReviewers(new Set());
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-96 overflow-y-auto border border-border rounded-lg p-4">
        {availableReviewers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviewers available</p>
        ) : (
          availableReviewers.map((reviewer) => (
            <div key={reviewer.id} className="flex items-start gap-3">
              <Checkbox
                id={reviewer.id}
                checked={selectedReviewers.has(reviewer.id)}
                onCheckedChange={() => toggleReviewer(reviewer.id)}
                className="mt-1"
              />
              <Label
                htmlFor={reviewer.id}
                className="flex-1 cursor-pointer"
              >
                <p className="font-medium text-foreground">{reviewer.full_name}</p>
                <p className="text-sm text-muted-foreground">{reviewer.institution}</p>
              </Label>
            </div>
          ))
        )}
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

      <Button
        onClick={handleAssign}
        disabled={isSubmitting || selectedReviewers.size === 0}
        className="w-full"
      >
        {isSubmitting
          ? "Assigning..."
          : `Assign ${selectedReviewers.size} Reviewer${selectedReviewers.size !== 1 ? "s" : ""}`}
      </Button>
    </div>
  );
}
