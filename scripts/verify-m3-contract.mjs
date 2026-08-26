/**
 * Parses live EP-14 responses through the search schema, in both modes.
 *
 * Keyword mode needs the backend forced into failure, so this reports which mode it
 * actually saw rather than assuming. Run it with AI_FAKE_SHOULD_FAIL both ways to
 * cover the pair.
 */
import * as S from "../lib/schemas/catalogue.ts";

const BASE = process.env.API_URL ?? "http://localhost:8000";

async function search(q) {
  const response = await fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

const queries = ["vertex", "I am looking for a good smartphone", "zzzznothing"];
let failed = 0;

for (const q of queries) {
  try {
    const parsed = S.searchResponseSchema.parse(await search(q));
    console.log(
      `  ok    mode=${parsed.mode.padEnd(7)} total=${String(parsed.meta.total).padStart(2)}  ${JSON.stringify(q)}`,
    );
  } catch (error) {
    failed += 1;
    console.error(`  FAIL  ${JSON.stringify(q)}: ${error.message.split("\n").slice(0, 3).join(" ")}`);
  }
}

// mode must never be absent; the notice is driven by it alone.
try {
  S.searchResponseSchema.parse({ data: [], links: {}, meta: {} });
  console.error("  FAIL  a response with no mode was accepted");
  failed += 1;
} catch {
  console.log("  ok    a response missing mode is rejected");
}

console.log(failed === 0 ? "\nEP-14 matches the schema." : `\n${failed} problem(s).`);
process.exit(failed === 0 ? 0 : 1);
