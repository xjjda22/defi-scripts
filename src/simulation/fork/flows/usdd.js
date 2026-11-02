/**
 * USDD — mint USDD 1:1 against USDT through the USDD Peg Stability Module, on a local Ethereum fork.
 *
 * USDD 2.0 is a Maker-style system on Ethereum (Vat/Jug/Dog/Vow + a USDD token and a USDD Join),
 * and its PSM is the DssPsm fork `UsddPsm`. `sellGem(address usr, uint256 gemAmt)` is the
 * permissionless entry point: the PSM pulls gemAmt of the gem stablecoin from msg.sender through
 * the gem's AuthGemJoin, `vat.frob`s the matching debt into the PSM's own urn (1:1 because the
 * PSM ilk is the stablecoin itself), takes `tin` of it for the Vow, and `usddJoin.exit`s the rest
 * to usr. The oracle/rate is not involved, so the mint is exactly gemAmt (scaled to 18 decimals)
 * minus `tin`; USDT's PSM has `tin = 0`, so 100 USDT mints exactly 100 USDD. The USDD token is
 * minted by the USDD Join, so the token's totalSupply rises by the same amount.
 *
 * Addresses: https://docs.usdd.io/introduction/collateral-asset-contract-addresses (PSM-USDT,
 * USDTJoin, USDD) and https://docs.usdd.io/developers/deployment-addresses (MCD_PSM_USDT_A,
 * JOIN_PSM_USDT_A). The method is documented at https://docs.usdd.io/developers/core-contracts/psm.
 * USDT itself is Tether's canonical Ethereum contract.
 *
 * Approval goes to the gem Join, not to the PSM: AuthGemJoin.join(urn, wad, msgSender) does the
 * transferFrom(msgSender, ...) and the PSM passes the original caller as msgSender.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";
/** USDD 2.0 token on Ethereum (18 decimals). */
const USDD = "0x4f8e5DE400DE08B164E7421B3EE387f461beCD1A";
/** MCD_PSM_USDT_A — the USDT Peg Stability Module. */
const PSM = "0xcE355440c00014A229bbEc030A2B8f8EB45a2897";
/** JOIN_PSM_USDT_A — the AuthGemJoin for the PSM's ilk; the approval target. */
const USDT_JOIN = "0x217e42CEB2eAE9ECB788fDF0e31c806c531760A3";
/** USDT (Tether USD, 6 decimals) — the PSM's gem, also read back from the Join. */
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
/** bytes32 ilk "PSM-USDT-A". */
const PSM_ILK = ethers.encodeBytes32String("PSM-USDT-A");
const GAS = { gasLimit: 1_000_000n };

