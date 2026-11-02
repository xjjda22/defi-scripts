/**
 * Bedrock uniBTC — mint uniBTC against WBTC through Bedrock's own Vault, on a local Ethereum fork.
 *
 * The Vault (0x047D41F2…) is the only contract allowed to mint uniBTC (it holds MINTER_ROLE on
 * the token), and its wrapped-BTC entry point `mint(address _token, uint256 _amount)` carries no
 * access-control modifier: any caller may deposit an allowed wrapped BTC and receive uniBTC at
 * 1:1. The guards are all state, not roles: `outOfService` must be false, `allowedTokenList[WBTC]`
 * true, `paused[WBTC]` false, the supply feeder's totalSupply(WBTC) + amount must stay under
 * `caps[WBTC]`, and `checkReserve()` re-reads the "uniBTC PoR" Chainlink feed (heartbeat
 * `feederHeartbeat`, reserve >= supply * adequacyRatio / 1000) before every mint.
 *
 * WBTC has 8 decimals and uniBTC has 8 decimals, so `_amounts` returns (amount, amount) and the
 * mint is exactly 1:1: the caller's WBTC falls by amount, the Vault's WBTC rises by amount, and
 * the caller's uniBTC and uniBTC.totalSupply() rise by amount.
 *
 * Addresses: https://docs.bedrock.technology/security/smart-contracts/unibtc.md (uniBTC, Vault)
 *            https://github.com/Bedrock-Technology/uniBTC/tree/main/deployments/ethereum.md
 * Vault code: https://github.com/Bedrock-Technology/uniBTC/blob/main/contracts/contracts/Vault.sol
 * WBTC: https://etherscan.io/token/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 (canonical Wrapped BTC)
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";
/** Bedrock Vault on Ethereum (TransparentUpgradeableProxy) — the permissionless mint entry point. */
const VAULT = "0x047D41F2544B7F63A8e991aF2068a363d210d6Da";
/** Bedrock uniBTC token (8 decimals); only the Vault may mint it. */
const UNIBTC = "0x004E9C3EF86bc1ca1f0bB5C7662861Ee93350568";
/** WBTC (8 decimals) — the wrapped BTC the Vault accepts. */
const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const GAS = { gasLimit: 1_000_000n };

const VAULT_ABI = [
  "function uniBTC() view returns (address)",
  "function outOfService() view returns (bool)",
  "function allowedTokenList(address) view returns (bool)",
  "function paused(address) view returns (bool)",
  "function caps(address) view returns (uint256)",
  "function supplyFeeder() view returns (address)",
  "function chainlinkReserveFeeder() view returns (address)",
  "function uniBTCSupplyFeeder() view returns (address)",
  "function adequacyRatio() view returns (uint256)",
  "function feederHeartbeat() view returns (uint256)",
  "function mint(address _token, uint256 _amount)",
  "event Minted(address token, uint256 amount)",
];
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
/** uniBTC adds the AccessControl bits the Vault must hold to mint. */
const UNIBTC_ABI = [
  ...ERC20_ABI,
  "function MINTER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
];
const SUPPLY_FEEDER_ABI = [
  "function totalSupply(address) view returns (uint256)",
  "function totalTokenSupply() view returns (uint256)",
];
const AGGREGATOR_ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
];

