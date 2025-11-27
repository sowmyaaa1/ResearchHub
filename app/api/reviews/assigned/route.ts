import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check reviewer staking status
    const { data: staking, error: stakingError } = await supabase
      .from("staking")
      .select("staked_amount")
      .eq("reviewer_id", user.id)
      .single();

    if (stakingError) throw stakingError;
    const MIN_STAKE = 100; // Adjust as per your app's minimum stake requirement

    if (!staking || staking.staked_amount < MIN_STAKE) {
      return NextResponse.json({ error: "Reviewer has not staked enough HBAR" }, { status: 403 });
    }

    // Fetch reviewer expertise
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("expertise")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;
    const reviewerExpertise = profile?.expertise?.toLowerCase().split(",").map((e: string) => e.trim()) || [];

    // Fetch assignment rules
    const { data: rule, error: ruleError } = await supabase
      .from("review_assignment_rules")
      .select("keywords, expertise")
      .eq("id", 1)
      .single();

    if (ruleError) throw ruleError;
    const ruleKeywords = rule?.keywords?.toLowerCase().split(",").map((k: string) => k.trim()) || [];
    const ruleExpertise = rule?.expertise?.toLowerCase().split(",").map((e: string) => e.trim()) || [];

    // Get all submissions with "under-review" status
    const { data: submissions, error: submissionError } = await supabase
      .from("submissions")
      .select("*")
      .eq("status", "under-review");

    if (submissionError) throw submissionError;

    // Get paper details for these submissions
    const paperIds = submissions.map((s: any) => s.paper_id);
    let papers: any[] = [];
    if (paperIds.length > 0) {
      const { data: paperData, error: paperError } = await supabase
        .from("papers")
        .select("id, title, keywords")
        .in("id", paperIds);

      if (paperError) throw paperError;

      // Filter papers by reviewer expertise and rule keywords
      papers = paperData.filter((paper: any) => {
        const paperKeywords = Array.isArray(paper.keywords)
          ? paper.keywords.map((k: string) => k.toLowerCase().trim())
          : [];
        // Match if reviewer expertise or rule expertise intersects with paper keywords or rule keywords
        const matchesExpertise = reviewerExpertise.some((exp: string) =>
          paperKeywords.includes(exp) || ruleExpertise.includes(exp)
        );
        const matchesKeywords = ruleKeywords.some((kw: string) =>
          paperKeywords.includes(kw)
        );
        return matchesExpertise || matchesKeywords;
      });

      // Log mapped submitted papers under review for reviewer
      if (user) {
        if (papers.length > 0) {
          console.log(
            "Mapped submitted papers under review for reviewer:",
            papers.map((p: any) => ({ id: p.id, title: p.title, keywords: p.keywords }))
          );
        } else {
          console.log("No mapped submitted papers under review for reviewer:", user.id);
        }
      }
    }

    // Fetch assignment status for this reviewer and paper
    const url = new URL(request.url);
    const paperIdParam = url.searchParams.get("paperId");
    const reviewerIdParam = url.searchParams.get("reviewerId");
    let status: string | null = null;
    if (paperIdParam && reviewerIdParam) {
      console.log("[assigned] Fetching assignment for paper", paperIdParam, "reviewer", reviewerIdParam);
      
      // First check if reviewer has already completed a review for this paper
      // Check by assignment_id since submission_id might be null in some reviews
      const { data: existingAssignments, error: existingAssignmentError } = await supabase
        .from("review_assignments")
        .select(`
          id,
          review_submissions!inner(id, status)
        `)
        .eq("paper_id", paperIdParam)
        .eq("reviewer_id", reviewerIdParam)
        .eq("review_submissions.status", "completed");

      // Also check if assignment incorrectly uses submission_id as paper_id
      const submission = submissions.find((s: any) => s.paper_id === paperIdParam);
      let existingAssignmentsBySubmission: any[] = [];
      if (submission) {
        console.log("[assigned] Checking for assignments with paper_id =", submission.id, "(submission ID) for paper", paperIdParam);
        const { data: assignmentsBySubmission } = await supabase
          .from("review_assignments")
          .select(`
            id,
            review_submissions!inner(id, status)
          `)
          .eq("paper_id", submission.id)  // submission.id used as paper_id
          .eq("reviewer_id", reviewerIdParam)
          .eq("review_submissions.status", "completed");
        
        existingAssignmentsBySubmission = assignmentsBySubmission || [];
        console.log("[assigned] Found assignments by submission ID:", existingAssignmentsBySubmission.length);
      } else {
        console.log("[assigned] No submission found with paper_id =", paperIdParam);
      }

      const allExistingAssignments = [
        ...(existingAssignments || []),
        ...existingAssignmentsBySubmission
      ];
        
      if (existingAssignmentError) {
        console.warn("Assignment lookup error:", existingAssignmentError.message);
      } else if (allExistingAssignments.length > 0) {
        console.log("[assigned] Found existing completed review via assignment, marking as already_reviewed");
        status = "already_reviewed";
        const responsePayload = { papers, submissions, status, assignmentId: null };
        console.log("[assigned] Response payload:", responsePayload);
        return NextResponse.json(responsePayload);
      }
      
      // Then check for assignment status
      const { data: assignment, error: assignmentError } = await supabase
        .from("review_assignments")
        .select("id, status")
        .eq("paper_id", paperIdParam)
        .eq("reviewer_id", reviewerIdParam)
        .maybeSingle();
      if (assignmentError) {
        console.warn("Assignment lookup error (treated as unassigned):", assignmentError.message);
      }
      console.log("[assigned] Assignment query result:", assignment);
      status = assignment?.status || "unassigned";
      const responsePayload = { papers, submissions, status, assignmentId: assignment?.id || null };
      console.log("[assigned] Response payload:", responsePayload);
      return NextResponse.json(responsePayload);
    }

    return NextResponse.json({ papers, submissions, status, assignmentId: null });
  } catch (error) {
    console.error("Fetch assigned reviews error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assigned reviews" },
      { status: 500 }
    );
  }
}
