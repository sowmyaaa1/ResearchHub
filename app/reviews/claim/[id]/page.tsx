"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ClaimReviewPage() {
  const params = useParams();
  const assignmentId = params.id as string;
  const router = useRouter();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();
        const { data: assignment } = await supabase
          .from("review_assignments")
          .select("*, submissions(*)")
          .eq("id", assignmentId)
          .single();

        if (assignment?.submissions) {
          setSubmission(assignment.submissions);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [assignmentId]);

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      const response = await fetch(`/api/submissions/${submission.id}/claim`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to claim review");

      router.push(`/reviews/submit/${assignmentId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to claim");
      setIsClaiming(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!submission) return <div className="text-center py-12">Submission not found</div>;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Claim Review Task</CardTitle>
          <CardDescription>Review this paper and earn 5 HBAR reward</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-2">{submission.title}</h3>
            <p className="text-muted-foreground line-clamp-4">{submission.abstract}</p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Keywords:</span>
              <span>{submission.keywords?.join(", ") || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PDF:</span>
              <a href={submission.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Download
              </a>
            </div>
            {submission.code_url && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Code:</span>
                <a href={submission.code_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Download
                </a>
              </div>
            )}
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-400">
              You will earn <strong>5 HBAR</strong> for completing this review
            </p>
          </div>

          <Button 
            onClick={handleClaim} 
            disabled={isClaiming}
            className="w-full"
            size="lg"
          >
            {isClaiming ? "Claiming..." : "Claim Review Task"}
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
