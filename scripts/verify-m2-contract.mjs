/**
 * Parses every live M2 response through its zod schema.
 *
 * A one-off contract check: it proves the schemas match what Laravel actually sends
 * before any screen is built on top of them. Run it whenever the backend changes a
 * catalogue response.
 */
import { z } from "zod";
import * as S from "../lib/schemas/catalogue.ts";

const BASE = process.env.API_URL ?? "http://localhost:8000";

async function get(path) {
  const response = await fetch(`${BASE}/api${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

const checks = [
  ["EP-08 /products", "/products", (b) => S.paginated(S.productSummarySchema).parse(b)],
  ["EP-53 /categories", "/categories", (b) => z.array(S.categorySchema).parse(b.data)],
  ["EP-09 /products/{slug}", "/products/vertex-one-smartphone", (b) => S.productSchema.parse(b.data)],
  ["EP-10 /variants", "/products/vertex-one-smartphone/variants", (b) => z.array(S.variantSchema).parse(b.data)],
  ["EP-11 /sellers (no coords)", "/products/vertex-one-smartphone/sellers", (b) => S.paginated(S.sellerListingSchema).parse(b)],
  ["EP-11 /sellers (coords)", "/products/vertex-one-smartphone/sellers?lat=6.9271&lng=79.8612", (b) => S.paginated(S.sellerListingSchema).parse(b)],
  ["EP-12 /summary (present)", "/products/vertex-one-smartphone/summary", (b) => S.sentimentSummarySchema.parse(b.data)],
  ["EP-12 /summary (absent)", "/products/lumen-desk-lamp/summary", (b) => { if (b.data !== null) throw new Error("expected data: null"); return null; }],
  ["EP-13 /stores/{id}", "/stores/1", (b) => S.publicStoreSchema.parse(b.data)],
  ["zero-seller product", "/products/orbit-wireless-earbuds", (b) => S.productSchema.parse(b.data)],
  ["single default variant", "/products/standard-usb-c-cable-2m/variants", (b) => z.array(S.variantSchema).parse(b.data)],
];

let failed = 0;

for (const [label, path, check] of checks) {
  try {
    check(await get(path));
    console.log(`  ok    ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(`        ${error.message.split("\n").slice(0, 4).join(" ")}`);
  }
}

console.log(failed === 0 ? "\nAll M2 responses match their schemas." : `\n${failed} mismatch(es).`);
process.exit(failed === 0 ? 0 : 1);
