import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { redirect } from 'next/navigation';

export default async function ReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user profile to determine role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single();

  const userRole = profile?.role || "viewer";

  // Redirect admins to admin interface
  if (userRole === "admin") {
    redirect("/admin");
  }

  // Content for reviewers
  let pendingAssignments = [];
  let completedReviews = [];

  // Content for submitters  
  let submittedPapers = [];
  let receivedReviews = [];

  if (userRole === "reviewer") {
    // Fetch pending assignments with submission details
    const { data: assignments, error: assignmentsError } = await supabase
      .from("review_assignments")
      .select(`
        *,
        submissions (
          id,
          title,
          abstract,
          submitter_id
        )
      `)
      .eq("reviewer_id", user?.id)
      .eq("status", "claimed")
      .order("due_date", { ascending: true });

    console.log("Pending assignments query:", { assignments, assignmentsError });

    // Process assignments to remove duplicates and flatten data
    if (assignments && assignments.length > 0 && !assignmentsError) {
      const uniqueAssignments = new Map();
      
      assignments.forEach((assignment: any) => {
        const submissionId = assignment.submissions?.id || assignment.submission_id;
        if (submissionId && !uniqueAssignments.has(submissionId)) {
          uniqueAssignments.set(submissionId, {
            ...assignment,
            title: assignment.submissions?.title || 'Untitled Paper',
            abstract: assignment.submissions?.abstract || 'No abstract available',
            submission_id: submissionId
          });
        }
      });
      
      pendingAssignments = Array.from(uniqueAssignments.values());
    } else {
      pendingAssignments = [];
    }

    // Fetch completed reviews with submission details
    console.log("Fetching completed reviews for user:", user?.id);
    
    const { data: reviews, error: reviewsError } = await supabase
      .from("review_submissions")
      .select("*")
      .eq("reviewer_id", user?.id)
      .in("status", ["submitted", "completed"]);
    
    console.log("Completed reviews query:", { reviews, reviewsError });
    
    // Process completed reviews data and fetch submission details
    if (reviews && reviews.length > 0 && !reviewsError) {
      const reviewsWithTitles = [];
      
      for (const review of reviews) {
        let title = 'Unknown Paper';
        let abstract = 'No abstract available';
        let submission = null;
        
        console.log(`Processing review:`, review);
        
        // Try to get assignment details first since that's what we know works
        if (review.assignment_id) {
          console.log(`Looking up assignment: ${review.assignment_id}`);
          
          const { data: assignmentData, error: assignmentError } = await supabase
            .from("review_assignments")
            .select("*")
            .eq("id", review.assignment_id)
            .maybeSingle();
          
          console.log(`Assignment lookup result:`, { assignmentData, assignmentError });
          
          if (assignmentData) {
            // Try multiple approaches to get the paper details
            
            // Approach 1: Check if assignment has submission_id
            if (assignmentData.submission_id) {
              const { data: submissionData } = await supabase
                .from("submissions")
                .select("title, abstract")
                .eq("id", assignmentData.submission_id)
                .maybeSingle();
              
              console.log(`Submission via assignment lookup:`, submissionData);
              if (submissionData) {
                title = submissionData.title || title;
                abstract = submissionData.abstract || abstract;
              }
            }
            
            // Approach 2: Check if assignment has paper_id (legacy)
            if (title === 'Unknown Paper' && assignmentData.paper_id) {
              const { data: paperData } = await supabase
                .from("papers")
                .select("title, abstract")
                .eq("id", assignmentData.paper_id)
                .maybeSingle();
              
              console.log(`Paper via assignment lookup:`, paperData);
              if (paperData) {
                title = paperData.title || title;
                abstract = paperData.abstract || abstract;
              }
            }
          }
        }
        
        // Final fallback - try direct submission_id if available
        if (title === 'Unknown Paper' && review.submission_id) {
          const { data: submissionData } = await supabase
            .from("submissions")
            .select("title, abstract")
            .eq("id", review.submission_id)
            .maybeSingle();
          
          console.log(`Direct submission lookup:`, submissionData);
          if (submissionData) {
            title = submissionData.title || title;
            abstract = submissionData.abstract || abstract;
          }
        }
        
        console.log(`Final title for review ${review.id}: ${title}`);
        
        reviewsWithTitles.push({
          ...review,
          title,
          abstract,
          submission_details: submission
        });
      }
      
      completedReviews = reviewsWithTitles;
      console.log("Final completed reviews with titles:", completedReviews);
    } else {
      completedReviews = [];
    }
  } else if (userRole === "submitter") {
    // Fetch submitter content - papers they've submitted
    const { data: papers } = await supabase
      .from("submissions")
      .select("*")
      .eq("submitter_id", user?.id)
      .order("created_at", { ascending: false });
    submittedPapers = papers || [];

    // Fetch reviews received on their papers
    const { data: reviews } = await supabase
      .from("reviews")
      .select("*, papers(title)")
      .in("paper_id", submittedPapers.map(p => p.id))
      .order("created_at", { ascending: false });
    receivedReviews = reviews || [];
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {userRole === "reviewer" ? "Peer Review" : "My Paper Reviews"}
            </h1>
            <p className="text-muted-foreground">
              {userRole === "reviewer" 
                ? "Review papers and provide feedback to the research community"
                : "Track reviews and feedback on your submitted papers"
              }
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        {userRole === "reviewer" ? (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">
                Pending Reviews ({pendingAssignments?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedReviews?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {(!pendingAssignments || pendingAssignments.length === 0) ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <p>No pending reviews at this time</p>
                  <p className="text-sm mt-2">New review assignments will appear here when available</p>
                </Card>
              ) : (
                pendingAssignments.map((assignment: any, index: number) => (
                  <Card key={assignment.id || assignment.assignment_id || `assignment-${index}`} className="p-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {assignment.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {assignment.abstract?.substring(0, 200)}...
                        </p>
                      </div>

                      {assignment.due_date && (
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </p>
                      )}

                      <Button asChild>
                        <Link href={`/reviews/submit/${assignment.id}`}>
                          Start Review
                        </Link>
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {(!completedReviews || completedReviews.length === 0) ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <p>You haven&apos;t completed any reviews yet</p>
                  <p className="text-sm mt-2">Completed reviews will be listed here</p>
                </Card>
              ) : (
                completedReviews.map((review: any, index: number) => (
                  <Card key={review.id || `review-${index}`} className="p-6">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {review.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex gap-1">
                          <span className="text-muted-foreground">Scores:</span>
                          <span>Novelty: {review.novelty_score}/5</span>
                          <span>Technical: {review.technical_correctness_score}/5</span>
                          <span>Clarity: {review.clarity_score}/5</span>
                        </div>
                        <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                          {review.recommendation || 'No recommendation'}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comments && (
                        <p className="text-sm text-muted-foreground mt-2">
                          "{review.comments.substring(0, 100)}..."
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Status: {review.status} • Assignment ID: {review.assignment_id}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        ) : userRole === "submitter" ? (
          <Tabs defaultValue="papers" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="papers">
                My Papers ({submittedPapers?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="feedback">
                Reviews Received ({receivedReviews?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="papers" className="space-y-4">
              {(!submittedPapers || submittedPapers.length === 0) ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <p>You haven't submitted any papers yet</p>
                  <p className="text-sm mt-2">Submit your first paper to start receiving reviews</p>
                  <Button asChild className="mt-4">
                    <Link href="/submit-paper">Submit Paper</Link>
                  </Button>
                </Card>
              ) : (
                submittedPapers.map((paper: any) => (
                  <Card key={paper.id} className="p-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {paper.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {paper.abstract?.substring(0, 200)}...
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          paper.status === "published" ? "bg-green-100 text-green-800" :
                          paper.status === "under-review" ? "bg-blue-100 text-blue-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {paper.status}
                        </span>
                        <span className="text-muted-foreground">
                          Submitted: {new Date(paper.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <Button asChild variant="outline" size="sm">
                        <Link href={`/submissions/${paper.id}`}>View Details</Link>
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4">
              {(!receivedReviews || receivedReviews.length === 0) ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <p>No reviews received yet</p>
                  <p className="text-sm mt-2">Reviews from peer reviewers will appear here</p>
                </Card>
              ) : (
                receivedReviews.map((review: any) => (
                  <Card key={review.id} className="p-6">
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {review.papers?.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm mt-2">
                          <div className="flex gap-1">
                            {[...Array(review.rating)].map((_, i) => (
                              <span key={i} className="text-yellow-500">★</span>
                            ))}
                          </div>
                          <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                            {review.recommendation}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {review.feedback && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-800">
                            {review.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            <p>This page is for reviewers and submitters</p>
            <p className="text-sm mt-2">
              {userRole === "viewer" 
                ? "Complete your profile to become a reviewer or submitter"
                : "Your role doesn't have access to reviews"
              }
            </p>
            <Button asChild className="mt-4">
              <Link href="/profile">Update Profile</Link>
            </Button>
          </Card>
        )}
      </div>
    </main>
  );
}
