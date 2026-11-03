// Venue lookup with a reason when it is missing.
//
// `CHAINS[chain].uniswap.v3.factory` reads fine until a chain has no venue, when it evaluates
// to `undefined` and the caller returns null — the failure that looks like "the pool is empty"
// instead of "this chain has no DEX configured". Everything goes through here so the message
// carries the chain, what it does have, and the command that would add one.

const { CHAINS } = require("./chains");

/** Protocol blocks a chain may carry, in the order they are worth reading. */
const VENUES = ["uniswap", "sushiswap", "pancakeswap", "curve", "balancer", "aave", "velodrome", "aerodrome"];

/** Blocks that are only useful with a factory. */
const NEEDS_FACTORY = {
  uniswap: v => v?.v3?.factory || v?.v2?.factory,
  sushiswap: v => v?.v2?.factory || v?.v3?.factory,
  pancakeswap: v => v?.v3?.factory,
};

function venuesOf(chainKey) {
  const chain = CHAINS[chainKey];
  if (!chain) return { chain: chainKey, known: false, configured: [], missing: [...VENUES] };
  const configured = VENUES.filter((name) => chain[name] && (!NEEDS_FACTORY[name] || NEEDS_FACTORY[name](chain[name])));
  return { chain: chainKey, known: true, configured, missing: VENUES.filter((n) => !configured.includes(n)) };
}

/** The venue block, or a thrown error that says what the chain does have. */
function requireVenue(chainKey, protocol) {
  const chain = CHAINS[chainKey];
  if (!chain) {
    throw new Error(`unknown chain "${chainKey}" — known: ${Object.keys(CHAINS).join(", ")}`);
  }
  const block = chain[protocol];
  const usable = block && (!NEEDS_FACTORY[protocol] || NEEDS_FACTORY[protocol](block));
  if (!usable) {
    const { configured } = venuesOf(chainKey);
    throw new Error(
      `${protocol} is not configured on ${chainKey}. ` +
        `Verified venues there: ${configured.length ? configured.join(", ") : "none"}. ` +
        `Run \`npm run chain:discover ${chainKey}\` and check the ABI before adding one.`
    );
  }
  return block;
}

/** `null` when the venue exists, otherwise the one-line reason to show. */
function venueGap(chainKey, protocol) {
  try {
    requireVenue(chainKey, protocol);
    return null;
  } catch (e) {
    return e.message;
  }
}

module.exports = { VENUES, venuesOf, requireVenue, venueGap };
