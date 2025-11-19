import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export default async function BrowsePage() {
  const supabase = await createClient();

  // Simplified query without foreign key join to avoid RLS issues
  const { data: papers, error } = await supabase
    .from("papers")
    .select("id, title, abstract, keywords, created_at, author_id, status")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  console.log("Browse page - Papers found:", papers?.length || 0);
  console.log("Browse page - Error:", error);

  // Get author names separately to avoid RLS issues
  let papersWithAuthors = papers || [];
  if (papers && papers.length > 0) {
    const authorIds = papers.map(p => p.author_id).filter(Boolean);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    
    // Combine papers with author names
    papersWithAuthors = papers.map(paper => ({
      ...paper,
      author_name: profiles?.find(p => p.id === paper.author_id)?.full_name || "Anonymous"
    }));
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back to Dashboard Button */}
        <div className="mb-6">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Published Research</h1>
          <p className="text-muted-foreground">Browse peer-reviewed papers from our community</p>
        </div>

        <div className="grid gap-4 md:gap-6">
          {papersWithAuthors && papersWithAuthors.length > 0 ? (
            papersWithAuthors.map((paper: any) => (
              <Card key={paper.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl">{paper.title}</CardTitle>
                      <CardDescription>
                        by {paper.author_name} • {new Date(paper.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground line-clamp-2">{paper.abstract}</p>
                  <div className="flex flex-wrap gap-2">
                    {paper.keywords?.map((keyword: string) => (
                      <Badge key={keyword} variant="secondary">{keyword}</Badge>
                    ))}
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/papers/${paper.id}`}>View Paper</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No published papers yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                {papers === null ? "Loading..." : "Be the first to publish research on ResearchHub!"}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
