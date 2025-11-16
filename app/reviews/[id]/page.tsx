"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';

const recommendations = [
  { value: "accept", label: "Accept" },
  { value: "minor_revision", label: "Minor Revision" },
  { value: "major_revision", label: "Major Revision" },
  { value: "reject", label: "Reject" },
];

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [assignmentId, setAssignmentId] = useState("");
  const [paper, setPaper] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [recommendation, setRecommendation] = useState("accept");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { id } = await params;
      setAssignmentId(id);

      const supabase = createClient();
      const { data: assignment } = await supabase
        .from("review_assignments")
        .select("*, papers(*)")
        .eq("id", id)
        .single();

      if (assignment?.papers) {
        setPaper(assignment.papers);
      }
    })();
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { error: reviewError } = await supabase
        .from("reviews")
        .insert({
          paper_id: paper.id,
          reviewer_id: user.id,
          rating,
          recommendation,
          comment,
        });

      if (reviewError) throw reviewError;

      const { error: assignmentError } = await supabase
        .from("review_assignments")
        .update({ status: "completed" })
        .eq("id", assignmentId);

      if (assignmentError) throw assignmentError;

      router.push("/reviews?success=true");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!paper) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-8 text-center text-muted-foreground">
          Loading...
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Paper Summary */}
        <Card className="p-8 bg-card/50 border-0">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            {paper.title}
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            {paper.abstract}
          </p>
        </Card>

        {/* Review Form */}
        <Card>
          <CardHeader>
            <CardTitle>Your Review</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Rating */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Overall Rating</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`text-3xl transition-colors ${
                        value <= rating ? "text-yellow-500" : "text-muted-foreground"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Recommendation</Label>
                <div className="grid grid-cols-2 gap-3">
                  {recommendations.map((rec) => (
                    <button
                      key={rec.value}
                      type="button"
                      onClick={() => setRecommendation(rec.value)}
                      className={`p-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                        recommendation === rec.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-border"
                      }`}
                    >
                      {rec.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-3">
                <Label htmlFor="comment" className="text-base font-semibold">
                  Detailed Comments
                </Label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Provide constructive feedback about the paper..."
                  rows={8}
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              {error && (
                <div className="p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Submitting..." : "Submit Review"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {paper.pdf_url && (
          <div>
            <Button asChild variant="outline" className="w-full">
              <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer">
                Download Full Paper (PDF)
              </a>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
