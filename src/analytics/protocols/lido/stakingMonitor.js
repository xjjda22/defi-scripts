/**
 * Lido liquid staking: APR (Lido API), TVL (DefiLlama), on-chain stETH / wstETH peg vs mainnet.
 */

require("dotenv").config();
const axios = require("axios");
const chalk = require("chalk");
const { ethers } = require("ethers");
const { CHAINS, COMMON_TOKENS } = require("../../../config/chains");
const { getProvider } = require("../../../utils/web3");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const LIDO_APR_URL = "https://eth-api.lido.fi/v1/protocol/steth/apr";
const LIDO_LLAMA_SLUG = "lido";
const API_TIMEOUT_MS = 15000;

const STETH_ABI = [
  "function getPooledEthByShares(uint256 shares) view returns (uint256)",
  "function getTotalPooledEther() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];
const WSTETH_ABI = ["function getStETHByWstETH(uint256 wstETHAmount) view returns (uint256)"];

/** @type {const} */
const ROW_CHAINS = ["ethereum", "arbitrum", "optimism", "base", "polygon"];

/** DefiLlama `currentChainTvls` keys for Lido (sparse). */
const LLAMA_TVL_NAMES = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
};

const W1E18 = 10n ** 18n;

async function fetchLidoAprPct() {
  const { data } = await axios.get(LIDO_APR_URL, {
    timeout: API_TIMEOUT_MS,
    params: { page: 1, pageSize: 2500 },
  });
  const arr = data?.data;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const apr = last?.apr;
  return typeof apr === "number" && Number.isFinite(apr) ? apr : null;
}

/**
 * Mainnet unwrap reference: 1 wstETH → stETH shares → ETH wei (for L2 parity math).
 * @returns {Promise<{ ethWei: bigint, stShares: bigint }|null>}
 */
async function fetchMainnetWstethUnwrapRef() {
  const stAddr = COMMON_TOKENS.stETH?.ethereum;
  const wstAddr = COMMON_TOKENS.wstETH?.ethereum;
  if (!stAddr || !wstAddr || !CHAINS.ethereum?.rpcUrl) return null;
  const provider = getProvider("ethereum");
  const steth = new ethers.Contract(stAddr, STETH_ABI, provider);
  const wsteth = new ethers.Contract(wstAddr, WSTETH_ABI, provider);
  const stShares = await wsteth.getStETHByWstETH(W1E18);
  if (stShares === 0n) return null;
  const ethWei = await steth.getPooledEthByShares(stShares);
  return { ethWei, stShares };
}

async function fetchEthereumStethPegRatio() {
  const stAddr = COMMON_TOKENS.stETH?.ethereum;
  if (!stAddr) return null;
  const provider = getProvider("ethereum");
  const steth = new ethers.Contract(stAddr, STETH_ABI, provider);
  const [pooled, supply] = await Promise.all([steth.getTotalPooledEther(), steth.totalSupply()]);
  if (supply === 0n) return null;
  return Number((pooled * W1E18) / supply) / 1e18;
}

/**
 * Implied ETH per 1 wstETH on `chainKey` vs mainnet unwrap ref (ratio ~1 if bridge sync).
 * @param {{ ethWei: bigint, stShares: bigint }} ref - from fetchMainnetWstethUnwrapRef
 */
async function fetchWstethPegRatio(chainKey, ref) {
  const wstAddr = COMMON_TOKENS.wstETH?.[chainKey];
  if (!wstAddr || !ref || ref.stShares === 0n) return null;
  const provider = getProvider(chainKey);
  const wstL2 = new ethers.Contract(wstAddr, WSTETH_ABI, provider);
  const stL2 = await wstL2.getStETHByWstETH(W1E18);
  const ethL2Equiv = (ref.ethWei * stL2) / ref.stShares;
  return Number(ethL2Equiv) / 1e18;
}

