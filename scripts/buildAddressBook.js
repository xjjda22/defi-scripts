#!/usr/bin/env node
/**
 * Generates test/contracts/protocols/_shared/Addresses.sol from the address book.
 *
 * One file-level `library` per non-empty BOOK key, plus a `Tokens` library built
 * from COMMON_TOKENS. Solidity allows no nested library declaration, so the plan's
 * `Addresses.Aave.V3_POOL` is reached through a module alias instead:
 *   import * as Addresses from ".../_shared/Addresses.sol";
 *   Addresses.Aave.V3_POOL
 * Addresses are emitted verbatim (EIP-55 canonicalised): BOOK is already checksummed
 * apart from two lowercase entries, and a literal is never hand-written into a
 * `.t.sol` (R4.6).
 *
 *   node scripts/buildAddressBook.js           # write the file
 *   node scripts/buildAddressBook.js --check   # fail when it is stale
 */

const fs = require("fs");
const path = require("path");

const { BOOK } = require("../src/catalog/contracts");
const { COMMON_TOKENS } = require("../src/config/chains");
const { getAddress } = require("ethers");

const ROOT = path.resolve(__dirname, "..");
const OUT_REL = "test/contracts/protocols/_shared/Addresses.sol";
const OUT_ABS = path.join(ROOT, OUT_REL);

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// Solidity words that cannot name a library. Checked case-insensitively because
// PascalCasing a lowercase key could otherwise land on one.
const RESERVED = new Set([
  "abstract",
  "address",
  "after",
  "alias",
  "anonymous",
  "apply",
  "as",
  "assembly",
  "bool",
  "break",
  "byte",
  "calldata",
  "case",
  "catch",
  "constant",
  "constructor",
  "continue",
  "contract",
  "copyof",
  "days",
  "default",
  "define",
  "delete",
  "do",
  "else",
  "emit",
  "enum",
  "error",
  "ether",
  "event",
  "external",
  "fallback",
  "false",
  "final",
  "fixed",
  "for",
  "from",
  "function",
  "global",
  "gwei",
  "hex",
  "hours",
  "if",
  "immutable",
  "implements",
  "import",
  "in",
  "indexed",
  "inline",
  "int",
  "interface",
  "internal",
  "is",
  "let",
  "library",
  "macro",
  "mapping",
  "match",
  "memory",
  "minutes",
  "modifier",
  "mutable",
  "new",
  "null",
  "of",
  "override",
  "partial",
  "payable",
  "pragma",
  "private",
  "promise",
  "public",
  "pure",
  "receive",
  "reference",
  "relocatable",
  "return",
  "returns",
  "reverting",
  "sealed",
  "seconds",
  "sizeof",
  "static",
  "storage",
  "string",
  "struct",
  "supports",
  "switch",
  "true",
  "try",
  "type",
  "typeof",
  "ufixed",
  "uint",
  "unchecked",
  "unicode",
  "using",
  "var",
  "view",
  "virtual",
  "weeks",
  "wei",
  "while",
  "years",
]);

/** `xdai-stake-bridge` -> `XdaiStakeBridge`; a leading digit gets an `A` prefix. */
function libraryName(key) {
  const pascal = String(key)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  if (!pascal) throw new Error(`Empty library name for BOOK key "${key}"`);
  let name = /^[0-9]/.test(pascal) ? `A${pascal}` : pascal;
  if (RESERVED.has(name) || RESERVED.has(name.toLowerCase())) name += "Book";
  return name;
}

/** `V3 pool` -> `V3_POOL`; a leading digit gets an `A_` prefix. */
function constantName(label) {
  const snake = String(label)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!snake) return "A";
  return /^[0-9]/.test(snake) ? `A_${snake}` : snake;
}

/** `ethereum` -> `ETHEREUM`; used for `_<CHAIN>` disambiguation. */
function chainSuffix(chain) {
  return (
    String(chain)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "CHAIN"
  );
}

/**
 * Keeps the first occurrence's plain name and disambiguates later ones with the
 * chain, then `_2`, `_3`, ... exactly as the plan describes.
 */
function uniqueConstant(taken, base, chain) {
  if (!taken.has(base)) return base;
  const suffixed = `${base}_${chainSuffix(chain)}`;
  if (!taken.has(suffixed)) return suffixed;
  let n = 2;
  while (taken.has(`${suffixed}_${n}`)) n += 1;
  return `${suffixed}_${n}`;
}

/** Non-canonical entries re-checksummed for solc; reported by the CLI. */
const normalized = [];

/**
 * Validates a 40-hex literal and returns its EIP-55 form. Solidity rejects an
 * address literal whose casing is not the EIP-55 checksum, so a lowercase BOOK
 * entry has to be re-checksummed before it can be emitted.
 */
function canonical(address, context) {
  const text = String(address);
  if (!ADDRESS_RE.test(text)) {
    throw new Error(`Invalid address for ${context}: ${text}`);
  }
  const checksummed = getAddress(text.toLowerCase());
  if (checksummed !== text) normalized.push(`${context}: ${text} -> ${checksummed}`);
  return checksummed;
}

