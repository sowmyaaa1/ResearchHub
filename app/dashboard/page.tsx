import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import WalletBalance from "@/components/wallet-balance";
import { redirect } from 'next/navigation';

// Force this page to always fetch fresh data
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Debug logging for profile role detection
  console.log("Dashboard: User ID:", user.id);
  console.log("Dashboard: Profile data:", profile);
  console.log("Dashboard: Profile error:", profileError);

  const role = profile?.role || "viewer";

  // Show viewer dashboard with onboarding experience
  if (role === "viewer") {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground">Welcome to ResearchHub</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Hello {profile?.full_name || user.email}! 👋 Ready to explore decentralized academic publishing?
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">Browse Research</h2>
                  <p className="text-muted-foreground mb-4">
                    Discover peer-reviewed research papers published by our global community of researchers.
                  </p>
                  <Button asChild>
                    <Link href="/browse">Explore Papers</Link>
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">Submit Research</h2>
                  <p className="text-muted-foreground mb-4">
                    Share your research with the world. Provide your Hedera private key to become a submitter and start publishing papers.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/profile?intent=submitter">Become Submitter</Link>
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">Peer Review</h2>
                  <p className="text-muted-foreground mb-4">
                    Earn HBAR tokens by reviewing research papers. Help maintain quality while building reputation.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/profile?intent=reviewer">Become Reviewer</Link>
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
                  <p className="text-muted-foreground mb-4">
                    Connect your Hedera wallet to participate in our decentralized ecosystem and earn HBAR.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/connect-wallet">Connect Wallet</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 rounded-lg p-6 border border-border">
            <h3 className="text-xl font-semibold mb-2 text-foreground">How ResearchHub Works</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2">1</div>
                <h4 className="font-medium text-foreground">Submit Research</h4>
                <p className="text-sm text-muted-foreground">Upload your paper to IPFS with Hedera anchoring</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2">2</div>
                <h4 className="font-medium text-foreground">Peer Review</h4>
                <p className="text-sm text-muted-foreground">Expert reviewers stake HBAR and provide feedback</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2">3</div>
                <h4 className="font-medium text-foreground">Consensus & Rewards</h4>
                <p className="text-sm text-muted-foreground">Smart contracts handle consensus and distribute rewards</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Fetch submissions if submitter
  let submissions = [];
  let hasExpertise = true; // Track if reviewer has specified expertise
  
  if (role === "submitter") {
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("submitter_id", user.id)
      .order("created_at", { ascending: false });
    submissions = data || [];
  }

  // Fetch reviews if reviewer
  let availableReviews: any[] = [];
  let assignedReviews: any[] = [];
  let myReviews: any[] = [];
  if (role === "reviewer") {
    // Check if reviewer has minimum stake (currently using a simple check)
    // For now, let's allow all reviewers to see available reviews
    const { data: profile } = await supabase
      .from("profiles")
      .select("expertise")
      .eq("id", user.id)
      .single();
    
    const reviewerExpertise = profile?.expertise?.toLowerCase().split(",").map((e: string) => e.trim()) || [];
    
    // Only show papers if reviewer has specified expertise
    if (reviewerExpertise.length === 0 || reviewerExpertise[0] === '') {
      console.log("Reviewer has no expertise specified - no papers shown");
      hasExpertise = false;
      availableReviews = [];
      assignedReviews = [];
      myReviews = [];
    } else {
      console.log("Reviewer expertise:", reviewerExpertise);
      
      // 1. Get assigned reviews from review_assignments table with paper details
    const { data: assignedData, error: assignedError } = await supabase
      .from("review_assignments")
      .select(`
        *,
        submissions (
          id,
          title,
          abstract,
          keywords,
          submitter_id
        )
      `)
      .eq("reviewer_id", user.id)
      .eq("status", "claimed");
    
    console.log("=== REVIEWER DASHBOARD DEBUG ===");
    console.log("User ID:", user.id);
    console.log("User Email:", user.email);
    console.log("User Role:", role);
    console.log("Reviewer Expertise:", reviewerExpertise);
    console.log("Assigned Reviews Query Error:", assignedError);
    console.log("Assigned Reviews Data:", assignedData);
    
    if (assignedData && assignedData.length > 0 && !assignedError) {
      // Process the data to flatten submission details and remove duplicates
      const uniqueAssignments = new Map();
      
      assignedData.forEach((assignment: any) => {
        const submissionId = assignment.submissions?.id || assignment.submission_id;
        if (submissionId && !uniqueAssignments.has(submissionId)) {
          uniqueAssignments.set(submissionId, {
            ...assignment,
            title: assignment.submissions?.title || 'Untitled Paper',
            abstract: assignment.submissions?.abstract || 'No abstract available',
            keywords: assignment.submissions?.keywords || 'No keywords provided',
            submission_id: submissionId
          });
        }
      });
      
      assignedReviews = Array.from(uniqueAssignments.values());
      console.log("Processed assigned reviews (duplicates removed):", assignedReviews);
    } else {
      console.log("No assigned reviews or query failed:", assignedError);
    }

    // 2. Get papers available for manual claiming (not yet assigned to anyone or you)
    const { data: paperData, error: queryError } = await supabase
      .from("submissions")
      .select("id, title, abstract, keywords, status, submitter_id, created_at, paper_id")
      .in("status", ["under-review", "submitted"])
      .neq("submitter_id", user.id); // Exclude papers submitted by this reviewer
    
    console.log("Available Papers Query Error:", queryError);
    console.log("Raw query result:", paperData);
    console.log("Query parameters:", {
      statuses: ["under-review", "submitted"],
      excludeSubmitterId: user.id,
      userEmail: user.email
    });
    
    // Filter out papers that are already published or completed
    let filteredPapers = [];
    if (paperData && paperData.length > 0) {
      console.log("Checking each paper's published status...");
      for (const paper of paperData) {
        // Check if this paper has been published
        const { data: publishedPaper } = await supabase
          .from("papers")
          .select("id, status")
          .eq("id", paper.id)
          .maybeSingle();
        
        console.log(`Paper ${paper.title} - Submission Status: ${paper.status}, Published Status: ${publishedPaper?.status || 'Not in papers table'}`);
        
        // Only include if not published/finalized
        if (!publishedPaper || (publishedPaper.status !== 'published' && publishedPaper.status !== 'finalized')) {
          filteredPapers.push(paper);
        } else {
          console.log(`Excluding paper ${paper.title} - already published`);
        }
      }
    }
    
    console.log("Filtered available papers (excluding published):", filteredPapers);
    
    // Also check ALL submissions to see what exists - try different approaches
    console.log("Trying to query submissions table...");
    
    // Try 1: Basic query
    const { data: allSubmissions, error: allError } = await supabase
      .from("submissions")
      .select("id, title, status, submitter_id")
      .order("created_at", { ascending: false });
    
    console.log("Basic submissions query result:", allSubmissions, "error:", allError);
    
    // Try 2: Check if it's a different table name
    const { data: papers, error: papersError } = await supabase
      .from("papers")
      .select("id, title, status, author_id")
      .order("created_at", { ascending: false });
    
    console.log("Papers table query result:", papers, "error:", papersError);
    
    // Try 3: Check RLS and current user permissions
    const { data: currentUser } = await supabase.auth.getUser();
    console.log("Current Supabase user:", currentUser.user?.id, currentUser.user?.email);
    console.log("Expected user ID match:", currentUser.user?.id === user.id);
    
    // Try 4: Test a simple count query
    const { count, error: countError } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true });
    
    console.log("Submissions count:", count, "count error:", countError);
    
    console.log("ALL SUBMISSIONS QUERY:", allSubmissions);
    console.log("All submissions error:", allError);
    
    if (allSubmissions) {
      console.log("Submission breakdown:");
      allSubmissions.forEach((sub, index) => {
        console.log(`${index + 1}. ${sub.title} - Status: ${sub.status} - Yours: ${sub.submitter_id === user.id ? 'YES' : 'NO'}`);
      });
    }
    
    console.log("Fetched submissions for review:", paperData);
    console.log("Paper count:", paperData?.length || 0);
    
    if (filteredPapers.length > 0) {
      // Filter out papers that are already assigned to you
      const alreadyAssignedPaperIds = assignedReviews.map(r => r.id);
      let potentialPapers = filteredPapers.filter(paper => !alreadyAssignedPaperIds.includes(paper.id));
      
      // Filter papers based on expertise match
      availableReviews = potentialPapers.filter(paper => {
        if (!paper.keywords || paper.keywords.length === 0) return false;
        
        const paperKeywords = paper.keywords.map((k: string) => k.toLowerCase().trim());
        
        // Check if reviewer has expertise that matches paper keywords
        const hasExpertiseMatch = reviewerExpertise.some((expertise: string) => {
          return paperKeywords.some((keyword: string) => {
            // Direct match
            if (expertise.includes(keyword) || keyword.includes(expertise)) return true;
            
            // Semantic matching for common terms
            const semanticMatches: { [key: string]: string[] } = {
              'ai': ['artificial intelligence', 'machine learning', 'deep learning', 'neural networks'],
              'machine learning': ['ml', 'ai', 'artificial intelligence', 'data science'],
              'blockchain': ['distributed ledger', 'cryptocurrency', 'smart contracts', 'dlt'],
              'cryptography': ['encryption', 'security', 'crypto', 'privacy'],
              'computer vision': ['image processing', 'cv', 'object detection'],
              'nlp': ['natural language processing', 'text mining', 'language models'],
              'cybersecurity': ['security', 'information security', 'network security'],
              'data science': ['analytics', 'big data', 'data mining', 'statistics']
            };
            
            // Check semantic matches
            if (semanticMatches[expertise]?.includes(keyword) || 
                semanticMatches[keyword]?.includes(expertise)) {
              return true;
            }
            
            return false;
          });
        });
        
        return hasExpertiseMatch;
      });
      
      console.log(`Expertise filtering: ${potentialPapers.length} papers -> ${availableReviews.length} matches`);
    }
    console.log("Available (unassigned) papers:", availableReviews);
    console.log("=== END DEBUG ===");

    // Fetch completed reviews - simplified query with better debugging
    console.log("Fetching completed reviews for user:", user.id);
    
    const { data: allReviewSubmissions, error: reviewError } = await supabase
      .from("review_submissions")
      .select("*")
      .eq("reviewer_id", user.id);
    
    console.log("All review submissions:", { allReviewSubmissions, error: reviewError });
    
    // Filter for completed/submitted reviews
    const completedReviewsData = allReviewSubmissions?.filter(review => 
      review.status === 'submitted' || review.status === 'completed'
    ) || [];
    
    myReviews = completedReviewsData;
    
    console.log("Completed reviews query result:", { completed: completedReviewsData, error: reviewError });
    console.log("Number of completed reviews:", myReviews.length);
    }
  }

  // Calculate and update reputation score based on blockchain logic
  let blockchainReputation = profile?.reputation_score || 0;
  
  if (role === "submitter" || role === "reviewer") {
    try {
      console.log("=== REPUTATION CALCULATION DEBUG ===");
      console.log("User ID:", user.id);
      console.log("Current reputation in profile:", profile?.reputation_score);
      console.log("Role:", role);
      
      // Count completed reviews more accurately
      const completedReviewsCount = myReviews?.length || 0;
      console.log("My reviews data:", myReviews);
      console.log("Completed reviews count:", completedReviewsCount);
      
      // Count published papers
      const publishedPapersCount = submissions?.filter((s: any) => s.status === 'published').length || 0;
      console.log("Published papers count:", publishedPapersCount);
      
      // Enhanced reputation calculation: Base 100 + 50 per review + 100 per published paper
      const calculatedReputation = 100 + (completedReviewsCount * 50) + (publishedPapersCount * 100);
      
      console.log(`Reputation calculation: Base(100) + Reviews(${completedReviewsCount}*50) + Papers(${publishedPapersCount}*100) = ${calculatedReputation}`);
      
      // Always update if there's a discrepancy or if we have new activity
      if (calculatedReputation !== profile.reputation_score || completedReviewsCount > 0) {
        console.log(`Updating reputation: ${profile.reputation_score} -> ${calculatedReputation}`);
        blockchainReputation = calculatedReputation;
        
        // Update the database with the new reputation
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            reputation_score: calculatedReputation,
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id);
        
        if (updateError) {
          console.error("Failed to update reputation in database:", updateError);
        } else {
          console.log("Reputation updated successfully in database");
        }
      } else {
        console.log("No reputation update needed");
      }
      
      console.log("=== END REPUTATION DEBUG ===");
    } catch (error) {
      console.error("Failed to calculate blockchain reputation:", error);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Reputation Score</h3>
          <p className="text-3xl font-bold mt-2">{blockchainReputation}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Wallet Balance</h3>
          <div className="text-3xl font-bold mt-2">
            <WalletBalance userId={user.id} />
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Role</h3>
          <p className="text-lg font-semibold mt-2 capitalize">{role}</p>
        </Card>
      </div>

      {/* Role-based content */}
      {role === "submitter" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">My Submissions</h2>
            <Button asChild className="mb-4">
              <Link href="/submit-paper">+ Submit New Paper</Link>
            </Button>
          </div>

          <div className="grid gap-4">
            {submissions.length > 0 ? (
              submissions.map((sub: any) => (
                <Card key={sub.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{sub.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{sub.abstract.substring(0, 100)}...</p>
                      <div className="mt-3 flex gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          sub.status === "finalized" ? "bg-green-100 text-green-800" :
                          sub.status === "under-review" ? "bg-blue-100 text-blue-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/submissions/${sub.id}`}>View</Link>
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground">No submissions yet</p>
            )}
          </div>
        </div>
      )}

      {role === "reviewer" && (
        <Tabs defaultValue="assigned" className="space-y-6">
          <TabsList>
            <TabsTrigger value="assigned">Assigned Reviews ({assignedReviews.length})</TabsTrigger>
            <TabsTrigger value="available">Available Papers ({availableReviews.length})</TabsTrigger>
            <TabsTrigger value="completed">My Reviews ({myReviews.length})</TabsTrigger>
            <TabsTrigger value="staking">Staking</TabsTrigger>
          </TabsList>

          <TabsContent value="assigned" className="space-y-4">
            <h2 className="text-2xl font-bold">Assigned Review Tasks</h2>
            <p className="text-muted-foreground">Papers that have been automatically assigned to you for review</p>
            {assignedReviews.length > 0 ? (
              <div className="grid gap-4">
                {assignedReviews.map((paper: any, index: number) => (
                  <Card key={paper.id || paper.assignment_id || `assignment-${index}`} className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold">{paper.title}</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                          {paper.abstract?.substring(0, 150)}...
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          <strong>Keywords:</strong> {Array.isArray(paper.keywords) ? paper.keywords.join(", ") : paper.keywords || "No keywords provided"}
                        </p>
                        {paper.assigned_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Assigned: {new Date(paper.assigned_at).toLocaleDateString()}
                          </p>
                        )}
                        {paper.due_date && (
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(paper.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button asChild>
                          <Link href={`/reviews/submit/${paper.id || paper.assignment_id}`}>Start Review</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href={`/submissions/${paper.submission_id}`}>View Paper</Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No Assigned Reviews</h3>
                <p className="text-muted-foreground mb-4">
                  No papers have been automatically assigned to you yet. Check the "Available Papers" tab to claim reviews manually.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="available" className="space-y-4">
            <h2 className="text-2xl font-bold">Available Papers for Review</h2>
            <p className="text-muted-foreground">Papers you can claim for review based on your expertise</p>
            {availableReviews.length > 0 ? (
              <div className="grid gap-4">
                {availableReviews.map((paper: any) => (
                  <Card key={paper.id} className="p-6">
                    <h3 className="font-semibold">{paper.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      {paper.keywords?.join(", ") || "No keywords provided"}
                    </p>
                      <div className="flex gap-2 mt-4">
                        <Button asChild>
                          <Link href={`/papers/${paper.paper_id || paper.id}`}>View Paper</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href={`/submissions/${paper.id}`}>View Submission</Link>
                        </Button>
                        <Button asChild variant="secondary">
                          <Link href={`/reviews/claim-paper?paperId=${paper.id}`}>Claim Review</Link>
                        </Button>
                      </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                {role === "reviewer" && !hasExpertise ? (
                  <>
                    <h3 className="text-lg font-medium mb-2">Expertise Required</h3>
                    <p className="text-muted-foreground mb-4">
                      You need to specify your areas of expertise to see available papers for review.
                    </p>
                    <Button asChild>
                      <Link href="/profile">Update Your Profile</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium mb-2">No Review Tasks Available</h3>
                    <p className="text-muted-foreground mb-4">
                      There are currently no papers awaiting review that match your expertise. Review tasks will appear here when:
                    </p>
                    <ul className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-1 mb-4">
                      <li>• Papers are submitted that match your expertise areas</li>
                      <li>• You meet the minimum staking requirements</li>
                      <li>• Papers are not already assigned to other reviewers</li>
                    </ul>
                  </>
                )}
                
                {/* Debug information */}
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left text-xs">
                  <h4 className="font-medium mb-2">🔍 Debug Info:</h4>
                  <p><strong>Your Role:</strong> {role}</p>
                  <p><strong>Your ID:</strong> {user.id}</p>
                  <p><strong>Your Expertise:</strong> {profile?.expertise || 'Not set'}</p>
                  <p><strong>Assigned Reviews:</strong> {assignedReviews.length} papers</p>
                  <p><strong>Available Papers:</strong> {availableReviews.length} papers</p>
                  <div className="mt-2">
                    <strong>Query Logic:</strong> Looking for papers with status 'under-review' or 'submitted', 
                    excluding papers you submitted and papers already assigned to you.
                    Check server console for detailed paper data.
                  </div>
                  {assignedReviews.length === 0 && availableReviews.length === 0 && (
                    <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900 rounded text-yellow-800 dark:text-yellow-200">
                      <strong>Possible issues:</strong>
                      <ul className="list-disc list-inside mt-1">
                        <li>No papers have been submitted yet</li>
                        <li>All submitted papers were submitted by you</li>
                        <li>Assignment rules aren't configured properly</li>
                        <li>Papers are in wrong status (check for 'draft' status papers)</li>
                      </ul>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 justify-center mt-4">
                  <Button asChild variant="outline">
                    <Link href="/profile">Update Expertise</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/staking">Manage Staking</Link>
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <h2 className="text-2xl font-bold">My Completed Reviews</h2>
            {myReviews.length > 0 ? (
              <div className="grid gap-4">
                {myReviews.map((review: any) => (
                  <Card key={review.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{review.paper_id}</h3>
                        <p className="text-sm text-muted-foreground mt-1">Status: {review.status}</p>
                      </div>
                      {review.reward_amount && (
                        <p className="font-semibold text-green-600">+{review.reward_amount} HBAR</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No completed reviews</p>
            )}
          </TabsContent>

          <TabsContent value="staking">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Staking Management</h3>
              <p className="text-muted-foreground mb-4">Minimum stake required: 100 HBAR</p>
              <Button asChild>
                <Link href="/staking">Manage Stake</Link>
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}