const PSM_ABI = [
  "function tin() view returns (uint256)",
  "function tout() view returns (uint256)",
  "function sellEnabled() view returns (uint256)",
  "function buyEnabled() view returns (uint256)",
  "function ilk() view returns (bytes32)",
  "function usdd() view returns (address)",
  "function gemJoin() view returns (address)",
  "function sellGem(address usr, uint256 gemAmt)",
  "event SellGem(address indexed owner, uint256 value, uint256 fee)",
];
const JOIN_ABI = [
  "function gem() view returns (address)",
  "function dec() view returns (uint256)",
  "function live() view returns (uint256)",
];
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "usdd";
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
    const psm = new ethers.Contract(PSM, PSM_ABI, provider);
    const join = new ethers.Contract(USDT_JOIN, JOIN_ABI, provider);
    const usdd = new ethers.Contract(USDD, ERC20_ABI, provider);
    const usdt = new ethers.Contract(USDT, ERC20_ABI, provider);

    // Never call an address that is empty on this fork: a typo'd PSM would revert, but a typo'd
    // token passed to impersonateFunded/dealErc20 can "succeed" against an empty account.
    for (const [name, address] of [
      ["USDD", USDD],
      ["PSM", PSM],
      ["USDT Join", USDT_JOIN],
      ["USDT", USDT],
    ]) {
      if ((await provider.getCode(address)) === "0x") {
        return finish({ ...base, ok: false, error: `no ${name} contract code at ${address} on the fork` });
      }
    }

    // The PSM must be the USDT one wired to this USDD and this Join; otherwise the 1:1 mint and
    // the balance delta would be measured against the wrong market.
    const [ilk, psmUsdd, gemJoin, gem, dec, live, tin, sellEnabled] = await Promise.all([
      psm.ilk(),
      psm.usdd(),
      psm.gemJoin(),
      join.gem(),
      join.dec(),
      join.live(),
      psm.tin(),
      psm.sellEnabled(),
    ]);
    if (ilk !== PSM_ILK) return finish({ ...base, ok: false, error: `${PSM} ilk() is ${ilk}, not PSM-USDT-A` });
    if (psmUsdd.toLowerCase() !== USDD.toLowerCase())
      return finish({ ...base, ok: false, error: `${PSM} usdd() is ${psmUsdd}, not the documented USDD` });
    if (gemJoin.toLowerCase() !== USDT_JOIN.toLowerCase())
      return finish({ ...base, ok: false, error: `${PSM} gemJoin() is ${gemJoin}, not the documented USDT Join` });
    if (gem.toLowerCase() !== USDT.toLowerCase())
      return finish({ ...base, ok: false, error: `USDT Join gem() is ${gem}, not USDT` });
    if (dec !== 6n) return finish({ ...base, ok: false, error: `USDT Join dec() is ${dec}, not 6` });
    if (live !== 1n) return finish({ ...base, ok: false, error: `USDT Join ${USDT_JOIN} is not live (live=${live})` });
    if (sellEnabled !== 1n)
      return finish({ ...base, ok: false, error: `${PSM} sellGem is disabled (sellEnabled=${sellEnabled})` });
    // The docs promise a fee-less 1:1 swap; USDT's PSM has tin = 0. A non-zero tin would make the
    // documented rate wrong, so fail loudly instead of quietly passing an inexact mint.
    if (tin !== 0n)
      return finish({
        ...base,
        ok: false,
        error: `${PSM} tin() is ${formatUnits(tin, 18)}, not the documented 0 (1:1 no-fee PSM)`,
      });

    const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
    // Fresh random account funded with USDT by impersonating a Tether whale — no PRIVATE_KEY.
    const signer = await impersonateFunded(CHAIN, "USDT", USDT, amount);
    const user = await signer.getAddress();
    let balance = await usdt.balanceOf(user);
    if (balance < amount) {
      // impersonateFunded already anvil_deals when the whales are short; this is the last resort.
      await dealErc20(CHAIN, USDT, user, amount);
      balance = await usdt.balanceOf(user);
    }
    if (balance < amount)
      return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(balance, 6)} USDT` });

    // The gem Join pulls the gem, so it is the spender that needs the allowance.
    await (await usdt.connect(signer).approve(USDT_JOIN, amount, GAS)).wait();
    const allowance = await usdt.allowance(user, USDT_JOIN);
    if (allowance < amount)
      return finish({ ...base, ok: false, error: `USDT allowance to ${USDT_JOIN} is ${allowance.toString()}` });

    const [usddBefore, supplyBefore, usdtBefore] = await Promise.all([
      usdd.balanceOf(user),
      usdd.totalSupply(),
      usdt.balanceOf(user),
    ]);
    const receipt = await (await psm.connect(signer).sellGem(user, amount, GAS)).wait();
    const [usddAfter, supplyAfter, usdtAfter] = await Promise.all([
      usdd.balanceOf(user),
      usdd.totalSupply(),
      usdt.balanceOf(user),
    ]);

    let event = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== PSM.toLowerCase()) continue;
      try {
        const parsed = psm.interface.parseLog(log);
        if (parsed && parsed.name === "SellGem") {
          event = parsed.args;
          break;
        }
      } catch {
        // another event emitted by the PSM, not the one under test
      }
    }

    const delta = usddAfter - usddBefore;
    const supplyDelta = supplyAfter - supplyBefore;
    const spent = usdtBefore - usdtAfter;
    // 6-decimal USDT -> 18-decimal USDD, 1:1, fee-less.
    const expected = amount * 10n ** 12n;
    const eventOwner = event ? String(event.owner).toLowerCase() : null;
    const eventValue = event ? BigInt(event.value) : null;
    const eventFee = event ? BigInt(event.fee) : null;

    const ok =
      receipt.status === 1 &&
      delta === expected &&
      supplyDelta === expected &&
      spent === amount &&
      eventOwner === user.toLowerCase() &&
      eventValue === amount &&
      eventFee === 0n;
    const reason = ok
      ? null
      : !event
        ? "no SellGem event from the PSM in the receipt"
        : eventOwner !== user.toLowerCase()
          ? `SellGem owner ${eventOwner} is not the caller ${user.toLowerCase()}`
          : eventValue !== amount
            ? `SellGem value ${eventValue.toString()} is not the submitted ${amount.toString()}`
            : eventFee !== 0n
              ? `SellGem fee ${eventFee.toString()} is not 0`
              : delta !== expected
                ? `USDD balance moved by ${formatUnits(delta, 18)}, expected ${formatUnits(expected, 18)}`
                : supplyDelta !== expected
                  ? `USDD totalSupply moved by ${formatUnits(supplyDelta, 18)}, expected ${formatUnits(expected, 18)}`
                  : spent !== amount
                    ? `USDT spent ${formatUnits(spent, 6)}, expected ${formatUnits(amount, 6)}`
                    : `tx status ${receipt.status}`;

    return finish({
      ...base,
      ok,
      key: `usddMinted=${formatUnits(delta, 18)} supplyDelta=${formatUnits(supplyDelta, 18)} usdtSpent=${formatUnits(spent, 6)}`,
      detail: [
        `sellGem(${user}, ${formatUnits(amount, 6)} USDT) on USDD PSM ${PSM} (ilk PSM-USDT-A, tin 0)`,
        `USDD balance ${formatUnits(usddBefore, 18)} -> ${formatUnits(usddAfter, 18)} (delta ${formatUnits(delta, 18)})`,
        `USDD totalSupply ${formatUnits(supplyBefore, 18)} -> ${formatUnits(supplyAfter, 18)} (delta ${formatUnits(supplyDelta, 18)})`,
        `USDT spent ${formatUnits(spent, 6)}; SellGem owner ${eventOwner || "-"} value ${eventValue === null ? "-" : formatUnits(eventValue, 6)} fee ${eventFee === null ? "-" : formatUnits(eventFee, 18)}`,
        `tx ${receipt.hash} from ${user}`,
      ].join("\n"),
      error: reason,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
