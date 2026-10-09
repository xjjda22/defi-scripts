/**
 * Morpho Blue supply and borrow on one Ethereum market.
 * Morpho address matches src/simulation/lending/simulateMorphoFork.js
 * and https://docs.morpho.org/get-started/resources/addresses/
 * Market id comes from the Morpho API (WETH collateral, USDC loan) or MORPHO_MARKET_ID.
 */

const axios = require("axios");
const { ethers } = require("ethers");
const { CHAINS, COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { MORPHO_BLUE } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish, unavailable } = require("./runtime");

const MORPHO_GRAPHQL = "https://blue-api.morpho.org/graphql";
const ABI = [
  "function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
  "function supply((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256, uint256)",
  "function supplyCollateral((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data)",
  "function borrow((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256, uint256)",
  "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
];

async function fetchMarketId(chainId, loan, collateral) {
  const query = `
    query Q($w: MarketFilters) {
      markets(first: 1, orderBy: SupplyAssetsUsd, orderDirection: Desc, where: $w) {
        items { uniqueKey marketId }
      }
    }
  `;
  const { data } = await axios.post(
    MORPHO_GRAPHQL,
    {
      query,
      variables: {
        w: {
          chainId_in: [chainId],
          listed: true,
          loanAssetAddress_in: [loan],
          collateralAssetAddress_in: [collateral],
        },
      },
    },
    { timeout: 25_000, headers: { "Content-Type": "application/json", "User-Agent": "defi-scripts/morpho-fork" } }
  );
  if (data.errors?.length) throw new Error(data.errors.map(error => error.message).join("; "));
  const item = data.data?.markets?.items?.[0];
  const id = item?.uniqueKey || item?.marketId;
  if (!id) throw new Error("Morpho API returned no WETH/USDC market");
  return id.startsWith("0x") ? id : `0x${id}`;
}

function paramsTuple(raw) {
  return {
    loanToken: raw[0],
    collateralToken: raw[1],
    oracle: raw[2],
    irm: raw[3],
    lltv: raw[4],
  };
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = "morpho";
  const action = process.env.FORK_ACTION || "supply";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const chainInfo = CHAINS[chain];
  const usdc = COMMON_TOKENS.USDC?.[chain];
  const weth = COMMON_TOKENS.WETH?.[chain];
  if (!chainInfo || !usdc || !weth) {
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: "USDC/WETH missing" });
  }
  let marketId = (process.env.MORPHO_MARKET_ID || "").trim();
  try {
    if (!marketId) marketId = await fetchMarketId(chainInfo.chainId, usdc, weth);
  } catch (err) {
    const message = err.message || String(err);
    return finish({
      skipped: unavailable(message) || /no WETH|timeout|Network|ENOTFOUND|Morpho API/i.test(message),
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: message,
    });
  }
  if (!ethers.isHexString(marketId, 32)) {
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: "market id is not 32 bytes" });
  }
  const provider = getProvider(chain);
  const morpho = new ethers.Contract(MORPHO_BLUE, ABI, provider);
  let market;
  try {
    market = paramsTuple(await morpho.idToMarketParams(marketId));
  } catch (err) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: err.shortMessage || err.message,
    });
  }
  try {
    if (action === "supply") return await supplyLoan({ chain, protocol, action, ctx, usdc, market, marketId, provider });
    if (action === "borrow") return await borrowLoan({ chain, protocol, action, ctx, usdc, weth, market, marketId, provider });
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: `Unknown action ${action}` });
  } catch (err) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: err.shortMessage || err.message,
    });
  }
}

async function supplyLoan({ chain, protocol, action, ctx, usdc, market, marketId, provider }) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "1000", 6);
  const signer = await impersonateFunded(chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const morphoRead = new ethers.Contract(MORPHO_BLUE, ABI, provider);
  const before = (await morphoRead.position(marketId, user)).supplyShares;
  const token = new ethers.Contract(usdc, ["function approve(address,uint256) returns (bool)"], signer);
  const morpho = new ethers.Contract(MORPHO_BLUE, ABI, signer);
  await (await token.approve(MORPHO_BLUE, amount)).wait();
  const tx = await morpho.supply(market, amount, 0, user, "0x");
  const receipt = await tx.wait();
  const after = (await morphoRead.position(marketId, user)).supplyShares;
  const ok = after > before;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `supplyShares=${before}->${after}`,
    detail: `market ${marketId}\nsupplied ${formatUnits(amount, 6)} USDC\nsupplyShares ${before} -> ${after}\ntx ${receipt.hash}`,
    error: ok ? null : "supply shares did not increase",
  });
}

async function borrowLoan({ chain, protocol, action, ctx, usdc, weth, market, marketId, provider }) {
  const collateral = ethers.parseEther(process.env.FORK_COLLATERAL || "1");
  const borrow = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(chain, "WETH", weth, collateral);
  const user = await signer.getAddress();
  const morphoRead = new ethers.Contract(MORPHO_BLUE, ABI, provider);
  const usdcToken = new ethers.Contract(usdc, ["function balanceOf(address) view returns (uint256)"], provider);
  const wethToken = new ethers.Contract(weth, ["function approve(address,uint256) returns (bool)"], signer);
  const morpho = new ethers.Contract(MORPHO_BLUE, ABI, signer);
  const before = await usdcToken.balanceOf(user);
  const sharesBefore = (await morphoRead.position(marketId, user)).borrowShares;
  await (await wethToken.approve(MORPHO_BLUE, collateral)).wait();
  await (await morpho.supplyCollateral(market, collateral, user, "0x")).wait();
  const tx = await morpho.borrow(market, borrow, 0, user, user);
  const receipt = await tx.wait();
  const after = await usdcToken.balanceOf(user);
  const position = await morphoRead.position(marketId, user);
  const ok = after > before && position.borrowShares > sharesBefore && position.collateral > 0n;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `borrowShares=${sharesBefore}->${position.borrowShares} collateral=${formatUnits(position.collateral, 18)}WETH usdc=${formatUnits(before, 6)}->${formatUnits(after, 6)}`,
    detail: `market ${marketId}\ncollateral ${formatUnits(position.collateral, 18)} WETH\nborrowShares ${sharesBefore} -> ${position.borrowShares}\nUSDC ${formatUnits(before, 6)} -> ${formatUnits(after, 6)}\ntx ${receipt.hash}`,
    error: ok ? null : "borrow did not open a position",
  });
}

module.exports = { run };
