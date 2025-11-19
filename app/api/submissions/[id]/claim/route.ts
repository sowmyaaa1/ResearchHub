import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

      const { id: submissionId } = await params;

    const { data: existingAssignment } = await supabase
      .from("review_assignments")
      .select("*")
      .eq("paper_id", submissionId)
      .eq("reviewer_id", user.id)
      .single();

    if (existingAssignment) {
      return NextResponse.json(
        { error: "Already claimed this review" },
        { status: 400 }
      );
    }

    // Create new assignment
    const { data: assignment, error } = await supabase
      .from("review_assignments")
      .insert({
        paper_id: submissionId,
        reviewer_id: user.id,
        status: "claimed",
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Claim error:", error);
    return NextResponse.json(
      { error: "Failed to claim review" },
      { status: 500 }
    );
  }
}
