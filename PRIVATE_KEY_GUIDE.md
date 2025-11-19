# Hedera Private Key Support

This application now supports DER-encoded private keys and automatically converts them to the hex format required by the Hedera SDK.

## What Changed

1. **Signup Process**: Users can now input their Hedera private key during signup
2. **Profile Management**: Private keys can be updated in the user profile with automatic format conversion
3. **Format Support**: The system accepts DER, hex, PEM, and base64 formats
4. **Validation**: Real-time validation ensures keys are in the correct format
5. **Security**: Private keys are automatically converted to the optimal format for Hedera operations

## Database Schema

The `profiles` table now includes a `private_key` column:

```sql
ALTER TABLE public.profiles 
ADD COLUMN private_key text;
```

## Features

### Enhanced Signup Form
- Private key input with validation
- Generate button for new key pairs
- Format detection and conversion
- Security warnings and best practices

### Profile Management
- Update existing private keys
- Convert between formats automatically
- Real-time validation feedback
- Secure storage with conversion

### Blockchain Operations
- Staking/unstaking operations now work with converted keys
- Paper submission fees use proper key format
- All Hedera SDK operations are compatible

## Supported Key Formats

1. **Hex String** (64 characters)
   - Example: `302e020100300506032b657004220420...`

2. **DER Encoded**
   - Raw DER format as hex string
   - Automatically extracts the 32-byte private key

3. **PEM Format**
   - `-----BEGIN PRIVATE KEY-----` blocks
   - Base64 content is decoded and converted

4. **Base64**
   - Direct base64 encoding of the key bytes

## Migration Script

Run the migration script to ensure your database is updated:

```sql
-- /scripts/008_add_private_key_support.sql
```

This script:
- Adds the private_key column if it doesn't exist
- Creates/updates the user signup trigger
- Sets up proper RLS policies
- Grants necessary permissions

## Testing

Use the test page at `/test-key` to verify key conversion:
1. Enter any supported key format
2. Click "Test Conversion" to see the result
3. Generate new keys to test with the "Generate" button

## Security Notes

- Private keys are never transmitted in plain text
- All conversions happen on the client side before storage
- Keys are validated before being accepted
- Users are warned about key security best practices

## Error Handling

Common errors and solutions:

1. **"Invalid private key format"**
   - Ensure the key is in a supported format
   - Try generating a new key if issues persist

2. **"Private key is too short"**
   - DER keys should be at least 32 bytes (64 hex characters)
   - Check for missing characters in the input

3. **"Failed to convert private key"**
   - The format detection failed
   - Try manually selecting the format or using a different key

## Next Steps

After implementing these changes:

1. Users can sign up with their existing Hedera private keys
2. All blockchain operations (staking, paper submission) will work correctly
3. Key format issues are automatically resolved
4. The system provides clear feedback for any key problems

The 10 HBAR deduction for paper submissions will now work properly with the converted private key format.