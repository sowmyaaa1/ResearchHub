import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { keywords, expertise, reviewerCount } = await request.json();
    const supabase = await createClient();

    // Upsert rule (single row for simplicity)
    const { error } = await supabase
      .from("review_assignment_rules")
      .upsert([
        {
          id: 1,
          keywords,
          expertise,
          reviewer_count: reviewerCount,
          updated_at: new Date().toISOString(),
        }
      ], { onConflict: "id" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to save rules";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