/**
 * @returns {Promise<{
 *   protocol: string,
 *   aprPct: number|null,
 *   aprSource: string,
 *   tvlUsdTotal: number|null,
 *   tvlSource: string,
 *   rows: Array<{
 *     chainKey: string,
 *     name: string,
 *     aprPct: number|null,
 *     tvlUsd: number|null,
 *     pegRatio: number|null,
 *     pegDevPct: number|null,
 *     pegLabel: string,
 *     liquidityNote: string,
 *   }>,
 *   missingRpcForWstethPeg: string[],
 *   l2PegAttempted: number,
 *   l2PegSucceeded: number,
 *   l2PegFirstError: string|null,
 * }>}
 */
async function fetchLidoStakingSnapshot() {
  const [aprPct, llama] = await Promise.all([
    fetchLidoAprPct().catch(() => null),
    fetchDefiLlamaProtocol(LIDO_LLAMA_SLUG).catch(() => null),
  ]);

  const tvlUsdTotal = llama ? lastTvlUsdFromSeries(llama.tvl) : null;
  const chainTvls = llama?.currentChainTvls && typeof llama.currentChainTvls === "object" ? llama.currentChainTvls : {};

  let mainnetPeg = null;
  try {
    if (CHAINS.ethereum?.rpcUrl) mainnetPeg = await fetchEthereumStethPegRatio();
  } catch {
    mainnetPeg = null;
  }

  let unwrapRef = null;
  try {
    unwrapRef = await fetchMainnetWstethUnwrapRef();
  } catch {
    unwrapRef = null;
  }

  const l2PegChains = ROW_CHAINS.filter(ck => ck !== "ethereum" && COMMON_TOKENS.wstETH?.[ck] && CHAINS[ck]?.rpcUrl);
  const missingRpcForWstethPeg = ROW_CHAINS.filter(
    ck => ck !== "ethereum" && COMMON_TOKENS.wstETH?.[ck] && !CHAINS[ck]?.rpcUrl
  );

  const l2PegByChain = {};
  let l2PegAttempted = 0;
  let l2PegSucceeded = 0;
  let l2PegFirstError = null;
  if (unwrapRef && l2PegChains.length) {
    const l2Results = await Promise.all(
      l2PegChains.map(async ck => {
        try {
          const pegRatio = await fetchWstethPegRatio(ck, unwrapRef);
          return { ck, pegRatio, rpcError: null };
        } catch (e) {
          const raw = (e && (e.shortMessage || e.message)) || String(e);
          const rpcError = raw.split("\n")[0].slice(0, 160);
          return { ck, pegRatio: null, rpcError };
        }
      })
    );
    for (const { ck, pegRatio, rpcError } of l2Results) {
      l2PegAttempted += 1;
      if (pegRatio != null) l2PegSucceeded += 1;
      else if (!l2PegFirstError && rpcError) l2PegFirstError = rpcError;
      l2PegByChain[ck] = { pegRatio, rpcError };
    }
  }

  const rows = [];

  for (const chainKey of ROW_CHAINS) {
    const chain = CHAINS[chainKey];
    const llamaName = LLAMA_TVL_NAMES[chainKey];
    const rawTvl = llamaName != null ? chainTvls[llamaName] : undefined;
    const tvlUsd = typeof rawTvl === "number" && Number.isFinite(rawTvl) && rawTvl > 0 ? rawTvl : null;

    let pegRatio = null;
    let pegLabel = "—";
    if (chainKey === "ethereum") {
      pegRatio = mainnetPeg;
      pegLabel = "stETH:ETH";
    } else if (COMMON_TOKENS.wstETH?.[chainKey]) {
      pegLabel = "wstETH:ETHeq";
      const l2 = l2PegByChain[chainKey];
      if (l2) pegRatio = l2.pegRatio;
    }

    const pegDevPct = pegRatio != null && Number.isFinite(pegRatio) ? (pegRatio - 1) * 100 : null;

    rows.push({
      chainKey,
      name: chain?.name || chainKey,
      aprPct,
      tvlUsd,
      pegRatio,
      pegDevPct,
      pegLabel,
      liquidityNote: "—",
    });
  }

  return {
    protocol: "Lido",
    aprPct,
    aprSource: "Lido eth-api.lido.fi (stETH APR series, latest)",
    tvlUsdTotal,
    tvlSource: "DefiLlama protocol/lido",
    rows,
    missingRpcForWstethPeg: missingRpcForWstethPeg.map(ck => `${ck.toUpperCase()}_RPC_URL`),
    l2PegAttempted,
    l2PegSucceeded,
    l2PegFirstError,
  };
}

