"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import AssignReviewersForm from "@/components/assign-reviewers-form";

export default function EditPaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [paperId, setPaperId] = useState("");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableReviewers, setAvailableReviewers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { id } = await params;
      setPaperId(id);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data: paper } = await supabase
        .from("papers")
        .select("*")
        .eq("id", id)
        .eq("author_id", user?.id)
        .single();

      if (paper) {
        setTitle(paper.title);
        setAbstract(paper.abstract);
        setKeywords(paper.keywords?.join(", ") || "");
      }

      // Fetch available reviewers
      const { data: reviewers } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "reviewer");
      setAvailableReviewers(reviewers || []);

      setIsLoading(false);
    })();
  }, [params]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const supabase = createClient();
      const keywordsArray = keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k);

      const { error: updateError } = await supabase
        .from("papers")
        .update({
          title,
          abstract,
          keywords: keywordsArray,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paperId);

      if (updateError) throw updateError;

      router.push(`/papers/${paperId}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Edit Paper</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abstract">Abstract</Label>
              <textarea
                id="abstract"
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Separate with commas"
              />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={isSaving} className="flex-1">
                {isSaving ? "Saving..." : "Save Changes"}
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
          {/* Reviewer Assignment Form */}
          <div className="mt-8">
            <AssignReviewersForm paperId={paperId} availableReviewers={availableReviewers} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
