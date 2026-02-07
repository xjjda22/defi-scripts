/**
 * Test All Pairs - Batch Testing Script
 * Tests simulation across all configured pairs or a specific group
 *
 * Usage:
 *   node src/simulation/testAllPairs.js                    # Test default group
 *   GROUP=all node src/simulation/testAllPairs.js          # Test all 25 pairs
 *   GROUP=stable node src/simulation/testAllPairs.js       # Test stablecoin pairs
 *   GROUP=defi node src/simulation/testAllPairs.js         # Test DeFi token pairs
 */
require("dotenv").config();
const { spawn } = require("child_process");
const chalk = require("chalk");
const { getPairGroup, PAIR_GROUPS } = require("../config/pairs");

// Configuration
const GROUP = process.env.GROUP || "default";
const CHAIN = process.env.CHAIN || "ethereum";
const PROTOCOL = process.env.PROTOCOL || null;

/**
 * Run simulation for a single pair
 */
function runSimulation(pairName) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PAIR: pairName,
      CHAIN,
      SIMULATE_ONLY: "true",
    };

    if (PROTOCOL) {
      env.PROTOCOL = PROTOCOL;
    }

    const child = spawn("node", ["src/simulation/simulateMultiProtocol.js"], {
      env,
      stdio: "pipe",
    });

    let output = "";
    let hasData = false;

    child.stdout.on("data", (data) => {
      output += data.toString();
      hasData = true;
    });

    child.stderr.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        pairName,
        success: code === 0 && hasData,
        output,
        code,
      });
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        pairName,
        success: false,
        output: "Timeout after 30 seconds",
        code: -1,
      });
    }, 30000);
  });
}

/**
 * Extract best quote from output
 */
function extractBestQuote(output) {
  const match = output.match(/Best Quote[\s\S]*?Protocol:\s+([^\n]+)/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.cyan("\n" + "═".repeat(70)));
  console.log(chalk.cyan.bold("  BATCH PAIR TESTING"));
  console.log(chalk.cyan("═".repeat(70) + "\n"));

  console.log(chalk.bold("Configuration:"));
  console.log(`  Group: ${chalk.green(GROUP)}`);
  console.log(`  Chain: ${chalk.green(CHAIN)}`);
  if (PROTOCOL) {
    console.log(`  Protocol Filter: ${chalk.green(PROTOCOL)}`);
  }

  // Validate group
  if (!PAIR_GROUPS[GROUP]) {
    console.error(chalk.red(`\n❌ Unknown group: ${GROUP}`));
    console.log(chalk.gray(`Available groups: ${Object.keys(PAIR_GROUPS).join(", ")}`));
    process.exit(1);
  }

  const pairs = getPairGroup(GROUP);
  console.log(`  Pairs to test: ${chalk.cyan(pairs.length)}\n`);

  console.log(chalk.yellow("─".repeat(70)));
  console.log(chalk.bold("Starting tests...\n"));

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    process.stdout.write(
      chalk.gray(`[${i + 1}/${pairs.length}] Testing ${pair.name.padEnd(20)}... `)
    );

    const result = await runSimulation(pair.name);

    if (result.success) {
      const bestQuote = extractBestQuote(result.output);
      console.log(chalk.green("✓") + (bestQuote ? chalk.gray(` ${bestQuote}`) : ""));
      results.push({
        pair: pair.name,
        status: "success",
        protocol: bestQuote,
      });
    } else {
      console.log(chalk.red("✗") + chalk.gray(` (${result.output.split("\n")[0]})`));
      results.push({
        pair: pair.name,
        status: "failed",
        error: result.output.split("\n")[0],
      });
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  // Print summary
  console.log(chalk.yellow("\n" + "─".repeat(70)));
  console.log(chalk.cyan("\n" + "═".repeat(70)));
  console.log(chalk.cyan.bold("  TEST SUMMARY"));
  console.log(chalk.cyan("═".repeat(70) + "\n"));

  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  console.log(chalk.bold("Results:"));
  console.log(`  Total: ${chalk.cyan(results.length)} pairs`);
  console.log(`  Success: ${chalk.green(successCount)} (${((successCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${chalk.red(failedCount)} (${((failedCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`  Duration: ${chalk.yellow(duration + "s")}`);
  console.log(`  Avg time per pair: ${chalk.gray((duration / results.length).toFixed(1) + "s")}`);

  // Show failed pairs
  if (failedCount > 0) {
    console.log(chalk.red("\nFailed Pairs:"));
    results
      .filter((r) => r.status === "failed")
      .forEach((r) => {
        console.log(`  ${chalk.red("✗")} ${r.pair} - ${chalk.gray(r.error)}`);
      });
  }

  // Show protocol distribution
  if (successCount > 0) {
    console.log(chalk.green("\nProtocol Distribution:"));
    const protocols = {};
    results
      .filter((r) => r.status === "success")
      .forEach((r) => {
        const proto = r.protocol || "Unknown";
        protocols[proto] = (protocols[proto] || 0) + 1;
      });

    Object.entries(protocols)
      .sort((a, b) => b[1] - a[1])
      .forEach(([proto, count]) => {
        const bar = "█".repeat(Math.ceil((count / successCount) * 20));
        console.log(
          `  ${proto.padEnd(20)} ${bar.padEnd(20)} ${chalk.cyan(count)} (${((count / successCount) * 100).toFixed(0)}%)`
        );
      });
  }

  console.log(chalk.cyan("\n" + "═".repeat(70) + "\n"));

  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(chalk.red("\n❌ Test failed:"), error.message);
  process.exit(1);
});
