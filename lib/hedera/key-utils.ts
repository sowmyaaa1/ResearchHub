/**
 * Utility functions for Hedera private key conversion
 * Handles conversion between different key formats for Hedera SDK compatibility
 */

import { PrivateKey } from "@hashgraph/sdk";

/**
 * Convert DER-encoded private key to hex format for Hedera SDK
 */
export function convertDerToHex(derKey: string): string {
  try {
    // Remove any whitespace, newlines, and common prefixes/suffixes
    let cleanKey = derKey
      .replace(/\s+/g, '')
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
      .replace(/-----END EC PRIVATE KEY-----/g, '');

    // If it's already a hex string, return it
    if (/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      return cleanKey;
    }

    // If it's base64, convert to hex
    if (isBase64(cleanKey)) {
      const buffer = Buffer.from(cleanKey, 'base64');
      return buffer.toString('hex');
    }

    // If it starts with 0x, remove the prefix
    if (cleanKey.startsWith('0x')) {
      cleanKey = cleanKey.substring(2);
    }

    // Try to use Hedera SDK to parse the key
    try {
      const privateKey = PrivateKey.fromString(derKey);
      return privateKey.toStringRaw();
    } catch {
      // If Hedera SDK fails, continue with manual parsing
    }

    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(cleanKey)) {
      throw new Error('Invalid private key format');
    }

    // Ensure 32-byte (64 character) format
    if (cleanKey.length === 64) {
      return cleanKey;
    }

    // If it's longer, try to extract the 32-byte key part
    if (cleanKey.length > 64) {
      // For DER format, the private key is usually at the end
      return cleanKey.slice(-64);
    }

    throw new Error('Private key is too short');
  } catch (error) {
    throw new Error(`Failed to convert private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Normalize a Hedera private key provided in various possible formats.
 * Attempts:
 * 1. Direct SDK parsing (user may already provide SDK compatible string)
 * 2. DER/Base64/PEM conversion via convertDerToHex
 * 3. Extraction of trailing 64 hex chars if longer blob
 * Returns raw hex suitable for PrivateKey.fromString plus detected key type.
 */
export function normalizeHederaPrivateKey(input: string): { raw: string; type: 'ed25519' | 'secp256k1' | 'unknown'; original: string } {
  const original = input;
  let cleaned = (input || '').trim();

  // If JSON accidentally passed
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') cleaned = parsed.trim();
    } catch {}
  }

  // Remove common PEM markers early
  cleaned = cleaned
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');

  const ed25519DerPrefix = '302e020100300506032b657004220420'; // Standard DER prefix
  let candidateList: string[] = [];

  candidateList.push(cleaned);

  try {
    candidateList.push(convertDerToHex(cleaned));
  } catch {}

  // If longer than 64 hex chars, push tail 64 as candidate
  if (/^[0-9a-fA-F]{65,}$/.test(cleaned)) {
    candidateList.push(cleaned.slice(-64));
  }

  // Deduplicate
  candidateList = [...new Set(candidateList)].filter(Boolean);

  for (const cand of candidateList) {
    try {
      const pk = PrivateKey.fromString(cand);
      // toStringRaw gives raw hex for ed25519; for ECDSA we may need different handling
      let raw = pk.toStringRaw?.() || cand;
      // Detect type heuristically
      let type: 'ed25519' | 'secp256k1' | 'unknown' = 'unknown';
      if (cand.startsWith(ed25519DerPrefix) || raw.length === 64) type = 'ed25519';
      // Hedera SDK ECDSA(secp256k1) raw may differ; length check placeholder
      if (raw.length === 64 && type === 'unknown') type = 'ed25519';
      return { raw, type, original };
    } catch {
      // continue
    }
  }

  return { raw: cleaned, type: 'unknown', original };
}

/**
 * Validate if a string is valid base64
 */
function isBase64(str: string): boolean {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch {
    return false;
  }
}

/**
 * Validate Hedera private key format
 */
export function validateHederaPrivateKey(key: string): { valid: boolean; error?: string } {
  try {
    const hexKey = convertDerToHex(key);
    
    // Test with Hedera SDK
    const privateKey = PrivateKey.fromString(hexKey);
    const publicKey = privateKey.publicKey;
    
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid key format' 
    };
  }
}

/**
 * Generate a new Hedera private key pair
 */
export function generateHederaKeyPair(): { privateKey: string; publicKey: string; accountId?: string } {
  const privateKey = PrivateKey.generate();
  const publicKey = privateKey.publicKey;
  
  return {
    privateKey: privateKey.toString(),
    publicKey: publicKey.toString(),
  };
}

/**
 * Mask private key for display (show first and last 4 characters)
 */
export function maskPrivateKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}