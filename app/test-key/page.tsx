"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PrivateKeyInput from "@/components/private-key-input";
import { convertDerToHex, validateHederaPrivateKey, generateHederaKeyPair } from "@/lib/hedera/key-utils";

export default function TestPrivateKeyPage() {
  const [testKey, setTestKey] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleTest = () => {
    try {
      const validation = validateHederaPrivateKey(testKey);
      const hexKey = validation.valid ? convertDerToHex(testKey) : null;
      
      setResult({
        valid: validation.valid,
        error: validation.error,
        originalKey: testKey,
        hexKey,
        originalLength: testKey.length,
        hexLength: hexKey?.length || 0,
      });
    } catch (error) {
      setResult({
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        originalKey: testKey,
        hexKey: null,
      });
    }
  };

  const generateTestKey = () => {
    const keyPair = generateHederaKeyPair();
    setTestKey(keyPair.privateKey);
  };

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Private Key Format Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PrivateKeyInput
            label="Test Private Key"
            value={testKey}
            onChange={setTestKey}
            placeholder="Enter any private key format to test conversion"
            showValidation={true}
            showGenerator={true}
          />
          
          <div className="flex gap-2">
            <Button onClick={handleTest} disabled={!testKey}>
              Test Conversion
            </Button>
            <Button onClick={generateTestKey} variant="outline">
              Generate Test Key
            </Button>
          </div>

          {result && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Conversion Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong>Valid:</strong> {result.valid ? "✅ Yes" : "❌ No"}
                  </div>
                  <div>
                    <strong>Error:</strong> {result.error || "None"}
                  </div>
                </div>
                
                {result.valid && (
                  <>
                    <div>
                      <strong>Original Length:</strong> {result.originalLength} chars
                    </div>
                    <div>
                      <strong>Hex Length:</strong> {result.hexLength} chars
                    </div>
                    <div>
                      <strong>Hex Key (first 32 chars):</strong>
                      <code className="block mt-1 p-2 bg-muted rounded text-xs break-all">
                        {result.hexKey?.substring(0, 32)}...
                      </code>
                    </div>
                  </>
                )}

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                  <strong>How it works:</strong> The conversion function attempts to detect the input format 
                  (DER, hex, PEM, base64) and converts it to the 64-character hex format required by Hedera SDK.
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}