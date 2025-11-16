import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound, redirect } from 'next/navigation';
import AssignReviewersForm from "@/components/assign-reviewers-form";

export default async function AdminPaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check admin access
  if (!user) {
    redirect("/login");
  }

  const { data: paper } = await supabase
    .from("papers")
    .select("*, profiles:author_id(full_name, institution)")
    .eq("id", id)
    .single();

  if (!paper) {
    notFound();
  }

  const { data: reviewers } = await supabase
    .from("profiles")
    .select("id, full_name, institution")
    .neq("id", paper.author_id);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-primary hover:underline mb-6">
        ← Back to Admin
      </Link>

      <div className="space-y-6">
        {/* Paper Info */}
        <Card className="bg-card/50 border-0 p-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            {paper.title}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            By {paper.profiles?.full_name} • {paper.profiles?.institution}
          </p>
          <div className="flex gap-2 mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {paper.status}
            </span>
            {new Date(paper.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                New
              </span>
            )}
          </div>
          <p className="text-muted-foreground">{paper.abstract}</p>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/papers/${id}`}>View Paper</Link>
          </Button>
          {paper.pdf_url && (
            <Button variant="outline" asChild>
              <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer">
                Download PDF
              </a>
            </Button>
          )}
        </div>

        {/* Assign Reviewers */}
        <Card>
          <CardHeader>
            <CardTitle>Assign Reviewers</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignReviewersForm
              paperId={id}
              availableReviewers={reviewers || []}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
