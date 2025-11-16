import { createClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Simple admin check - in production use role-based access
async function checkIsAdmin(userId: string) {
  return userId === process.env.NEXT_PUBLIC_ADMIN_ID || 
         process.env.NODE_ENV === 'development';
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !(await checkIsAdmin(user.id))) {
    redirect("/dashboard");
  }

  const { data: papers } = await supabase
    .from("papers")
    .select("status");

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id");

  const { data: users } = await supabase
    .from("profiles")
    .select("id");

  const paperStats = {
    draft: papers?.filter(p => p.status === "draft").length || 0,
    submitted: papers?.filter(p => p.status === "submitted").length || 0,
    underReview: papers?.filter(p => p.status === "under_review").length || 0,
    published: papers?.filter(p => p.status === "published").length || 0,
    rejected: papers?.filter(p => p.status === "rejected").length || 0,
  };

  const { data: pendingPapers } = await supabase
    .from("papers")
    .select("*, profiles:author_id(full_name)")
    .in("status", ["submitted", "under_review"])
    .order("submission_date", { ascending: true });

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage papers, reviews, and platform settings</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-6 text-center">
            <p className="text-3xl font-bold text-foreground">
              {users?.length || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Researchers</p>
          </Card>
          <Card className="p-6 text-center">
            <p className="text-3xl font-bold text-foreground">
              {papers?.length || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Papers</p>
          </Card>
          <Card className="p-6 text-center">
            <p className="text-3xl font-bold text-foreground">
              {paperStats.published}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Published</p>
          </Card>
          <Card className="p-6 text-center">
            <p className="text-3xl font-bold text-foreground">
              {paperStats.underReview}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Under Review</p>
          </Card>
          <Card className="p-6 text-center">
            <p className="text-3xl font-bold text-foreground">
              {reviews?.length || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Reviews</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="submissions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="submissions">
              Pending Submissions ({paperStats.submitted + paperStats.underReview})
            </TabsTrigger>
            <TabsTrigger value="stats">Paper Statistics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Submissions Tab */}
          <TabsContent value="submissions" className="space-y-4">
            {(!pendingPapers || pendingPapers.length === 0) ? (
              <Card className="p-8 text-center text-muted-foreground">
                No pending submissions
              </Card>
            ) : (
              pendingPapers.map((paper: any) => (
                <Card key={paper.id} className="p-6">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {paper.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        By {paper.profiles?.full_name}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {paper.abstract}
                    </p>
                    <div className="flex gap-2 pt-2">
                      <Button asChild size="sm">
                        <Link href={`/admin/papers/${paper.id}`}>
                          Review & Assign
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/papers/${paper.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Paper Status Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(paperStats).map(([status, count]: [string, number]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm capitalize text-muted-foreground">
                        {status.replace(/_/g, " ")}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2"
                            style={{
                              width: `${
                                (count / (papers?.length || 1)) * 100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground w-8 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Platform Health</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Avg Reviews per Paper
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {papers?.length && reviews?.length
                        ? (reviews.length / papers.length).toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Publication Rate
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {papers?.length
                        ? (
                            (paperStats.published / papers.length) *
                            100
                          ).toFixed(1)
                        : "0"}
                      %
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Platform Settings</h3>
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Review Assignment Rules
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Automatically assign reviewers based on paper keywords and reviewer expertise
                  </p>
                  <Button variant="outline" className="mt-3">
                    Configure Rules
                  </Button>
                </div>
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Email Notifications
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Configure automated email notifications for submissions and reviews
                  </p>
                  <Button variant="outline" className="mt-3">
                    Configure Notifications
                  </Button>
                </div>
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm font-medium text-foreground mb-2">
                    API Keys
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Manage API keys for third-party integrations
                  </p>
                  <Button variant="outline" className="mt-3">
                    Manage Keys
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
