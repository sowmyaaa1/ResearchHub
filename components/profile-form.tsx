"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from 'next/navigation';

export default function ProfileForm({ initialProfile, userId }: any) {
  const [fullName, setFullName] = useState(initialProfile?.full_name || "");
  const [institution, setInstitution] = useState(initialProfile?.institution || "");
  const [bio, setBio] = useState(initialProfile?.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const router = useRouter();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          institution,
          bio,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      setMessage({ type: "success", text: "Profile updated successfully!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Dr. Jane Smith"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="institution">Institution</Label>
        <Input
          id="institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="University of Excellence"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about your research interests..."
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          rows={4}
        />
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
