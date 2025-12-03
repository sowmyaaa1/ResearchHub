import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const paperId = searchParams.get('paperId');

    if (!paperId) {
      return NextResponse.json({ error: "paperId required" }, { status: 400 });
    }

    // Get paper info
    const { data: paper } = await supabase
      .from("papers")
      .select("*")
      .eq("id", paperId)
      .single();

    // Get assignment rules
    const { data: rules } = await supabase
      .from("review_assignment_rules")
      .select("*")
      .single();

    // Get all assignments for this paper
    const { data: assignments } = await supabase
      .from("review_assignments")
      .select("*")
      .eq("paper_id", paperId);

    // Get all review submissions for this paper
    const { data: submissions } = await supabase
      .from("review_submissions")
      .select(`
        *,
        review_assignments!inner(paper_id, status as assignment_status)
      `)
      .eq("review_assignments.paper_id", paperId);

    // Check the exact query used in the submit route
    const { data: completedReviews, error: reviewsError } = await supabase
      .from("review_submissions")
      .select(`
        id,
        recommendation,
        assignment_id,
        status,
        review_assignments!inner(paper_id)
      `)
      .eq("status", "completed")
      .eq("review_assignments.paper_id", paperId);

    const requiredReviews = Number(rules?.reviewer_count) || 2;
    const completedCount = completedReviews?.length || 0;

    // Analyze recommendations
    let recommendations: any[] = [];
    let normalized: string[] = [];
    if (completedReviews) {
      recommendations = completedReviews.map(r => r.recommendation);
      normalized = recommendations.map(rec => {
        if (rec === null || rec === undefined) return null;
        if (typeof rec === 'number') {
          if (rec <= 2) return 'accept';
          if (rec === 3) return 'major_revisions';
          return 'reject';
        }
        const s = String(rec).toLowerCase();
        if (s.includes('accept') || s.includes('minor')) return 'accept';
        if (s.includes('major')) return 'major_revisions';
        if (s.includes('reject')) return 'reject';
        return s;
      }).filter(Boolean) as string[];
    }

    const acceptCount = normalized.filter(rec => rec === 'accept').length;
    const rejectCount = normalized.filter(rec => rec === 'reject' || rec === 'major_revisions').length;
    const shouldPublish = acceptCount > rejectCount;

    return NextResponse.json({
      paperId,
      paper,
      rules,
      assignments,
      submissions,
      completedReviews,
      reviewsError,
      analysis: {
        requiredReviews,
        completedCount,
        meetsRequirement: completedCount >= requiredReviews,
        recommendations,
        normalized,
        acceptCount,
        rejectCount,
        shouldPublish,
        wouldPublish: completedCount >= requiredReviews && shouldPublish
      }
    });

  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: "Debug failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}