#!/usr/bin/env tsx

// E2E Test Runner Script
// Execute: pnpm run test:e2e or npx tsx tests/e2e/run-tests.ts

import { config } from 'dotenv';
import { resolve } from 'path';
import { runE2ETests } from './e2e-test-runner';

// Load test environment variables
const envPath = resolve(process.cwd(), '.env.test');
config({ path: envPath });

// Verify required environment variables
function validateEnvironment(): void {
  const required = [
    'TEST_HCS_TOPIC_ID',
    'TEST_OPERATOR_ACCOUNT_ID', 
    'TEST_OPERATOR_PRIVATE_KEY',
    'TEST_SUBMITTER_ACCOUNT_ID',
    'TEST_SUBMITTER_PRIVATE_KEY',
    'TEST_REVIEWER1_ACCOUNT_ID',
    'TEST_REVIEWER1_PRIVATE_KEY',
    'TEST_REVIEWER2_ACCOUNT_ID', 
    'TEST_REVIEWER2_PRIVATE_KEY',
    'TEST_REVIEWER3_ACCOUNT_ID',
    'TEST_REVIEWER3_PRIVATE_KEY',
    'DATABASE_URL'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   ${key}`));
    console.error('\n📝 Please create .env.test file with required variables.');
    console.error('   See tests/e2e/README.md for setup instructions.\n');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

// Main execution
async function main(): Promise<void> {
  try {
    console.log('🚀 ResearchHub Decentralized E2E Test Suite');
    console.log('=' .repeat(50));
    
    // Validate environment
    validateEnvironment();
    
    // Run the complete test suite
    await runE2ETests();
    
    console.log('\n🎉 All E2E tests completed successfully!');
    console.log('📊 System is ready for deployment to Hedera testnet.');
    
  } catch (error) {
    console.error('\n💥 E2E test suite failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    
    console.error('\n🔧 Please review the error and ensure:');
    console.error('   • All test accounts are funded with sufficient HBAR');
    console.error('   • HCS topic exists and is accessible');
    console.error('   • IPFS gateway is reachable');
    console.error('   • Database connection is working');
    console.error('   • Smart contracts are deployed (if required)');
    
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}