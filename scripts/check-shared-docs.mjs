#!/usr/bin/env node
/**
 * Guards the shared documentation folder against drift between the two repositories.
 *
 * development-docs/shared/ must be byte identical here and in the backend repository.
 * The backend owns the contract, so a difference usually means a copy step was skipped
 * after a backend change. Building screens against a contract nobody implements is the
 * exact failure the shared folder exists to prevent.
 *
 * See development-docs/shared/integration-protocol.md.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localDir = join(repoRoot, "development-docs", "shared");
const siblingDir = resolve(repoRoot, "..", "backend", "development-docs", "shared");

/** @returns {Map<string, string>} filename => sha256 of contents */
function hashSharedDocs(directory) {
  const hashes = new Map();

  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (!name.endsWith(".md") || !statSync(path).isFile()) continue;
    hashes.set(name, createHash("sha256").update(readFileSync(path)).digest("hex"));
  }

  return hashes;
}

if (!existsSync(siblingDir)) {
  console.log(
    "Backend repository not found at ../backend. Skipping the shared docs sync check.",
  );
  process.exit(0);
}

if (!existsSync(localDir)) {
  console.error("development-docs/shared is missing from this repository.");
  process.exit(1);
}

const local = hashSharedDocs(localDir);
const sibling = hashSharedDocs(siblingDir);

const missingHere = [...sibling.keys()].filter((name) => !local.has(name));
const missingThere = [...local.keys()].filter((name) => !sibling.has(name));
const differing = [...local.keys()].filter(
  (name) => sibling.has(name) && sibling.get(name) !== local.get(name),
);

const problems = [];
if (missingHere.length) problems.push(`Missing from the frontend: ${missingHere.join(", ")}`);
if (missingThere.length) problems.push(`Missing from the backend: ${missingThere.join(", ")}`);
if (differing.length) problems.push(`Contents differ: ${differing.join(", ")}`);

if (problems.length) {
  console.error("development-docs/shared has drifted between the two repositories.\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\nThe backend owns the contract. Resolve by copying from there:\n" +
      "  cp -r ../backend/development-docs/shared/. ./development-docs/shared/\n" +
      "Then commit both repositories.",
  );
  process.exit(1);
}

console.log(`Shared docs in sync with the backend (${local.size} files).`);
