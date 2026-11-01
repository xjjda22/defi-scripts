/**
 * Single Morpho Vault V2 snapshot from Morpho's public GraphQL API (blue-api.morpho.org).
 * Used when a claim names one curated vault that DefiLlama's curator slug does not index
 * (e.g. Keyrock Prime USDC on Arc).
 *
 * Env:
 *   MORPHO_VAULT_ADDRESS  (required) vault address
 *   MORPHO_VAULT_CHAIN_ID (required) numeric chain id (e.g. 5042 for Arc)
 *   MORPHO_VAULT_LABEL    (optional) banner title
 *   MORPHO_VAULT_SMOKE=1  (optional) print a one-line OK and exit non-zero on failure (used by simulate:*:smoke)
 *   MORPHO_VAULT_MIN_USD  (optional, smoke only) fail if totalAssetsUsd is below this value
 *   MORPHO_VAULT_V1=1     (optional, off unless set) read a MetaMorpho (V1) vault via `vaultByAddress` instead of
 *                         `vaultV2ByAddress` (e.g. Gauntlet USDC Prime on Base). Same output fields.
 *   MORPHO_VAULT_APY_DAYS=N (optional, 1-30, with MORPHO_VAULT_V1=1) also print the hourly net APY peak and low over
 *                         the last N days from `historicalState.netApy`, for "APY reached 12.72% before easing" claims
 */

require("dotenv").config();
const axios = require("axios");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const MORPHO_GRAPHQL = "https://blue-api.morpho.org/graphql";

const VAULT_QUERY = `
  query VaultV2($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      asset { symbol }
      totalAssetsUsd
      liquidityUsd
      netApy
      curators { items { name } }
    }
  }
`;

const VAULT_V1_QUERY = `
  query VaultV1($address: String!, $chainId: Int!, $opts: TimeseriesOptions, $withHistory: Boolean!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      asset { symbol }
      liquidity { usd }
      state { totalAssetsUsd netApy curators { name } }
      historicalState @include(if: $withHistory) { netApy(options: $opts) { x y } }
    }
  }
`;

/**
 * MetaMorpho (V1) vault, mapped to the V2 field names used by main().
 * @param {string} address
 * @param {number} chainId
 * @param {number} [apyDays] - 0 to skip the hourly netApy history
 */
async function fetchVaultV1(address, chainId, apyDays = 0) {
  const now = Math.floor(Date.now() / 1000);
  const variables = {
    address,
    chainId,
    withHistory: apyDays > 0,
    opts: { startTimestamp: now - apyDays * 86400, endTimestamp: now, interval: "HOUR" },
  };
  const { data } = await axios.post(
    MORPHO_GRAPHQL,
    { query: VAULT_V1_QUERY, variables },
    {
      timeout: 25_000,
      headers: { "Content-Type": "application/json", "User-Agent": "defi-scripts/morpho-vault" },
    }
  );
  if (data.errors?.length) {
    throw new Error(data.errors.map(e => e.message).join("; "));
  }
  const v = data.data?.vaultByAddress;
  if (!v) throw new Error(`Vault ${address} not found on chain ${chainId}`);
  return {
    address: v.address,
    name: v.name,
    symbol: v.symbol,
    asset: v.asset,
    totalAssetsUsd: v.state?.totalAssetsUsd,
    liquidityUsd: v.liquidity?.usd,
    netApy: v.state?.netApy,
    curators: { items: v.state?.curators || [] },
    apyHistory: v.historicalState?.netApy || [],
  };
}

