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

      // Get assignment details
      const { data: assignment } = await supabase
        .from("review_assignments")
        .select("*")
        .eq("id", assignmentId)
        .single();

      if (!assignment) throw new Error("Assignment not found");

      const response = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          submissionId: assignment.paper_id,
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
