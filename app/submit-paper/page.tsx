"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useRouter } from 'next/navigation';
import Link from "next/link";

export default function SubmitPaperPage() {
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [codeFile, setCodeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const SUBMISSION_FEE = "10"; // 10 HBAR

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "pdf" | "code") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "pdf") {
      if (file.type !== "application/pdf") {
        setError("PDF file must be in PDF format");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError("PDF file size must be less than 50MB");
        return;
      }
      setPdfFile(file);
    } else {
      if (!["application/zip", "application/gzip", "application/x-tar"].includes(file.type)) {
        setError("Code must be a ZIP or TAR archive");
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError("Code file size must be less than 100MB");
        return;
      }
      setCodeFile(file);
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!pdfFile) {
        throw new Error("PDF file is required");
      }

      if (!codeFile) {
        throw new Error("Code archive is required");
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to submit a paper");
      }

      const pdfFormData = new FormData();
      pdfFormData.append("file", pdfFile);
      const pdfResponse = await fetch("/api/upload", {
        method: "POST",
        body: pdfFormData,
      });

      if (!pdfResponse.ok) {
        throw new Error("Failed to upload PDF");
      }

      const { url: pdfUrl } = await pdfResponse.json();

      let codeUrl = "";
      if (codeFile) {
        const codeFormData = new FormData();
        codeFormData.append("file", codeFile);
        const codeResponse = await fetch("/api/upload", {
          method: "POST",
          body: codeFormData,
        });

        if (!codeResponse.ok) {
          throw new Error("Failed to upload code archive");
        }

        const { url } = await codeResponse.json();
        codeUrl = url;
      }

      const keywordsArray = keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k);

      // Insert into papers table first for reviewer mapping
      const { data: paper, error: papersError } = await supabase
        .from("papers")
        .insert({
          author_id: user.id,
          title,
          abstract,
          keywords: keywordsArray,
          pdf_url: pdfUrl,
          content_url: "",
          status: "submitted",
          submission_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (papersError) throw papersError;

      // Insert into submissions and link paper_id
      const { data: submission, error: dbError } = await supabase
        .from("submissions")
        .insert({
          submitter_id: user.id,
          title,
          abstract,
          keywords: keywordsArray,
          pdf_url: pdfUrl,
          code_url: codeUrl,
          status: "submitted",
          submission_fee_amount: SUBMISSION_FEE,
          paper_id: paper.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Redirect to payment page
      router.push(`/submissions/${submission.id}/pay`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Submit Research Paper</CardTitle>
          <CardDescription>
            Upload your paper and code. Pay {SUBMISSION_FEE} HBAR submission fee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Paper Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter your paper title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abstract">Abstract *</Label>
              <Textarea
                id="abstract"
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                placeholder="Enter your paper abstract"
                rows={5}
                required
              />
              <p className="text-xs text-muted-foreground">
                {abstract.length} characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Separate with commas: machine learning, AI, neural networks"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdf">Paper PDF *</Label>
              <input
                id="pdf"
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileChange(e, "pdf")}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                required
              />
              {pdfFile && (
                <p className="text-sm text-green-600">Selected: {pdfFile.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Code Archive <span className="text-red-500">*</span></Label>
              <input
                id="code"
                type="file"
                accept=".zip,.tar,.tar.gz"
                onChange={(e) => handleFileChange(e, "code")}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                required
              />
              {codeFile && (
                <p className="text-sm text-green-600">Selected: {codeFile.name}</p>
              )}
              <p className="text-xs text-muted-foreground">ZIP or TAR archive, max 100MB</p>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Uploading..." : `Continue to Payment (${SUBMISSION_FEE} HBAR)`}
            </Button>

            {/* Add back to dashboard button */}
            <Button asChild variant="outline" className="w-full mt-4">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
