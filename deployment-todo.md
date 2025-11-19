# EVM & Hedera Integration Deployment Checklist## Ensure all transactions are done via deployed Hedera smart contracts

- [x] Analyze all transaction flows in the app
- [x] Identify logic handled in the app instead of smart contracts
- [x] Refactor app logic to call Hedera smart contracts for transactions
- [x] Verify all transaction flows use smart contract logic
- [ ] Test and validate the implementation


- [ ] Analyze app requirements and transaction flows
- [ ] Design Solidity smart contracts for all required transactions
- [ ] Implement .sol files for contracts (publish, review, claim, pay, stake, etc.)
- [ ] Deploy contracts to Hedera EVM or compatible testnet
- [ ] Integrate contract calls in backend (API routes)
- [ ] Connect frontend to backend for contract interactions
- [ ] Integrate Hedera real-time features (mirror node, SDK)
- [ ] Test all transaction flows end-to-end
- [ ] Document deployment and integration steps
