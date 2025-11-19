// Example: Listen for contract events using Hedera mirror node REST API

import axios from "axios";

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0xa14579aA74Da71433425a8Db8D105D9183a069C6";

// Hedera mirror node REST API endpoint
const MIRROR_NODE_API = "https://testnet.mirrornode.hedera.com/api/v1/contracts";

// Listen for PaperPublished events
export async function getPaperPublishedEvents() {
  const url = `${MIRROR_NODE_API}/${CONTRACT_ADDRESS}/results/logs?topic0=0x${getEventTopic("PaperPublished(uint256,string,address)")}`;
  const response = await axios.get(url);
  return response.data.logs;
}

// Listen for ReviewRecorded events
export async function getReviewRecordedEvents() {
  const url = `${MIRROR_NODE_API}/${CONTRACT_ADDRESS}/results/logs?topic0=0x${getEventTopic("ReviewRecorded(uint256,uint256,address)")}`;
  const response = await axios.get(url);
  return response.data.logs;
}

// Listen for ReviewClaimed events
export async function getReviewClaimedEvents() {
  const url = `${MIRROR_NODE_API}/${CONTRACT_ADDRESS}/results/logs?topic0=0x${getEventTopic("ReviewClaimed(uint256,address,uint256)")}`;
  const response = await axios.get(url);
  return response.data.logs;
}

// Utility: Get event topic hash
function getEventTopic(signature: string): string {
  const { keccak256 } = require("ethers/lib/utils");
  return keccak256(Buffer.from(signature)).slice(2, 66);
}
