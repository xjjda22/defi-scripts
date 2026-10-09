/**
 * Uniswap V4 ETH→USDC swap on an Ethereum fork through the Universal Router.
 * The older src/swaps/v4Swap.js calls PoolManager.swap directly, which an EOA cannot do
 * (V4 requires unlock + callback), so this path uses the router the app uses.
 *
 * Addresses (https://docs.uniswap.org/contracts/v4/deployments, Ethereum):
 *   PoolManager     0x000000000004444c5dc75cB358380D2e3dE08A90 (src/config/chains.js)
 *   V4Quoter        0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203
 *   UniversalRouter 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { UNISWAP_V4 } = require("../../catalog/contracts");
const { requireFork, formatUnits, finish } = require("./runtime");

const POOL_KEY = "tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)";
const QUOTER_ABI = [
  `function quoteExactInputSingle(tuple(${POOL_KEY} poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)`,
];
const ROUTER_ABI = ["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"];

// Universal Router command and V4Router actions (v4-periphery Actions.sol).
const V4_SWAP = 0x10;
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0c;
const TAKE_ALL = 0x0f;

// Native ETH / USDC pools, no hooks. fee and tickSpacing pairs from the V4 defaults.
const CANDIDATES = [
  { fee: 500, tickSpacing: 10 },
  { fee: 3000, tickSpacing: 60 },
  { fee: 100, tickSpacing: 1 },
];

async function run() {
  const chain = "ethereum";
  const protocol = process.env.FORK_PROTOCOL || "uniswap";
  const action = process.env.FORK_ACTION || "v4";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    const provider = getProvider(chain);
    const usdc = COMMON_TOKENS.USDC.ethereum;
    const amountIn = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
    const quoter = new ethers.Contract(UNISWAP_V4.quoter, QUOTER_ABI, provider);

    let best = null;
    for (const c of CANDIDATES) {
      const key = [ethers.ZeroAddress, usdc, c.fee, c.tickSpacing, ethers.ZeroAddress];
      try {
        const [out] = await quoter.quoteExactInputSingle.staticCall([key, true, amountIn, "0x"]);
        if (!best || out > best.out) best = { key, out, fee: c.fee };
      } catch {
        // pool not initialised for this fee tier
      }
    }
    if (!best) return finish({ ...base, ok: false, error: "V4Quoter returned no ETH/USDC quote" });

    const signer = await impersonateAccount(ethers.Wallet.createRandom().address, chain);
    const user = await signer.getAddress();
    const token = new ethers.Contract(usdc, ["function balanceOf(address) view returns (uint256)"], provider);
    const before = await token.balanceOf(user);
    const minOut = (best.out * 9950n) / 10000n;

    const coder = ethers.AbiCoder.defaultAbiCoder();
    const actions = ethers.solidityPacked(["uint8", "uint8", "uint8"], [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]);
    const params = [
      coder.encode([`tuple(${POOL_KEY} poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData)`], [
        [best.key, true, amountIn, minOut, "0x"],
      ]),
      coder.encode(["address", "uint256"], [ethers.ZeroAddress, amountIn]),
      coder.encode(["address", "uint256"], [usdc, minOut]),
    ];
    const input = coder.encode(["bytes", "bytes[]"], [actions, params]);
    const router = new ethers.Contract(UNISWAP_V4.universalRouter, ROUTER_ABI, signer);
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const tx = await router.execute(ethers.solidityPacked(["uint8"], [V4_SWAP]), [input], deadline, { value: amountIn });
    const receipt = await tx.wait();
    const after = await token.balanceOf(user);
    const received = after - before;
    const ok = received >= minOut;
    return finish({
      ...base,
      ok,
      key: `out=${formatUnits(received, 6)}USDC fee=${best.fee}`,
      detail: `Universal Router V4_SWAP ${formatUnits(amountIn, 18)} ETH -> USDC (fee ${best.fee})\nquote ${formatUnits(best.out, 6)} USDC, min ${formatUnits(minOut, 6)}\nreceived ${formatUnits(received, 6)} USDC\ntx ${receipt.hash}`,
      error: ok ? null : "USDC received was below the quoted minimum",
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
