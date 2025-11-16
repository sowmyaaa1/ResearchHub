import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function BrowsePage() {
  const supabase = await createClient();

  const { data: papers } = await supabase
    .from("submissions")
    .select("id, title, abstract, keywords, created_at, submitter_id, profiles(full_name)")
    .eq("status", "finalized")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Published Research</h1>
          <p className="text-muted-foreground">Browse peer-reviewed papers from our community</p>
        </div>

        <div className="grid gap-4 md:gap-6">
          {papers && papers.length > 0 ? (
            papers.map((paper: any) => (
              <Card key={paper.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl">{paper.title}</CardTitle>
                      <CardDescription>
                        by {paper.profiles?.full_name || "Anonymous"} • {new Date(paper.created_at).toLocaleDateString()}
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
