/**
 * Polymarket (Polygon) — permissionless Conditional Tokens Framework split.
 *
 * Polymarket's trading stack has no on-chain matching engine: CLOB orders are signed off-chain,
 * matched by the operator and only settled through the CTF Exchange, so a fork test cannot place
 * a trade. The permissionless on-chain primitive underneath every market is Gnosis' Conditional
 * Tokens Framework (CTF): anyone can call splitPosition() with the market's USDC collateral and
 * receive the full YES+NO set for a prepared condition. This test finds the most recent binary
 * condition that Polymarket's own UMA CTF Adapter prepared and that is still unresolved, then
 * splits 10 USDC into it from a fresh impersonated account. It asserts the collateral moved into
 * the CTF and both outcome balances are non-zero and equal to the amount split.
 *
 * Addresses (Polygon, chainId 137):
 *   ConditionalTokens (CTF)  0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
 *     https://docs.polymarket.com/developers/CTF/overview
 *   USDC (USDC.e collateral) 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
 *     https://docs.polymarket.com/developers/CTF/overview
 *   UMA CTF Adapter V4       0x65070BE91477460D8A7AeEb94ef92fe056C2f2A7
 *     https://github.com/Polymarket/uma-ctf-adapter
 *   CTF Exchange V2          0xE111180000d2663C0091e4f400237545B87B996B
 *     https://github.com/Polymarket/ctf-exchange-v2#deployed-contracts
 *   CtfCollateralAdapter V2  0xADa100874d00e3331D00F2007a9c336a65009718
 *     https://github.com/Polymarket/ctf-exchange-v2#deployed-contracts
 *   pUSD (PMCT)              0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB
 *     https://github.com/Polymarket/ctf-exchange-v2#deployed-contracts
 *
 * The condition filter matters: neg-risk markets are prepared with the NegRiskAdapter as the
 * CTF oracle and are collateralised in Wrapped Collateral (0x3a3b...), while regular markets are
 * prepared with the UMA CTF Adapter as the oracle and are collateralised in USDC. findOpen...()
 * filters on the UMA adapter topic, so the condition it returns is a USDC market.
 *
 * The addresses are tied together on-chain, and those reads are pre-flight gates: the CTF
 * Exchange V2's getCtf() is the CTF, and its CtfCollateralAdapter reports CONDITIONAL_TOKENS ==
 * CTF and USDCE == the USDC address (the adapter unwraps pUSD to USDC.e and calls
 * CTF.splitPosition with USDCE; see CtfCollateralAdapter._splitPosition). The UMA adapter's
 * ctf() is the same CTF. So a wrong address cannot pass.
 *
 * No PRIVATE_KEY: runtime.impersonateFunded() moves USDC from a configured whale to a brand-new
 * impersonated account (anvil_deal tops the whale up if needed), then that account approves the
 * CTF and splits.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, formatUnits, finish } = require("../runtime");

const CTF = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const UMA_CTF_ADAPTER = "0x65070BE91477460D8A7AeEb94ef92fe056C2f2A7";
const CTF_EXCHANGE = "0xE111180000d2663C0091e4f400237545B87B996B";
const CTF_COLLATERAL_ADAPTER = "0xADa100874d00e3331D00F2007a9c336a65009718";
const PUSD = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";

const GAS = { gasLimit: 3_000_000n };
// The upstream Polygon RPC caps eth_getLogs at a 10-block range on the free plan; Anvil answers
// the same window locally, so the scan is transport-agnostic.
const LOG_WINDOW = 10;
const SCAN_BLOCKS = 6_000; // ~3.3 h of 2 s Polygon blocks
const PARENT_COLLECTION_ID = ethers.ZeroHash;
const PARTITION = [1, 2]; // binary market: indexSet 1 = YES, indexSet 2 = NO

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const CTF_ABI = [
  "function getOutcomeSlotCount(bytes32) view returns (uint256)",
  "function payoutDenominator(bytes32) view returns (uint256)",
  "function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet) view returns (bytes32)",
  "function getPositionId(address collateralToken, bytes32 collectionId) view returns (uint256)",
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function splitPosition(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] partition, uint256 amount)",
  "event PositionSplit(address indexed stakeholder, address collateralToken, bytes32 indexed parentCollectionId, bytes32 indexed conditionId, uint256[] partition, uint256 amount)",
];

const EXCHANGE_ABI = ["function getCtf() view returns (address)", "function getCollateral() view returns (address)"];

const COLLATERAL_ADAPTER_ABI = [
  "function CONDITIONAL_TOKENS() view returns (address)",
  "function USDCE() view returns (address)",
  "function COLLATERAL_TOKEN() view returns (address)",
  "function paused(address) view returns (bool)",
];

const ADAPTER_ABI = ["function ctf() view returns (address)"];

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  if (data.startsWith("0x08c379a0")) {
    try {
      return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
    } catch {
      // fall through
    }
  }
  return `${err.reason || err.shortMessage || err.message || err} ${data}`.trim();
}

/**
 * Walk back from the fork head in 10-block windows until a binary condition prepared by
 * Polymarket's UMA CTF Adapter is found that is still unresolved (payoutDenominator == 0).
 * Newest first, so the test exercises a fresh market rather than a stale one.
 */
