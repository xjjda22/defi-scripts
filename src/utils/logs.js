/**
 * eth_getLogs over a block window, split into chunks the RPC accepts.
 * Free-tier RPCs cap the range (Alchemy: 10 blocks) and say so in the error; the chunk
 * size shrinks to that cap (or halves when the error gives no number) and the range is retried.
 * Rate-limit errors (HTTP 429 / compute-unit caps) back off and retry the same range.
 */

const RANGE_ERROR = /block range|range (is )?too (large|wide|big)|query returned more than|max(imum)? (block )?range/i;
const RATE_ERROR = /\b429\b|rate limit|compute units|too many requests/i;
const MAX_RATE_RETRIES = 6;

function rpcErrorText(err) {
  return [err?.error?.message, err?.info?.error?.message, err?.shortMessage, err?.message].filter(Boolean).join(" ");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitRange([from, to], size) {
  const out = [];
  for (let start = from; start <= to; start += size) out.push([start, Math.min(start + size - 1, to)]);
  return out;
}

/**
 * @param {import("ethers").Provider} provider
 * @param {{ address?: string, topics?: Array<string|null> }} filter
 * @param {number} fromBlock
 * @param {number} toBlock
 * @param {{ chunk?: number, concurrency?: number }} [opts]
 * @returns {Promise<{ logs: import("ethers").Log[], chunk: number }>} logs in block order, and the chunk size that worked
 */
async function getLogsChunked(provider, filter, fromBlock, toBlock, { chunk = 2000, concurrency = 2 } = {}) {
  let size = Math.max(1, Math.floor(chunk));
  const ranges = splitRange([fromBlock, toBlock], size);
  const logs = [];
  let rateRetries = 0;

  while (ranges.length) {
    const batch = ranges.splice(0, concurrency);
    const results = await Promise.allSettled(
      batch.map(([from, to]) => provider.getLogs({ ...filter, fromBlock: from, toBlock: to }))
    );
    const tooWide = [];
    const limited = [];
    let rangeText = "";
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        logs.push(...r.value);
        return;
      }
      const text = rpcErrorText(r.reason);
      if (RATE_ERROR.test(text)) limited.push(batch[i]);
      else if (RANGE_ERROR.test(text)) {
        tooWide.push(batch[i]);
        rangeText = text;
      } else throw r.reason;
    });

    if (limited.length) {
      if (++rateRetries > MAX_RATE_RETRIES) throw new Error("RPC kept rate-limiting eth_getLogs; retry later");
      await sleep(250 * 2 ** rateRetries);
      ranges.unshift(...limited);
    } else if (!tooWide.length) {
      rateRetries = 0;
    }

    if (tooWide.length) {
      if (size === 1) throw new Error(`RPC rejected a 1-block eth_getLogs range: ${rangeText}`);
      const cap = parseInt((rangeText.match(/up to (?:a )?(\d+)[- ]block/i) || [])[1], 10);
      size = Number.isFinite(cap) && cap > 0 && cap < size ? cap : Math.max(1, Math.floor(size / 2));
      ranges.unshift(...tooWide.flatMap(r => splitRange(r, size)));
    }
  }
  logs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
  return { logs, chunk: size };
}

module.exports = { getLogsChunked };
