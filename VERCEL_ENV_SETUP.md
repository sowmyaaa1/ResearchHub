# Vercel Environment Variables Setup Guide

## CRITICAL: Required Environment Variables

Your app is failing because these environment variables are missing in production. You MUST add them to Vercel:

### 1. Supabase Configuration (REQUIRED for app to work)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Staking System (REQUIRED for wallet functionality)
```
STAKING_CONTRACT_ADDRESS=0.0.7281579
STAKING_ACCOUNT_PRIVATE_KEY=3030020100300706052b8104000a0422042041c6b4b954c336eb0a70bb09439e9f1547d3c794390c814624f6e5eff99125e5
```

### 3. Hedera Configuration (for blockchain functionality)
```
HEDERA_OPERATOR_PRIVATE_KEY=your_hedera_private_key
HEDERA_OPERATOR_ACCOUNT_ID=your_hedera_account_id
HCS_TOPIC_ID=your_hedera_consensus_topic_id
HEDERA_NETWORK=testnet
```

### 4. IPFS Configuration (optional)
```
IPFS_GATEWAY=https://ipfs.io/api/v0
```

## URGENT: How to Add Environment Variables in Vercel:

1. Go to https://vercel.com/dashboard
2. Select your project (reasearchhub)
3. Go to Settings → Environment Variables
4. Add each variable one by one:
   - Click "Add New"
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: (your Supabase URL)
   - Environments: Check Production, Preview, Development
   - Click "Save"
5. Repeat for ALL variables above

## Finding Your Supabase Values:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Project API keys → anon/public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## After Adding ALL Variables:

1. Go to your project dashboard in Vercel
2. Go to Deployments tab
3. Click the 3-dots menu on your latest deployment
4. Click "Redeploy"
5. OR run: `vercel deploy --prod`

## Current Error:
The "No API key found" error means `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing from production.

## Current Deployment URL:
https://reasearchhub-fcrp131yg-sowmya272002-4299s-projects.vercel.app

**The app will NOT work until you add these environment variables!**