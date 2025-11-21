"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";

function ClaimReviewContent() {
  const searchParams = useSearchParams();
  const paperId = searchParams.get('paperId');
  const router = useRouter();
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchPaper = async () => {
      if (!paperId) {
        setError("No paper ID provided");
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data: paperData, error: paperError } = await supabase
          .from("submissions")
          .select("*")
          .eq("id", paperId)
          .single();

        if (paperError) {
          setError("Paper not found");
        } else {
          setPaper(paperData);
        }
      } catch (err) {
        setError("Failed to load paper details");
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [paperId]);

  const handleClaim = async () => {
    if (!paper) return;
    
    setIsClaiming(true);
    setError("");
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("You must be logged in to claim a review");
        setIsClaiming(false);
        return;
      }

      console.log("Claiming review for paper:", paper.id);
      console.log("User ID:", user.id);

      // First, check if paper exists in papers table
      const { data: existingPaper, error: paperCheckError } = await supabase
        .from("papers")
        .select("id, title")
        .eq("id", paper.id)
        .maybeSingle();

      console.log("Existing paper check:", { existingPaper, paperCheckError });

      if (!existingPaper) {
        console.log("Paper doesn't exist in papers table, creating it...");
        
        // Create paper record from submission
        const { data: newPaper, error: paperCreateError } = await supabase
          .from("papers")
          .insert({
            id: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            author_id: paper.submitter_id,
            keywords: paper.keywords,
            status: 'under_review',
            submission_date: paper.created_at,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        console.log("Paper creation result:", { newPaper, paperCreateError });

        if (paperCreateError) {
          setError(`Failed to create paper record: ${paperCreateError.message}`);
          setIsClaiming(false);
          return;
        }
      }

      // Now create the review assignment
      console.log("Creating review assignment...");
      const { data: assignment, error: assignmentError } = await supabase
        .from("review_assignments")
        .insert({
          paper_id: paper.id,
          reviewer_id: user.id,
          status: 'pending',
          assigned_at: new Date().toISOString(),
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      console.log("Assignment creation result:", { assignment, assignmentError });

      if (assignmentError) {
        setError(`Failed to create review assignment: ${assignmentError.message}`);
        setIsClaiming(false);
        return;
      }

      console.log("Successfully claimed review, redirecting...");
      
      // Success - redirect to the review submission page
      router.push(`/reviews/submit/${assignment.id}`);
      
    } catch (err) {
      console.error("Error in handleClaim:", err);
      setError(err instanceof Error ? err.message : "Failed to claim review");
      setIsClaiming(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">Loading paper details...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </Card>
      </main>
    );
  }

  if (!paper) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Paper Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested paper could not be found.</p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Claim Review</h1>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{paper.title}</CardTitle>
            <CardDescription>
              Submitted on {new Date(paper.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Abstract</h3>
              <p className="text-muted-foreground">{paper.abstract}</p>
            </div>

            {paper.keywords && paper.keywords.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {paper.keywords.map((keyword: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-sm"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Review Details</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• You will have 14 days to complete the review</li>
                <li>• Review includes scoring on novelty, technical correctness, clarity, and significance</li>
                <li>• You'll provide detailed feedback and recommendations</li>
                <li>• Completing reviews earns HBAR tokens and reputation points</li>
              </ul>
            </div>

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md">
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleClaim}
                disabled={isClaiming}
                className="flex-1"
              >
                {isClaiming ? "Claiming Review..." : "Claim This Review"}
              </Button>
              <Button asChild variant="outline">
                <Link href={`/submissions/${paper.id}`}>View Full Paper</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ClaimReviewPageByPaper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClaimReviewContent />
    </Suspense>
  );
}