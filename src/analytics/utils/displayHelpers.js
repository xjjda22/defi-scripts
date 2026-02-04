// Display utilities for analytics scripts
// Provides formatted CLI output with colors and tables
const chalk = require("chalk");
const Table = require("cli-table3");

/**
 * Print a formatted header
 * @param {string} title - Header title
 * @param {string} subtitle - Optional subtitle
 */
function printHeader(title, subtitle = null) {
  console.log("\n" + chalk.cyan("═".repeat(60)));
  console.log(chalk.cyan.bold(`  ${title}`));
  if (subtitle) {
    console.log(chalk.gray(`  ${subtitle}`));
  }
  console.log(chalk.cyan("═".repeat(60)) + "\n");
}

/**
 * Print a section header
 * @param {string} title - Section title
 */
function printSection(title) {
  console.log(chalk.yellow(`\n${title}`));
  console.log(chalk.yellow("─".repeat(60)));
}

/**
 * Create a formatted table
 * @param {Array<string>} headers - Column headers
 * @param {Object} options - Table options
 * @returns {Table} CLI table instance
 */
function createTable(headers, options = {}) {
  return new Table({
    head: headers.map((h) => chalk.bold.white(h)),
    style: {
      head: [],
      border: ["gray"],
    },
    colAligns: options.colAligns || [],
    colWidths: options.colWidths || [],
    ...options,
  });
}

/**
 * Format a number as currency
 * @param {number} value - Number to format
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted string
 */
function formatCurrency(value, decimals = 2) {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(decimals)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(decimals)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(decimals)}K`;
  }
  return `$${value.toFixed(decimals)}`;
}

/**
 * Format a percentage
 * @param {number} value - Percentage value (0-100)
 * @param {number} decimals - Decimal places
 * @param {boolean} withColor - Add color based on positive/negative
 * @returns {string} Formatted string
 */
function formatPercent(value, decimals = 2, withColor = false) {
  const formatted = `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
  if (!withColor) return formatted;
  
  if (value > 0) return chalk.green(formatted);
  if (value < 0) return chalk.red(formatted);
  return formatted;
}

/**
 * Format a price with proper decimals
 * @param {number} price - Price value
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted string
 */
function formatPrice(price, decimals = 2) {
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
  return `$${price.toFixed(decimals)}`;
}

/**
 * Print an insight/recommendation
 * @param {string} message - The insight message
 * @param {string} type - Type: 'info', 'success', 'warning', 'error'
 */
function printInsight(message, type = "info") {
  const icons = {
    info: "💡",
    success: "✅",
    warning: "⚠️",
    error: "❌",
    fire: "🔥",
    rocket: "⚡",
    chart: "📊",
  };

  const colors = {
    info: chalk.cyan,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    fire: chalk.red,
    rocket: chalk.yellow,
    chart: chalk.blue,
  };

  const icon = icons[type] || icons.info;
  const color = colors[type] || colors.info;

  console.log(color(`${icon} ${message}`));
}

/**
 * Print multiple insights
 * @param {Array<{message: string, type: string}>} insights - Array of insights
 */
function printInsights(insights) {
  console.log(chalk.bold("\nKey Insights:"));
  insights.forEach(({ message, type }) => printInsight(message, type));
  console.log();
}

/**
 * Print a comparison line
 * @param {string} label - Label
 * @param {string} value1 - First value
 * @param {string} value2 - Second value
 * @param {string} comparison - Comparison text
 */
function printComparison(label, value1, value2, comparison) {
  console.log(
    `${chalk.gray(label)}: ${chalk.white(value1)} ${chalk.yellow("vs")} ${chalk.white(value2)} ${chalk.gray(comparison)}`
  );
}

/**
 * Format a gas price
 * @param {number} gwei - Gas price in gwei
 * @returns {string} Formatted string with color
 */
function formatGas(gwei) {
  if (gwei < 20) return chalk.green(`${gwei} gwei`);
  if (gwei < 50) return chalk.yellow(`${gwei} gwei`);
  return chalk.red(`${gwei} gwei`);
}

/**
 * Print a loading spinner message
 * @param {string} message - Loading message
 */
function printLoading(message) {
  console.log(chalk.gray(`⏳ ${message}...`));
}

/**
 * Print a success message
 * @param {string} message - Success message
 */
function printSuccess(message) {
  console.log(chalk.green(`✅ ${message}`));
}

/**
 * Print an error message
 * @param {string} message - Error message
 */
function printError(message) {
  console.log(chalk.red(`❌ Error: ${message}`));
}

/**
 * Format a chain name with emoji
 * @param {string} chainName - Chain name
 * @returns {string} Formatted chain name
 */
function formatChain(chainName) {
  const emojis = {
    Ethereum: "🔷",
    Arbitrum: "🔵",
    Optimism: "🔴",
    Base: "🔵",
    Polygon: "🟣",
    BSC: "🟡",
  };
  const emoji = emojis[chainName] || "⛓️";
  return `${emoji} ${chainName}`;
}

/**
 * Format a large number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted string
 */
function formatNumber(num) {
  return num.toLocaleString("en-US");
}

/**
 * Create a progress bar
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @param {number} width - Bar width in characters
 * @returns {string} Progress bar string
 */
function createProgressBar(current, total, width = 20) {
  const percentage = (current / total) * 100;
  const filled = Math.floor((current / total) * width);
  const empty = width - filled;
  
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `${bar} ${percentage.toFixed(1)}%`;
}

module.exports = {
  printHeader,
  printSection,
  createTable,
  formatCurrency,
  formatPercent,
  formatPrice,
  formatGas,
  formatChain,
  formatNumber,
  printInsight,
  printInsights,
  printComparison,
  printLoading,
  printSuccess,
  printError,
  createProgressBar,
};
