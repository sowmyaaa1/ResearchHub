"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ConfigureRulesPage() {
  const [keywords, setKeywords] = useState("");
  const [expertise, setExpertise] = useState("");
  const [reviewerCount, setReviewerCount] = useState(2);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/admin/save-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          expertise,
          reviewerCount,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setMessage("Rules saved successfully.");
      } else {
        setMessage(result.error || "Failed to save rules.");
      }
    } catch (err) {
      setMessage("Failed to save rules.");
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Card className="p-8 space-y-6">
        <h1 className="text-2xl font-bold mb-4">Configure Review Assignment Rules</h1>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div>
            <Label htmlFor="keywords">Required Paper Keywords (comma separated)</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="e.g. blockchain, AI, cryptography"
            />
          </div>
          <div>
            <Label htmlFor="expertise">Reviewer Expertise (comma separated)</Label>
            <Input
              id="expertise"
              value={expertise}
              onChange={e => setExpertise(e.target.value)}
              placeholder="e.g. distributed systems, security"
            />
          </div>
          <div>
            <Label htmlFor="reviewerCount">Number of Reviewers per Paper</Label>
            <Input
              id="reviewerCount"
              type="number"
              min={1}
              value={reviewerCount}
              onChange={e => setReviewerCount(Number(e.target.value))}
            />
          </div>
          <Button type="submit" className="w-full">Save Rules</Button>
        </form>
        {message && (
          <div className="mt-4 p-3 rounded bg-green-50 text-green-800 text-sm">
            {message}
          </div>
        )}
        <Button
          variant="outline"
          className="mt-6 w-full"
          asChild
        >
          <a href="/admin">Back to Dashboard</a>
        </Button>
      </Card>
    </main>
  );
}
