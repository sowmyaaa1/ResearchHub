// Debug script for browser console - run this when logged in as janesmith@gmail.com
// Open browser dev tools and paste this in the console

console.log("=== REVIEWER DEBUG SCRIPT ===");

// Test the same query the dashboard uses
async function debugReviewerIssue() {
  try {
    console.log("1. Testing Supabase connection...");
    
    // Get current user
    const { data: { user }, error: userError } = await window.supabase.auth.getUser();
    if (userError) {
      console.error("User error:", userError);
      return;
    }
    console.log("Current user:", user);

    // Get user profile
    console.log("2. Fetching user profile...");
    const { data: profile, error: profileError } = await window.supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    if (profileError) {
      console.error("Profile error:", profileError);
      return;
    }
    console.log("User profile:", profile);
    
    // Check role
    if (profile.role !== 'reviewer') {
      console.warn("❌ User role is not 'reviewer', it's:", profile.role);
      return;
    }
    console.log("✅ User is a reviewer");

    // Test the exact dashboard query
    console.log("3. Testing dashboard query...");
    const { data: paperData, error: paperError } = await window.supabase
      .from("submissions")
      .select("id, title, keywords, status, submitter_id")
      .in("status", ["under-review", "submitted"])
      .neq("submitter_id", user.id);
    
    if (paperError) {
      console.error("Paper query error:", paperError);
      return;
    }
    
    console.log("📄 Papers found:", paperData);
    console.log("📊 Paper count:", paperData?.length || 0);
    
    if (!paperData || paperData.length === 0) {
      console.warn("❌ No papers found for review");
      
      // Let's check why - get all submissions
      console.log("4. Checking all submissions...");
      const { data: allSubmissions, error: allError } = await window.supabase
        .from("submissions")
        .select("id, title, status, submitter_id");
      
      if (allError) {
        console.error("All submissions query error:", allError);
        return;
      }
      
      console.log("All submissions:", allSubmissions);
      console.log("Total submissions:", allSubmissions?.length || 0);
      
      // Filter by status
      const reviewableSubmissions = allSubmissions?.filter(s => 
        s.status === 'under-review' || s.status === 'submitted'
      );
      console.log("Submissions with reviewable status:", reviewableSubmissions);
      
      // Filter out own submissions
      const otherSubmissions = reviewableSubmissions?.filter(s => 
        s.submitter_id !== user.id
      );
      console.log("Submissions NOT submitted by current user:", otherSubmissions);
      
    } else {
      console.log("✅ Papers available for review:");
      paperData.forEach((paper, index) => {
        console.log(`${index + 1}. ${paper.title} (Status: ${paper.status})`);
      });
    }
    
  } catch (error) {
    console.error("Debug script error:", error);
  }
}

// Add supabase to window if not already there
if (typeof window !== 'undefined' && !window.supabase) {
  console.log("Setting up Supabase client...");
  // You'll need to import this properly in the actual app
  console.warn("Supabase client not found on window. Make sure you're on a page with Supabase initialized.");
} else {
  debugReviewerIssue();
}