function printSnapshot(snap) {
  console.log(chalk.cyan.bold("\nLido liquid staking monitor\n"));
  console.log(chalk.gray(`APR source: ${snap.aprSource}`));
  console.log(chalk.gray(`TVL source: ${snap.tvlSource}`));
  if (snap.tvlUsdTotal != null) {
    console.log(chalk.gray(`Total TVL (Llama series): ${formatCurrency(snap.tvlUsdTotal)}`));
  }
  console.log(
    chalk.gray(
      "Note: DefiLlama’s Lido adapter does not split most L2 bridged wstETH; non-Ethereum TVL often shows as —."
    )
  );
  console.log(
    chalk.gray(
      "Peg: Ethereum = pooled ETH per 1 stETH; L2 = same unwrap math vs mainnet ref (needs RPC; bridged wstETH often reverts on-chain).\n"
    )
  );
  if (snap.missingRpcForWstethPeg?.length) {
    console.log(chalk.gray(`L2 peg skipped — set env: ${snap.missingRpcForWstethPeg.join(", ")}`));
  }
  if (!CHAINS.ethereum?.rpcUrl) {
    console.log(chalk.gray("Ethereum on-chain peg skipped — set ETHEREUM_RPC_URL or ETH_RPC_URL."));
  }
  if (snap.l2PegAttempted > 0) {
    if (snap.l2PegSucceeded === 0) {
      console.log(
        chalk.gray(
          `L2 wstETH peg: no chain returned a rate (${snap.l2PegAttempted} RPCs tried). Bridged wstETH often reverts on getStETHByWstETH; rely on mainnet stETH peg above.`
        )
      );
      if (snap.l2PegFirstError) {
        console.log(chalk.gray(`  Example revert: ${snap.l2PegFirstError}`));
      }
    } else if (snap.l2PegSucceeded < snap.l2PegAttempted) {
      console.log(chalk.gray(`L2 wstETH peg: ${snap.l2PegSucceeded}/${snap.l2PegAttempted} chains returned a rate.`));
    }
  }
  console.log("");

  const table = createTable(["Chain", "APR", "TVL (Llama)", "Peg", "Peg Δ", "Liq."], {
    colAligns: ["left", "right", "right", "right", "right", "left"],
  });

  for (const r of snap.rows) {
    const aprStr = r.aprPct != null ? `${r.aprPct.toFixed(2)}%` : "—";
    const tvlStr = r.tvlUsd != null ? formatCurrency(r.tvlUsd) : "—";
    const pegStr = r.pegRatio != null ? r.pegRatio.toFixed(4) : "—";
    const devStr = r.pegDevPct != null ? `${r.pegDevPct >= 0 ? "+" : ""}${r.pegDevPct.toFixed(2)}%` : "—";
    table.push([r.name, aprStr, tvlStr, pegStr, devStr, r.liquidityNote]);
  }
  console.log(table.toString());
}

async function main() {
  installCliSafeStdout();
  try {
    const snap = await fetchLidoStakingSnapshot();
    printSnapshot(snap);
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchLidoStakingSnapshot,
  LIDO_LLAMA_SLUG,
  ROW_CHAINS,
};