function build() {
  /** @type {{ name: string, key: string, lines: string[] }[]} */
  const libraries = [];
  const owners = new Map();
  let constants = 0;

  for (const key of Object.keys(BOOK)) {
    const entries = BOOK[key];
    if (!Array.isArray(entries) || entries.length === 0) continue;

    const name = libraryName(key);
    if (owners.has(name)) {
      throw new Error(
        `Library name collision: BOOK keys "${owners.get(name)}" and "${key}" both sanitize to "${name}"`
      );
    }
    owners.set(name, key);

    const taken = new Set();
    const lines = [];
    for (const entry of entries) {
      const address = canonical(entry.address, `BOOK["${key}"] label "${entry.label}"`);
      const constant = uniqueConstant(taken, constantName(entry.label), entry.chain);
      taken.add(constant);
      lines.push(`    address internal constant ${constant} = ${address};`);
      constants += 1;
    }
    libraries.push({ name, key, lines });
  }

  libraries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  // The Tokens library is a sibling of the BOOK libraries, so a clash would merge
  // two different address sets under one name.
  if (owners.has("Tokens")) {
    throw new Error(
      `Library name collision: BOOK key "${owners.get("Tokens")}" sanitizes to "Tokens", ` +
        `which is reserved for COMMON_TOKENS`
    );
  }

  const tokenLines = [];
  const seenTokens = new Set();
  const symbols = Object.keys(COMMON_TOKENS).sort();
  for (const symbol of symbols) {
    const perChain = COMMON_TOKENS[symbol];
    if (!perChain || typeof perChain !== "object") continue;
    for (const chain of Object.keys(perChain).sort()) {
      const address = perChain[chain];
      // COMMON_TOKENS carries a few nested sub-maps (e.g. rETH.uniswap); only
      // chain -> address pairs are address-book material.
      if (typeof address !== "string") continue;
      const checksummed = canonical(address, `COMMON_TOKENS.${symbol}.${chain}`);
      const constant = chainSuffix(symbol) + "_" + chainSuffix(chain);
      if (seenTokens.has(constant)) {
        throw new Error(
          `Token constant collision: COMMON_TOKENS.${symbol}.${chain} and ${seenTokens.get(constant)} both yield "${constant}"`
        );
      }
      seenTokens.add(constant);
      tokenLines.push(`    address internal constant ${constant} = ${checksummed};`);
      constants += 1;
    }
  }

  libraries.push({ name: "Tokens", key: "COMMON_TOKENS", lines: tokenLines });

  const out = [];
  out.push("// SPDX-License-Identifier: MIT");
  out.push("pragma solidity 0.8.24;");
  out.push("");
  out.push("// GENERATED by scripts/buildAddressBook.js — do not edit.");
  out.push("// Sources: src/catalog/contracts.js (BOOK), src/config/chains.js (COMMON_TOKENS).");
  out.push("// Solidity has no nested libraries, so each BOOK key is a file-level library.");
  out.push("// Import the module to keep the plan's spelling:");
  out.push('//   import * as Addresses from "./_shared/Addresses.sol";');
  out.push("//   Addresses.Aave.V3_POOL, Addresses.Tokens.USDC_BASE");
  out.push("");
  libraries.forEach((library, index) => {
    out.push(`library ${library.name} {`);
    out.push(...library.lines);
    out.push("}");
    if (index !== libraries.length - 1) out.push("");
  });
  out.push("");

  const content = out.join("\n");
  return { content, libraries: libraries.length, constants };
}

function firstDifference(expected, actual) {
  const a = expected.split("\n");
  const b = actual.split("\n");
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] === b[i]) continue;
    return {
      line: i + 1,
      expected: a[i] === undefined ? "(end of file)" : a[i],
      actual: b[i] === undefined ? "(end of file, missing trailing newline)" : b[i],
    };
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const unknown = args.filter(arg => arg !== "--check");
  if (unknown.length > 0) {
    console.error(`Unknown argument: ${unknown.join(" ")}`);
    console.error("Usage: node scripts/buildAddressBook.js [--check]");
    process.exit(2);
  }

  let result;
  try {
    result = build();
  } catch (err) {
    console.error(`buildAddressBook: ${err.message}`);
    process.exit(1);
  }

  const summary = `${result.libraries} libraries, ${result.constants} constants`;
  for (const line of normalized) {
    console.error(`Note: re-checksummed (solc rejects the raw casing) ${line}`);
  }

  if (check) {
    let actual;
    try {
      actual = fs.readFileSync(OUT_ABS, "utf8");
    } catch (err) {
      console.error(`Address book missing: ${OUT_REL} (${summary})`);
      console.error("Run: node scripts/buildAddressBook.js");
      process.exit(1);
    }
    if (actual === result.content) {
      console.log(`Address book OK (${summary})`);
      return;
    }
    const diff = firstDifference(result.content, actual);
    console.error(`Address book out of date: ${OUT_REL}:${diff.line}`);
    console.error(`  expected: ${diff.expected}`);
    console.error(`  actual:   ${diff.actual}`);
    console.error("Run: node scripts/buildAddressBook.js");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_ABS), { recursive: true });
  fs.writeFileSync(OUT_ABS, result.content, "utf8");
  console.log(`Wrote ${OUT_REL} (${summary})`);
}

main();
