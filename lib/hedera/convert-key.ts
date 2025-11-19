// Usage: npx ts-node lib/hedera/convert-key.ts <DER_KEY>
import { convertDerToHex } from "./key-utils";

const derKey = process.argv[2];
if (!derKey) {
  console.error("Usage: npx ts-node lib/hedera/convert-key.ts <DER_KEY>");
  process.exit(1);
}

try {
  const hexKey = convertDerToHex(derKey);
  console.log("Hex Private Key:", hexKey);
} catch (err) {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
}