function printApyHistory(points, days) {
  const pts = (Array.isArray(points) ? points : []).filter(p => p && Number.isFinite(p.x) && numOrNull(p.y) != null);
  if (!pts.length) {
    console.log(chalk.gray("  no hourly net APY history"));
    return;
  }
  const hi = pts.reduce((a, p) => (p.y > a.y ? p : a));
  const lo = pts.reduce((a, p) => (p.y < a.y ? p : a));
  const at = p => new Date(p.x * 1000).toISOString().slice(0, 16).replace("T", " ");
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push([`Hourly net APY peak (last ${days}d)`, `${(hi.y * 100).toFixed(2)}% (${at(hi)} UTC)`]);
  t.push([`Hourly net APY low (last ${days}d)`, `${(lo.y * 100).toFixed(2)}% (${at(lo)} UTC)`]);
  t.push(["Hourly points", String(pts.length)]);
  console.log(chalk.yellow("\nNet APY history (Morpho historicalState, hourly)\n"));
  console.log(t.toString());
}

function numOrNull(v) {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

async function fetchVaultV2(address, chainId) {
  const { data } = await axios.post(
    MORPHO_GRAPHQL,
    { query: VAULT_QUERY, variables: { address, chainId } },
    {
      timeout: 25_000,
      headers: { "Content-Type": "application/json", "User-Agent": "defi-scripts/morpho-vault" },
    }
  );
  if (data.errors?.length) {
    throw new Error(data.errors.map(e => e.message).join("; "));
  }
  const v = data.data?.vaultV2ByAddress;
  if (!v) throw new Error(`Vault ${address} not found on chain ${chainId}`);
  return v;
}

async function main() {
  installCliSafeStdout();
  const address = (process.env.MORPHO_VAULT_ADDRESS || "").trim();
  const chainId = parseInt(process.env.MORPHO_VAULT_CHAIN_ID || "", 10);
  if (!/^0x[a-fA-F0-9]{40}$/.test(address) || !Number.isInteger(chainId)) {
    throw new Error("Set MORPHO_VAULT_ADDRESS (0x…) and MORPHO_VAULT_CHAIN_ID (e.g. 5042)");
  }
  const v1 = process.env.MORPHO_VAULT_V1 === "1";
  const apyDaysRaw = parseInt(process.env.MORPHO_VAULT_APY_DAYS || "", 10);
  const apyDays = v1 && Number.isInteger(apyDaysRaw) && apyDaysRaw >= 1 && apyDaysRaw <= 30 ? apyDaysRaw : 0;
  const v = v1 ? await fetchVaultV1(address, chainId, apyDays) : await fetchVaultV2(address, chainId);
  const label = (process.env.MORPHO_VAULT_LABEL || v.name || address).trim();
  const tvl = numOrNull(v.totalAssetsUsd);
  const apy = numOrNull(v.netApy);

  if (process.env.MORPHO_VAULT_SMOKE === "1") {
    const min = parseFloat(process.env.MORPHO_VAULT_MIN_USD || "0") || 0;
    if (tvl == null || tvl <= 0 || tvl < min) {
      throw new Error(`${label}: totalAssetsUsd ${tvl} below ${min > 0 ? min : "zero"}`);
    }
    console.log(chalk.green(`OK: ${label} (${v.symbol}) | TVL $${tvl.toFixed(0)} | chain ${chainId}`));
    return;
  }

  console.log(chalk.cyan.bold(`\n${label} (${v1 ? "MetaMorpho vault (V1)" : "Morpho Vault V2"})\n`));
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Name", `${v.name} (${v.symbol})`]);
  t.push(["Chain id", String(chainId)]);
  t.push(["Address", v.address]);
  t.push(["Asset", v.asset?.symbol || "—"]);
  t.push(["Curators", (v.curators?.items || []).map(c => c.name).join(", ") || "—"]);
  t.push(["Total assets (USD)", tvl != null ? formatCurrency(tvl) : "—"]);
  t.push(["Liquidity (USD)", numOrNull(v.liquidityUsd) != null ? formatCurrency(numOrNull(v.liquidityUsd)) : "—"]);
  t.push(["Net APY", apy != null ? `${(apy * 100).toFixed(2)}%` : "—"]);
  console.log(t.toString());
  if (apyDays) printApyHistory(v.apyHistory, apyDays);
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}

module.exports = { fetchVaultV2, fetchVaultV1 };
