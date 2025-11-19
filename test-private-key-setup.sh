#!/bin/bash

# Test script for private key database migration
# Run this to verify the database setup is correct

echo "Testing Hedera Private Key Database Setup..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

echo "✅ Project root directory confirmed"

# Check if migration file exists
if [ -f "scripts/008_add_private_key_support.sql" ]; then
    echo "✅ Migration file found: scripts/008_add_private_key_support.sql"
else
    echo "❌ Migration file not found"
    exit 1
fi

# Check if key utilities exist
if [ -f "lib/hedera/key-utils.ts" ]; then
    echo "✅ Key utilities found: lib/hedera/key-utils.ts"
else
    echo "❌ Key utilities not found"
    exit 1
fi

# Check if components exist
if [ -f "components/private-key-input.tsx" ]; then
    echo "✅ Private key input component found"
else
    echo "❌ Private key input component not found"
    exit 1
fi

# Check if signup page is updated
if grep -q "private_key" app/signup/page.tsx; then
    echo "✅ Signup page includes private key support"
else
    echo "❌ Signup page not updated"
    exit 1
fi

# Check if profile form is updated
if grep -q "PrivateKeyInput" components/profile-form.tsx; then
    echo "✅ Profile form uses enhanced private key input"
else
    echo "❌ Profile form not updated"
    exit 1
fi

echo ""
echo "🎉 All components are in place!"
echo ""
echo "Next steps:"
echo "1. Run the database migration: scripts/008_add_private_key_support.sql"
echo "2. Test the signup process with a private key"
echo "3. Verify staking operations work with converted keys"
echo "4. Test paper submission with 10 HBAR deduction"
echo ""
echo "For testing, visit:"
echo "- /signup - Test the enhanced signup form"
echo "- /profile - Test private key updates"
echo "- /test-key - Test key format conversion"
echo ""