/** Mirror of the Vault's checkReserve() gate, so a stale/insufficient PoR feed fails loudly here. */
async function preflightReserve(vault, provider, blockTimestamp) {
  const [reserveFeeder, supplyFeeder, adequacyRatio, heartbeat] = await Promise.all([
    vault.chainlinkReserveFeeder(),
    vault.uniBTCSupplyFeeder(),
    vault.adequacyRatio(),
    vault.feederHeartbeat(),
  ]);
  // The Vault only enforces PoR when all three are configured.
  if (reserveFeeder === ethers.ZeroAddress || supplyFeeder === ethers.ZeroAddress || adequacyRatio === 0n) {
    return { enforced: false, detail: "PoR feeders unset on this fork build" };
  }

  const aggregator = new ethers.Contract(reserveFeeder, AGGREGATOR_ABI, provider);
  const [, answer, , updatedAt] = await aggregator.latestRoundData();
  const reserveDecimals = await aggregator.decimals();
  if (updatedAt < blockTimestamp - heartbeat) {
    return {
      enforced: true,
      ok: false,
      error: `uniBTC PoR feed ${reserveFeeder} is stale: updatedAt ${updatedAt} is older than block.timestamp ${blockTimestamp} - heartbeat ${heartbeat}`,
    };
  }

  const feeder = new ethers.Contract(supplyFeeder, SUPPLY_FEEDER_ABI, provider);
  // The Vault treats the feeder's supply as 8 decimals and scales it to the reserve's decimals.
  let supply = await feeder.totalTokenSupply();
  const supplyDecimals = 8n;
  let reserves = BigInt(answer);
  if (supplyDecimals < reserveDecimals) supply *= 10n ** (BigInt(reserveDecimals) - supplyDecimals);
  else if (supplyDecimals > reserveDecimals) reserves *= 10n ** (supplyDecimals - BigInt(reserveDecimals));

  const required = (supply * adequacyRatio) / 1000n;
  if (required > reserves) {
    return {
      enforced: true,
      ok: false,
      error: `uniBTC PoR is under-collateralised: supply*adequacyRatio/1000 = ${required} exceeds reserves ${reserves}`,
    };
  }
  return {
    enforced: true,
    ok: true,
    detail: `PoR ${reserveFeeder} age ${blockTimestamp - updatedAt}s/${heartbeat}s reserves ${formatUnits(reserves, reserveDecimals)} >= ${formatUnits(required, reserveDecimals)}`,
  };
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "bedrock-unibtc";
  const action = process.env.FORK_ACTION || "mint";
  let ctx;
  try {
    ctx = await requireFork(CHAIN);
  } catch (err) {
    return finish({ protocol, action, chain: CHAIN, block: null, ok: false, error: err.message });
  }
  const base = { protocol, action, chain: CHAIN, block: ctx.forkBlock };

  try {
    const provider = getProvider(CHAIN);
    const vault = new ethers.Contract(VAULT, VAULT_ABI, provider);
    const unibtc = new ethers.Contract(UNIBTC, UNIBTC_ABI, provider);
    const wbtc = new ethers.Contract(WBTC, ERC20_ABI, provider);

    // Never call or fund an address that is empty on this fork: a typo'd token passed to
    // impersonateFunded/dealErc20 can "succeed" against an empty account.
    for (const [name, address] of [
      ["Vault", VAULT],
      ["uniBTC", UNIBTC],
      ["WBTC", WBTC],
    ]) {
      if ((await provider.getCode(address)) === "0x") {
        return finish({ ...base, ok: false, error: `no ${name} contract code at ${address} on the fork` });
      }
    }

    // The Vault must be the one wired to this uniBTC, and the token must be the 8-decimal uniBTC
    // whose MINTER_ROLE the Vault holds; otherwise the minted delta would be measured wrong.
    const [vaultUniBTC, outOfService, allowed, tokenPaused, cap, supplyFeeder] = await Promise.all([
      vault.uniBTC(),
      vault.outOfService(),
      vault.allowedTokenList(WBTC),
      vault.paused(WBTC),
      vault.caps(WBTC),
      vault.supplyFeeder(),
    ]);
    if (vaultUniBTC.toLowerCase() !== UNIBTC.toLowerCase())
      return finish({ ...base, ok: false, error: `${VAULT} uniBTC() is ${vaultUniBTC}, not the documented uniBTC` });
    if (outOfService) return finish({ ...base, ok: false, error: `Vault ${VAULT} is out of service (outOfService=true)` });
    if (!allowed)
      return finish({ ...base, ok: false, error: `Vault ${VAULT} does not allow WBTC (allowedTokenList(WBTC) is false)` });
    if (tokenPaused) return finish({ ...base, ok: false, error: `Vault ${VAULT} has paused WBTC minting (paused(WBTC)=true)` });
    if (cap === 0n) return finish({ ...base, ok: false, error: `Vault ${VAULT} has no cap set for WBTC` });

    const [unibtcSymbol, unibtcDecimals, wbtcDecimals, minterRole] = await Promise.all([
      unibtc.symbol(),
      unibtc.decimals(),
      wbtc.decimals(),
      unibtc.MINTER_ROLE(),
    ]);
    if (unibtcDecimals !== 8n) return finish({ ...base, ok: false, error: `uniBTC decimals() is ${unibtcDecimals}, not 8` });
    if (wbtcDecimals !== 8n) return finish({ ...base, ok: false, error: `WBTC decimals() is ${wbtcDecimals}, not 8` });

    if (!(await unibtc.hasRole(minterRole, VAULT)))
      return finish({ ...base, ok: false, error: `Vault ${VAULT} does not hold MINTER_ROLE on uniBTC ${UNIBTC}` });

    const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "0.1", 8);
    // caps[] is compared against the supply feeder's running total for this token, not the vault's
    // WBTC balance, so read the same counter the contract reads.
    const feeder = new ethers.Contract(supplyFeeder, SUPPLY_FEEDER_ABI, provider);
    let feederSupply = 0n;
    try {
      feederSupply = await feeder.totalSupply(WBTC);
    } catch {
      // Unset/broken feeder will make the mint itself revert; the pre-flight below reports it.
    }
    if (supplyFeeder === ethers.ZeroAddress)
      return finish({ ...base, ok: false, error: `Vault ${VAULT} has no supplyFeeder set` });
    if (feederSupply + amount > cap)
      return finish({
        ...base,
        ok: false,
        error: `WBTC cap reached: supply ${formatUnits(feederSupply, 8)} + ${formatUnits(amount, 8)} exceeds caps(WBTC) ${formatUnits(cap, 8)}`,
      });

    const latest = await provider.getBlock("latest");
    const reserve = await preflightReserve(vault, provider, BigInt(latest.timestamp));
    if (reserve.enforced && reserve.ok === false) return finish({ ...base, ok: false, error: reserve.error });

    // Fresh random account funded with WBTC by impersonating a Bedrock-unrelated WBTC whale — no
    // PRIVATE_KEY anywhere. dealErc20 is the last-resort top-up if the whale is dry.
    const signer = await impersonateFunded(CHAIN, "WBTC", WBTC, amount);
    const user = await signer.getAddress();
    let balance = await wbtc.balanceOf(user);
    if (balance < amount) {
      await dealErc20(CHAIN, WBTC, user, amount);
      balance = await wbtc.balanceOf(user);
    }
    if (balance < amount)
      return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(balance, 8)} WBTC` });

    // The Vault pulls WBTC with safeTransferFrom(msg.sender, address(this), amount).
    await (await wbtc.connect(signer).approve(VAULT, amount, GAS)).wait();
    const allowance = await wbtc.allowance(user, VAULT);
    if (allowance < amount)
      return finish({ ...base, ok: false, error: `WBTC allowance to ${VAULT} is ${allowance.toString()}` });

    const [uniBefore, supplyBefore, wbtcBefore, vaultBefore] = await Promise.all([
      unibtc.balanceOf(user),
      unibtc.totalSupply(),
      wbtc.balanceOf(user),
      wbtc.balanceOf(VAULT),
    ]);
    const receipt = await (await vault.connect(signer)["mint(address,uint256)"](WBTC, amount, GAS)).wait();
    const [uniAfter, supplyAfter, wbtcAfter, vaultAfter] = await Promise.all([
      unibtc.balanceOf(user),
      unibtc.totalSupply(),
      wbtc.balanceOf(user),
      wbtc.balanceOf(VAULT),
    ]);

    let event = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== VAULT.toLowerCase()) continue;
      try {
        const parsed = vault.interface.parseLog(log);
        if (parsed && parsed.name === "Minted") {
          event = parsed.args;
          break;
        }
      } catch {
        // another event emitted by the Vault, not the one under test
      }
    }
    const eventToken = event ? String(event.token).toLowerCase() : null;
    const eventAmount = event ? BigInt(event.amount) : null;

    const minted = uniAfter - uniBefore;
    const supplyDelta = supplyAfter - supplyBefore;
    const spent = wbtcBefore - wbtcAfter;
    const vaultDelta = vaultAfter - vaultBefore;
    // Both WBTC and uniBTC are 8-decimal, so the Vault's _amounts() returns amount 1:1.
    const expected = amount;

    const ok =
      receipt.status === 1 &&
      minted === expected &&
      supplyDelta === expected &&
      spent === expected &&
      vaultDelta === expected &&
      eventToken === WBTC.toLowerCase() &&
      eventAmount === expected;
    const reason = ok
      ? null
      : !event
        ? "no Minted event from the Vault in the receipt"
        : eventToken !== WBTC.toLowerCase()
          ? `Minted token ${eventToken} is not WBTC ${WBTC.toLowerCase()}`
          : eventAmount !== expected
            ? `Minted amount ${eventAmount.toString()} is not the submitted ${expected.toString()}`
            : minted !== expected
              ? `uniBTC balance moved by ${formatUnits(minted, 8)}, expected ${formatUnits(expected, 8)}`
              : supplyDelta !== expected
                ? `uniBTC totalSupply moved by ${formatUnits(supplyDelta, 8)}, expected ${formatUnits(expected, 8)}`
                : spent !== expected
                  ? `WBTC spent ${formatUnits(spent, 8)}, expected ${formatUnits(expected, 8)}`
                  : vaultDelta !== expected
                    ? `Vault WBTC balance moved by ${formatUnits(vaultDelta, 8)}, expected ${formatUnits(expected, 8)}`
                    : `tx status ${receipt.status}`;

    return finish({
      ...base,
      ok,
      key: `uniBTCMinted=${formatUnits(minted, 8)} supplyDelta=${formatUnits(supplyDelta, 8)} wbtcSpent=${formatUnits(spent, 8)}`
        + ` vaultWbtcDelta=${formatUnits(vaultDelta, 8)}`,
      detail: [
        `mint(${WBTC}, ${formatUnits(amount, 8)} WBTC) on Bedrock Vault ${VAULT} (allowed=${allowed} cap=${formatUnits(cap, 8)} feederSupply=${formatUnits(feederSupply, 8)})`,
        `uniBTC ${unibtcSymbol} balance ${formatUnits(uniBefore, 8)} -> ${formatUnits(uniAfter, 8)} (delta ${formatUnits(minted, 8)})`,
        `uniBTC totalSupply ${formatUnits(supplyBefore, 8)} -> ${formatUnits(supplyAfter, 8)} (delta ${formatUnits(supplyDelta, 8)})`,
        `WBTC spent ${formatUnits(spent, 8)}; Vault WBTC ${formatUnits(vaultBefore, 8)} -> ${formatUnits(vaultAfter, 8)} (delta ${formatUnits(vaultDelta, 8)})`,
        `Minted token ${eventToken || "-"} amount ${eventAmount === null ? "-" : formatUnits(eventAmount, 8)}; ${reserve.detail}`,
        `tx ${receipt.hash} from ${user}`,
      ].join("\n"),
      error: reason,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
