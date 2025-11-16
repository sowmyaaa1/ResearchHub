"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

interface PublishButtonProps {
  paperId: string;
  status: string;
  blockchainHash?: string;
  onSuccess?: () => void;
}

export default function PublishButton({
  paperId,
  status,
  blockchainHash,
  onSuccess,
}: PublishButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  if (status === "published" && blockchainHash) {
    return (
      <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <p className="text-sm text-green-800 dark:text-green-400">
          ✓ This paper is published and verified on the blockchain
        </p>
        <p className="text-xs text-green-600 dark:text-green-500 mt-1 font-mono break-all">
          Hash: {blockchainHash.slice(0, 32)}...
        </p>
      </div>
    );
  }

  const handlePublish = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/blockchain/publish-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId }),
      });

      if (!response.ok) throw new Error("Failed to publish");

      const data = await response.json();
      setMessage({
        type: "success",
        text: `Paper published! Hash: ${data.transactionHash.slice(0, 16)}...`,
      });

      setTimeout(() => {
        onSuccess?.();
        window.location.reload();
      }, 2000);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to publish",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={handlePublish} disabled={isLoading} size="lg" className="w-full">
        {isLoading ? "Publishing to Blockchain..." : "Publish Paper"}
      </Button>
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
    </div>
  );
}