async function findOpenBinaryCondition(provider, ctf) {
  const head = await provider.getBlockNumber();
  const preparationTopic = ethers.id("ConditionPreparation(bytes32,address,bytes32,uint256)");
  const adapterTopic = ethers.zeroPadValue(UMA_CTF_ADAPTER, 32).toLowerCase();
  const oldest = Math.max(0, head - SCAN_BLOCKS);
  for (let end = head; end > oldest; end -= LOG_WINDOW) {
    const fromBlock = Math.max(0, end - LOG_WINDOW + 1);
    const logs = await provider.getLogs({
      address: CTF,
      topics: [preparationTopic, null, adapterTopic],
      fromBlock,
      toBlock: end,
    });
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      const log = logs[i];
      if (BigInt(log.data) !== 2n) continue; // binary YES/NO only
      const conditionId = log.topics[1];
      const [outcomeSlotCount, payoutDenominator] = await Promise.all([
        ctf.getOutcomeSlotCount(conditionId),
        ctf.payoutDenominator(conditionId),
      ]);
      if (outcomeSlotCount === 2n && payoutDenominator === 0n) {
        return { conditionId, preparedBlock: log.blockNumber, questionId: log.topics[3] };
      }
    }
  }
  return null;
}

async function split(base) {
  const provider = getProvider(base.chain);
  const [ctfCode, usdcCode, adapterCode, exchangeCode, collateralAdapterCode] = await Promise.all([
    provider.getCode(CTF),
    provider.getCode(USDC),
    provider.getCode(UMA_CTF_ADAPTER),
    provider.getCode(CTF_EXCHANGE),
    provider.getCode(CTF_COLLATERAL_ADAPTER),
  ]);
  if (ctfCode === "0x")
    return finish({ ...base, ok: false, error: `ConditionalTokens ${CTF} has no code on this fork` });
  if (usdcCode === "0x") return finish({ ...base, ok: false, error: `USDC ${USDC} has no code on this fork` });
  if (adapterCode === "0x")
    return finish({
      ...base,
      ok: false,
      error: `Polymarket UMA CTF Adapter ${UMA_CTF_ADAPTER} has no code on this fork`,
    });
  if (exchangeCode === "0x")
    return finish({ ...base, ok: false, error: `Polymarket CTF Exchange V2 ${CTF_EXCHANGE} has no code on this fork` });
  if (collateralAdapterCode === "0x")
    return finish({
      ...base,
      ok: false,
      error: `Polymarket CtfCollateralAdapter ${CTF_COLLATERAL_ADAPTER} has no code on this fork`,
    });

  const exchange = new ethers.Contract(CTF_EXCHANGE, EXCHANGE_ABI, provider);
  const collateralAdapter = new ethers.Contract(CTF_COLLATERAL_ADAPTER, COLLATERAL_ADAPTER_ABI, provider);
  const adapter = new ethers.Contract(UMA_CTF_ADAPTER, ADAPTER_ABI, provider);
  const [exchangeCtf, exchangeCollateral, collateralCtf, collateralUsdc, collateralPmct, splitPaused, adapterCtf] =
    await Promise.all([
      exchange.getCtf(),
      exchange.getCollateral(),
      collateralAdapter.CONDITIONAL_TOKENS(),
      collateralAdapter.USDCE(),
      collateralAdapter.COLLATERAL_TOKEN(),
      collateralAdapter.paused(USDC),
      adapter.ctf(),
    ]);
  if (exchangeCtf.toLowerCase() !== CTF.toLowerCase())
    return finish({ ...base, ok: false, error: `CTF Exchange V2.getCtf() is ${exchangeCtf}, not ${CTF}` });
  if (exchangeCollateral.toLowerCase() !== PUSD.toLowerCase())
    return finish({
      ...base,
      ok: false,
      error: `CTF Exchange V2.getCollateral() is ${exchangeCollateral}, not pUSD ${PUSD}`,
    });
  if (collateralCtf.toLowerCase() !== CTF.toLowerCase())
    return finish({
      ...base,
      ok: false,
      error: `CtfCollateralAdapter.CONDITIONAL_TOKENS() is ${collateralCtf}, not ${CTF}`,
    });
  if (collateralUsdc.toLowerCase() !== USDC.toLowerCase())
    return finish({ ...base, ok: false, error: `CtfCollateralAdapter.USDCE() is ${collateralUsdc}, not USDC ${USDC}` });
  if (collateralPmct.toLowerCase() !== PUSD.toLowerCase())
    return finish({
      ...base,
      ok: false,
      error: `CtfCollateralAdapter.COLLATERAL_TOKEN() is ${collateralPmct}, not pUSD ${PUSD}`,
    });
  if (splitPaused)
    return finish({
      ...base,
      ok: false,
      error: `CtfCollateralAdapter is paused for USDC ${USDC}; no split can be minted`,
    });
  if (adapterCtf.toLowerCase() !== CTF.toLowerCase())
    return finish({ ...base, ok: false, error: `UMA CTF Adapter.ctf() is ${adapterCtf}, not ${CTF}` });

  const ctf = new ethers.Contract(CTF, CTF_ABI, provider);
  const condition = await findOpenBinaryCondition(provider, ctf);
  if (!condition)
    return finish({
      ...base,
      ok: false,
      error: `no unresolved binary condition from Polymarket's UMA CTF Adapter in the last ${SCAN_BLOCKS} blocks`,
    });

  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "10", 6);
  const signer = await impersonateFunded(base.chain, "USDC", USDC, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(USDC, ERC20, signer);
  const writer = ctf.connect(signer);

  const balance = await usdc.balanceOf(user);
  if (balance < amount)
    return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(balance, 6)} USDC` });

  const yesCollectionId = await ctf.getCollectionId(PARENT_COLLECTION_ID, condition.conditionId, 1);
  const noCollectionId = await ctf.getCollectionId(PARENT_COLLECTION_ID, condition.conditionId, 2);
  const yesId = await ctf.getPositionId(USDC, yesCollectionId);
  const noId = await ctf.getPositionId(USDC, noCollectionId);

  await (await usdc.approve(CTF, amount)).wait();
  const receipt = await (
    await writer.splitPosition(USDC, PARENT_COLLECTION_ID, condition.conditionId, PARTITION, amount, GAS)
  ).wait();
  const at = receipt.blockNumber;
  const prev = at - 1;

  const [usdcPrev, usdcAt, ctfPrev, ctfAt, yesPrev, yesAt, noPrev, noAt] = await Promise.all([
    usdc.balanceOf(user, { blockTag: prev }),
    usdc.balanceOf(user, { blockTag: at }),
    usdc.balanceOf(CTF, { blockTag: prev }),
    usdc.balanceOf(CTF, { blockTag: at }),
    ctf.balanceOf(user, yesId, { blockTag: prev }),
    ctf.balanceOf(user, yesId, { blockTag: at }),
    ctf.balanceOf(user, noId, { blockTag: prev }),
    ctf.balanceOf(user, noId, { blockTag: at }),
  ]);

  let splitEvent = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CTF.toLowerCase()) continue;
    try {
      const parsed = ctf.interface.parseLog(log);
      if (parsed && parsed.name === "PositionSplit") splitEvent = parsed;
    } catch {
      // not a CTF event
    }
  }

  const spent = usdcPrev - usdcAt;
  const ctfGain = ctfAt - ctfPrev;
  const yesGain = yesAt - yesPrev;
  const noGain = noAt - noPrev;
  const eventOk =
    splitEvent != null &&
    splitEvent.args.stakeholder.toLowerCase() === user.toLowerCase() &&
    splitEvent.args.conditionId.toLowerCase() === condition.conditionId.toLowerCase() &&
    splitEvent.args.amount === amount;

  const ok =
    spent === amount &&
    ctfGain === amount &&
    yesPrev === 0n &&
    noPrev === 0n &&
    yesGain === amount &&
    noGain === amount &&
    yesAt === noAt &&
    eventOk;

  const reasons = [];
  if (spent !== amount) reasons.push(`user USDC spent ${formatUnits(spent, 6)} != ${formatUnits(amount, 6)}`);
  if (ctfGain !== amount) reasons.push(`CTF USDC +${formatUnits(ctfGain, 6)} != ${formatUnits(amount, 6)}`);
  if (yesPrev !== 0n || noPrev !== 0n) reasons.push(`account ${user} already held outcome tokens`);
  if (yesGain !== amount) reasons.push(`YES +${formatUnits(yesGain, 6)} != ${formatUnits(amount, 6)}`);
  if (noGain !== amount) reasons.push(`NO +${formatUnits(noGain, 6)} != ${formatUnits(amount, 6)}`);
  if (yesAt !== noAt) reasons.push(`YES ${formatUnits(yesAt, 6)} != NO ${formatUnits(noAt, 6)}`);
  if (!eventOk) reasons.push("no matching PositionSplit(stakeholder, conditionId, amount) event");

  return finish({
    ...base,
    ok,
    key:
      `usdc=-${formatUnits(spent, 6)} ctfUSDC=+${formatUnits(ctfGain, 6)} ` +
      `YES=${formatUnits(yesAt, 6)} NO=${formatUnits(noAt, 6)} condition=${condition.conditionId}`,
    detail:
      `Polymarket CTF ${CTF}: CTF Exchange V2 ${CTF_EXCHANGE} (getCtf=${exchangeCtf}) mints through ` +
      `CtfCollateralAdapter ${CTF_COLLATERAL_ADAPTER} (CONDITIONAL_TOKENS=${collateralCtf}, USDCE=${collateralUsdc}, ` +
      `pUSD=${collateralPmct}, paused(USDC)=${splitPaused})\n` +
      `condition ${condition.conditionId} prepared at block ${condition.preparedBlock} by Polymarket's UMA CTF Adapter ` +
      `${UMA_CTF_ADAPTER} (ctf()=${adapterCtf}), outcomeSlotCount=2, payoutDenominator=0\n` +
      `split ${formatUnits(amount, 6)} USDC from fresh ${user}: user USDC ${formatUnits(usdcPrev, 6)} -> ` +
      `${formatUnits(usdcAt, 6)} (-${formatUnits(spent, 6)}), CTF USDC ${formatUnits(ctfPrev, 6)} -> ` +
      `${formatUnits(ctfAt, 6)} (+${formatUnits(ctfGain, 6)})\n` +
      `YES position ${yesId}: ${formatUnits(yesPrev, 6)} -> ${formatUnits(yesAt, 6)}; ` +
      `NO position ${noId}: ${formatUnits(noPrev, 6)} -> ${formatUnits(noAt, 6)}\n` +
      `tx ${receipt.hash} (block ${at}; fork block ${base.block})`,
    error: ok ? null : reasons.join("; "),
  });
}

async function run() {
  const chain = process.env.CHAIN || "polygon";
  const protocol = process.env.FORK_PROTOCOL || "polymarket";
  const action = process.env.FORK_ACTION || "split";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    return await split(base);
  } catch (err) {
    // A revert is a FAIL.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
