/**
 * Testnet faucets for the showcase. Every URL was requested and returned HTTP 200
 * on 2026-10-10 (redirects followed). Official or widely used faucets only.
 */

const TESTNETS = [
  {
    id: "sepolia",
    chain: "ethereum",
    name: "Ethereum Sepolia",
    faucets: [
      { name: "Google Cloud", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
      { name: "Alchemy", url: "https://www.alchemy.com/faucets/ethereum-sepolia" },
      { name: "QuickNode", url: "https://faucet.quicknode.com/ethereum/sepolia" },
    ],
  },
  {
    id: "base-sepolia",
    chain: "base",
    name: "Base Sepolia",
    faucets: [
      { name: "Coinbase CDP", url: "https://portal.cdp.coinbase.com/products/faucet" },
      { name: "Base docs", url: "https://docs.base.org/get-started/get-funds" },
      { name: "Alchemy", url: "https://www.alchemy.com/faucets/base-sepolia" },
    ],
  },
  {
    id: "arbitrum-sepolia",
    chain: "arbitrum",
    name: "Arbitrum Sepolia",
    faucets: [
      { name: "Alchemy", url: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
      { name: "QuickNode", url: "https://faucet.quicknode.com/arbitrum/sepolia" },
    ],
  },
  {
    id: "op-sepolia",
    chain: "optimism",
    name: "OP Sepolia",
    faucets: [
      { name: "Optimism Console", url: "https://console.optimism.io/faucet" },
      { name: "Optimism docs", url: "https://docs.optimism.io/app-developers/tools-sdks/faucets" },
      { name: "Alchemy", url: "https://www.alchemy.com/faucets/optimism-sepolia" },
    ],
  },
  {
    id: "polygon-amoy",
    chain: "polygon",
    name: "Polygon Amoy",
    faucets: [
      { name: "Google Cloud", url: "https://cloud.google.com/application/web3/faucet/polygon/amoy" },
      { name: "Alchemy", url: "https://www.alchemy.com/faucets/polygon-amoy" },
    ],
  },
  {
    id: "bsc-testnet",
    chain: "bsc",
    name: "BNB Smart Chain testnet",
    faucets: [{ name: "BNB Chain", url: "https://www.bnbchain.org/en/testnet-faucet" }],
  },
  {
    id: "avalanche-fuji",
    chain: "avalanche",
    name: "Avalanche Fuji",
    faucets: [{ name: "Core", url: "https://core.app/tools/testnet-faucet/?subnet=c&token=c" }],
  },
  {
    id: "scroll-sepolia",
    chain: "scroll",
    name: "Scroll Sepolia",
    faucets: [{ name: "Scroll docs", url: "https://docs.scroll.io/en/user-guide/faucet/" }],
  },
  {
    id: "zksync-sepolia",
    chain: "zksync",
    name: "zkSync Sepolia",
    faucets: [{ name: "Alchemy", url: "https://www.alchemy.com/faucets/zksync-sepolia" }],
  },
];

const CHAINLINK = { name: "Chainlink faucets", url: "https://faucets.chain.link/" };

function faucetsForChains(chainKeys) {
  const wanted = new Set((chainKeys || []).map(key => String(key).toLowerCase()));
  const rows = TESTNETS.filter(row => wanted.has(row.chain));
  return rows.length ? rows : TESTNETS.filter(row => row.chain === "ethereum");
}

module.exports = { TESTNETS, CHAINLINK, faucetsForChains };
