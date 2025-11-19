"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useParams, useRouter } from 'next/navigation';
import { useState } from "react";

export default function SubmitReviewPage() {
  const params = useParams();
  const assignmentId = params.id as string;
  const router = useRouter();

  const [novelty, setNovelty] = useState("3");
  const [technical, setTechnical] = useState("3");
  const [clarity, setClarity] = useState("3");
  const [significance, setSignificance] = useState("3");
  const [recommendation, setRecommendation] = useState("accept");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Check staking status
      const { data: staking, error: stakingError } = await supabase
        .from("staking")
        .select("staked_amount")
        .eq("reviewer_id", user.id)
        .maybeSingle();

      console.log("[review-submit] Staking check:", { staking, stakingError, userId: user.id });

      if (stakingError) {
        console.error("[review-submit] Staking query error:", stakingError);
        alert("Error checking staking status. Please try again.");
        setIsSubmitting(false);
        return;
      }

      const MIN_STAKE = 100;
      if (!staking || !staking.staked_amount || staking.staked_amount < MIN_STAKE) {
        alert(`You must stake at least ${MIN_STAKE} HBAR before submitting a review. Please stake and try again.`);
        setIsSubmitting(false);
        return;
      }

      console.log("[review-submit] Staking verified:", staking.staked_amount, "HBAR");

      // Get assignment details
      console.log("[review-submit] Looking up assignment ID:", assignmentId);
      const { data: assignment, error: assignmentError } = await supabase
        .from("review_assignments")
        .select("*")
        .eq("id", assignmentId)
        .maybeSingle();

      console.log("[review-submit] Assignment lookup result:", { assignment, assignmentError });

      if (assignmentError) {
        console.error("[review-submit] Assignment query error:", assignmentError);
        alert("Error finding review assignment. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (!assignment) {
        alert("Review assignment not found. Please check the link and try again.");
        setIsSubmitting(false);
        return;
      }

      // Fetch submission for this paper
      console.log("[review-submit] Looking up submission for paper:", assignment.paper_id);
      const { data: submission, error: submissionError } = await supabase
        .from("submissions")
        .select("id")
        .eq("paper_id", assignment.paper_id)
        .maybeSingle();

      console.log("[review-submit] Submission lookup result:", { submission, submissionError });

      if (submissionError) {
        console.error("[review-submit] Submission query error:", submissionError);
        alert("Error finding paper submission. Please contact support.");
        setIsSubmitting(false);
        return;
      }

      if (!submission) {
        console.log("[review-submit] No submission found, checking papers table directly");
        // Fallback: check if paper exists directly in papers table
        const { data: paper, error: paperError } = await supabase
          .from("papers")
          .select("id, title")
          .eq("id", assignment.paper_id)
          .maybeSingle();
        
        console.log("[review-submit] Paper lookup result:", { paper, paperError });
        
        if (paperError) {
          console.error("[review-submit] Paper query error:", paperError);
          alert("Error finding paper. Please contact support.");
          setIsSubmitting(false);
          return;
        }
        
        if (!paper) {
          alert("Paper not found. The assignment may be invalid.");
          setIsSubmitting(false);
          return;
        }
        
        console.log("[review-submit] Found paper directly:", paper.title);
        // Continue with paper submission instead of submission record
      }

      const response = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          submissionId: submission?.id || null,
          paperId: assignment.paper_id,
          noveltyScore: parseInt(novelty),
          technicalCorrectnessScore: parseInt(technical),
          clarityScore: parseInt(clarity),
          significanceScore: parseInt(significance),
          recommendation,
          comments,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit review");

      router.push("/dashboard?review=submitted");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit review");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Submit Review</CardTitle>
          <CardDescription>Provide detailed feedback and scores</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Scores */}
            <div className="space-y-4">
              <h3 className="font-semibold">Rate the paper (1-5)</h3>

              <div className="space-y-2">
                <Label>Novelty & Originality</Label>
                <RadioGroup value={novelty} onValueChange={setNovelty}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <RadioGroupItem value={i.toString()} id={`novelty-${i}`} />
                      <Label htmlFor={`novelty-${i}`} className="font-normal cursor-pointer">
                        {i === 1 ? "Poor" : i === 5 ? "Excellent" : ""} ({i})
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Technical Correctness</Label>
                <RadioGroup value={technical} onValueChange={setTechnical}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <RadioGroupItem value={i.toString()} id={`technical-${i}`} />
                      <Label htmlFor={`technical-${i}`} className="font-normal cursor-pointer">
                        {i === 1 ? "Incorrect" : i === 5 ? "Perfect" : ""} ({i})
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Clarity & Presentation</Label>
                <RadioGroup value={clarity} onValueChange={setClarity}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <RadioGroupItem value={i.toString()} id={`clarity-${i}`} />
                      <Label htmlFor={`clarity-${i}`} className="font-normal cursor-pointer">
                        {i === 1 ? "Unclear" : i === 5 ? "Very Clear" : ""} ({i})
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Significance & Impact</Label>
                <RadioGroup value={significance} onValueChange={setSignificance}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <RadioGroupItem value={i.toString()} id={`significance-${i}`} />
                      <Label htmlFor={`significance-${i}`} className="font-normal cursor-pointer">
                        {i === 1 ? "Limited" : i === 5 ? "Significant" : ""} ({i})
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>

            {/* Recommendation */}
            <div className="space-y-2">
              <Label>Recommendation</Label>
              <RadioGroup value={recommendation} onValueChange={setRecommendation}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="accept" id="rec-accept" />
                  <Label htmlFor="rec-accept" className="font-normal cursor-pointer">
                    Accept
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="reject" id="rec-reject" />
                  <Label htmlFor="rec-reject" className="font-normal cursor-pointer">
                    Reject
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="comments">Comments & Feedback</Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Provide constructive feedback for the authors..."
                rows={8}
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
              {isSubmitting ? "Submitting..." : "Submit Review & Earn 5 HBAR"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
