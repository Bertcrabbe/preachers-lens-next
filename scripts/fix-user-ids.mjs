import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = "https://elated-setter-33.convex.cloud";
const OLD_USER_ID = "user_01KT55JVKKNZXV8ZXRREBNJK46";
const NEW_USER_ID = "user_3Ee0LlAS2XXhgNtNHkyVf74xCVb";

const client = new ConvexHttpClient(CONVEX_URL);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fixTable(queryName, patchName, label) {
  const rows = await client.query(queryName, { userId: OLD_USER_ID });
  console.log(`${label}: ${rows.length} rows to fix`);
  let done = 0;
  for (const row of rows) {
    await client.mutation(patchName, { id: row._id, userId: NEW_USER_ID });
    done++;
    if (done % 50 === 0) process.stdout.write(`\r  ${done}/${rows.length}`);
    await sleep(50);
  }
  console.log(`\r  ✓ ${done} fixed`);
}

console.log("=== Fixing user IDs ===\n");
await fixTable("migration:listByUserId", "migration:patchUserId", "Communicators (all tables)");
console.log("\nDone!");
