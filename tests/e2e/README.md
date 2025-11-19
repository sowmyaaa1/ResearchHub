# Environment Configuration for E2E Testing

This file contains the environment variables required for running the comprehensive E2E test suite against Hedera testnet.

## Required Environment Variables

Create a `.env.test` file in the project root with the following variables:

```bash
# Hedera Network Configuration
TEST_HCS_TOPIC_ID=0.0.123456                    # HCS topic for anchoring IPFS content
TEST_OPERATOR_ACCOUNT_ID=0.0.123456              # Main operator account for HCS operations
TEST_OPERATOR_PRIVATE_KEY=302e020100300506032b6570042204... # Operator private key

# Test Account Configuration (4 accounts needed)
TEST_SUBMITTER_ACCOUNT_ID=0.0.234567             # Account for paper submitter
TEST_SUBMITTER_PRIVATE_KEY=302e020100300506032b6570042204... # Submitter private key

TEST_REVIEWER1_ACCOUNT_ID=0.0.345678             # First reviewer account
TEST_REVIEWER1_PRIVATE_KEY=302e020100300506032b6570042204... # First reviewer private key

TEST_REVIEWER2_ACCOUNT_ID=0.0.456789             # Second reviewer account
TEST_REVIEWER2_PRIVATE_KEY=302e020100300506032b6570042204... # Second reviewer private key

TEST_REVIEWER3_ACCOUNT_ID=0.0.567890             # Third reviewer account
TEST_REVIEWER3_PRIVATE_KEY=302e020100300506032b6570042204... # Third reviewer private key

# IPFS Configuration
TEST_IPFS_GATEWAY=https://ipfs.io/api/v0         # IPFS gateway for content upload

# Database Configuration (inherit from main .env)
DATABASE_URL=postgresql://...                    # Supabase/PostgreSQL connection string
```

## Account Setup

### 1. Create Test Accounts on Hedera Testnet

Visit https://portal.hedera.com/register and create 5 test accounts:
- 1 operator account (for HCS operations)
- 1 submitter account (for paper submissions)
- 3 reviewer accounts (for peer review)

### 2. Fund Accounts

Each account needs sufficient HBAR for testing:
- Operator: 50 HBAR (for HCS topic management)
- Submitter: 20 HBAR (for submission fees)
- Each reviewer: 15 HBAR (for staking + rewards)

### 3. Create HCS Topic

Use the Hedera SDK to create an HCS topic for anchoring IPFS content:

```typescript
import { Client, TopicCreateTransaction, PrivateKey } from '@hashgraph/sdk';

const client = Client.forTestnet();
client.setOperator(operatorAccountId, operatorPrivateKey);

const transaction = new TopicCreateTransaction()
  .setTopicMemo("ResearchHub IPFS Anchoring");

const response = await transaction.execute(client);
const receipt = await response.getReceipt(client);
const topicId = receipt.topicId;

console.log(`Created HCS Topic: ${topicId}`);
```

## Running the Tests

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Environment

```bash
cp .env.test.example .env.test
# Edit .env.test with your actual account details
```

### 3. Run E2E Test Suite

```bash
# Run the complete test suite
pnpm run test:e2e

# Or run directly with TypeScript
npx tsx tests/e2e/e2e-test-runner.ts
```

## Test Scenario

The E2E test executes the complete decentralized workflow:

1. **Setup Test Accounts**: Creates encrypted key blobs and user profiles
2. **Paper Submission**: Uploads paper to IPFS, anchors on HCS, records on-chain
3. **Reviewer Assignment**: Uses AI-powered expertise matching algorithm
4. **Review Claiming**: Simulates staking transactions for review claims
5. **Review Submission**: Uploads reviews to IPFS, submits on-chain
6. **Consensus Evaluation**: Calculates weighted consensus based on verdicts
7. **Reward Distribution**: Distributes rewards/slashing based on consensus alignment
8. **Final Verification**: Validates complete system state and IPFS integrity

## Expected Outcomes

### Success Criteria:
- ✅ All IPFS uploads complete successfully
- ✅ HCS anchoring provides immutable content verification
- ✅ Reviewer assignment matches expertise with paper topics
- ✅ Consensus algorithm correctly processes 3 reviews (2 accept + 1 minor revision)
- ✅ All reviewers receive rewards (aligned with acceptance)
- ✅ Paper achieves "published" status
- ✅ Complete transaction audit trail on Hedera

### Failure Scenarios:
- ❌ Account insufficient balance
- ❌ IPFS gateway connectivity issues
- ❌ Database connection problems
- ❌ Smart contract deployment missing
- ❌ HCS topic permissions incorrect

## Security Notes

⚠️ **Important Security Guidelines**:

1. **Never commit private keys** to version control
2. Use **testnet only** - never mainnet keys in tests
3. **Rotate test keys** regularly
4. **Limit account balances** to minimum required for testing
5. **Use environment isolation** - separate test database from production

## Troubleshooting

### Common Issues:

**"Insufficient account balance"**
- Solution: Fund test accounts with more HBAR

**"HCS topic not found"**  
- Solution: Create HCS topic with operator account

**"IPFS upload timeout"**
- Solution: Check IPFS gateway connectivity

**"Database connection failed"**
- Solution: Verify DATABASE_URL and network access

**"Smart contract not deployed"**
- Solution: Deploy ResearchHubCore contract first

### Debug Mode:

Enable verbose logging:
```bash
DEBUG=researchhub:* pnpm run test:e2e
```

## Integration with CI/CD

For automated testing in CI/CD pipelines:

```yaml
# .github/workflows/e2e-test.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: pnpm install
      - name: Run E2E Tests
        env:
          TEST_HCS_TOPIC_ID: ${{ secrets.TEST_HCS_TOPIC_ID }}
          TEST_OPERATOR_ACCOUNT_ID: ${{ secrets.TEST_OPERATOR_ACCOUNT_ID }}
          TEST_OPERATOR_PRIVATE_KEY: ${{ secrets.TEST_OPERATOR_PRIVATE_KEY }}
          # ... other test env vars
        run: pnpm run test:e2e
```