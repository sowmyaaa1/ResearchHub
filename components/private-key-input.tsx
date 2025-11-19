"use client";

import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Key, RefreshCw, AlertCircle, CheckCircle, Copy } from "lucide-react";
import { generateHederaKeyPair, validateHederaPrivateKey, maskPrivateKey } from "@/lib/hedera/key-utils";

interface PrivateKeyInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  showValidation?: boolean;
  showGenerator?: boolean;
}

export default function PrivateKeyInput({
  label = "Hedera Private Key",
  value,
  onChange,
  placeholder = "Enter your Hedera private key",
  required = false,
  showValidation = true,
  showGenerator = true
}: PrivateKeyInputProps) {
  const [showKey, setShowKey] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Validate private key whenever value changes
  useEffect(() => {
    if (value.trim()) {
      const validation = validateHederaPrivateKey(value);
      setIsValid(validation.valid);
      setValidationError(validation.error || null);
    } else {
      setIsValid(false);
      setValidationError(null);
    }
  }, [value]);

  const handleGenerate = () => {
    const keyPair = generateHederaKeyPair();
    onChange(keyPair.privateKey);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="privateKey" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            {label}
            {required && <span className="text-red-500">*</span>}
          </Label>
          
          {showValidation && (
            <div className="flex items-center gap-2">
              {value && isValid && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Valid
                </Badge>
              )}
              {value && !isValid && validationError && (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Invalid
                </Badge>
              )}
            </div>
          )}
        </div>
        
        <div className="relative">
          <Input
            id="privateKey"
            type={showKey ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`pr-24 font-mono text-sm ${
              value && showValidation 
                ? isValid 
                  ? 'border-green-500' 
                  : 'border-red-500' 
                : ''
            }`}
            required={required}
          />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleCopy}
                title="Copy private key"
              >
                <Copy className={`h-3 w-3 ${copied ? 'text-green-600' : ''}`} />
              </Button>
            )}
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? "Hide private key" : "Show private key"}
            >
              {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            
            {showGenerator && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleGenerate}
                title="Generate new key pair"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Validation error */}
        {value && !isValid && validationError && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {validationError}
          </p>
        )}

        {/* Copy confirmation */}
        {copied && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Private key copied to clipboard
          </p>
        )}
      </div>

      {/* Key info card */}
      {value && showValidation && (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-3 pb-3">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-medium ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                  {isValid ? 'Valid Hedera Key' : 'Invalid Format'}
                </span>
              </div>
              
              {isValid && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preview:</span>
                    <span className="font-mono">{maskPrivateKey(value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Length:</span>
                    <span className="font-mono">{value.length} chars</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
        <p className="text-xs text-amber-800 dark:text-amber-400">
          <strong>Security Notice:</strong> Your private key is stored securely and never transmitted in plain text. 
          Keep it safe - it's required for all blockchain transactions including staking and paper submissions.
        </p>
      </div>
    </div>
  );
}