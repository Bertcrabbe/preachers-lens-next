import { ConvexHttpClient } from "convex/browser";
import { readFileSync, createWriteStream, unlinkSync, existsSync } from "fs";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import { join } from "path";
import { statSync } from "fs";

const CONVEX_URL = "https://elated-setter-33.convex.cloud";
const SUPABASE_BASE = "https://lrvisxodjsubifwyfkjr.supabase.co/storage/v1/object/public/sermons";
const AUDIO_EXPORT = "/home/exedev/.openclaw/media/inbound/preachers-lens-audio-export---0e943ef0-db81-458b-b2f9-e2d11ea8b284.json";

const client = new ConvexHttpClient(CONVEX_URL);
const sermons = JSON.parse(readFileSync(AUDIO_EXPORT, "utf8"));

// Only process Bert's sermons (1902a65a prefix)
const bertSermons = sermons.filter(s => s.file_url.startsWith("1902a65a-"));
console.log(`Bert's sermons: ${bertSermons.length} of ${sermons.length} total\n`);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function formatBytes(bytes) {
  return bytes < 1024*1024 ? `${(bytes/1024).toFixed(0)}KB` : `${(bytes/1024/1024).toFixed(1)}MB`;
}

// Step 1: Restore any sermons that lost their fileUrl in the bad first run
console.log("=== Step 1: Restore fileUrls for corrupted sermons ===");
for (const s of bertSermons) {
  const fullUrl = `${SUPABASE_BASE}/${s.file_url}`;
  // Update by title match if fileUrl is missing
  const restored = await client.mutation("migration:restoreFileUrl", {
    supabaseFileUrl: s.file_url,
    fullFileUrl: fullUrl,
    title: s.title || "",
  });
  if (restored) console.log(`  Restored: "${s.title}"`);
}
// Also do a direct fileUrl restore for all matching sermons regardless
// Use a bulk restore approach
const bulkResult = await client.mutation("migration:bulkRestoreFileUrls", {
  urlMap: Object.fromEntries(
    bertSermons.map(s => [s.title || "", `${SUPABASE_BASE}/${s.file_url}`])
  ),
});
console.log(`Bulk restore: ${JSON.stringify(bulkResult)}\n`);

// Step 2: Upload audio files
console.log("=== Step 2: Upload audio to Convex storage ===");
let done = 0, skipped = 0, failed = 0;

for (const sermon of bertSermons) {
  const label = `[${done+skipped+failed+1}/${bertSermons.length}] "${sermon.title}"`;
  const tmpFile = join(tmpdir(), `sermon-${Date.now()}.audio`);

  try {
    // Download
    process.stdout.write(`${label}\n  ↓ downloading...`);
    const dlRes = await fetch(sermon.signed_url);
    if (!dlRes.ok) { console.log(` FAIL (${dlRes.status})`); failed++; continue; }
    await pipeline(dlRes.body, createWriteStream(tmpFile));
    const size = statSync(tmpFile).size;
    process.stdout.write(` ${formatBytes(size)}\n  ↑ uploading...`);

    // Get upload URL
    const uploadUrl = await client.mutation("migration:generateUploadUrlUnauthed", {});

    // Determine MIME type
    const ext = sermon.file_url.split('.').pop().toLowerCase();
    const mime = {mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav'}[ext] || 'audio/mpeg';

    // Upload (load into buffer - 200MB should be fine, these are ~30-90MB files)
    const fileData = readFileSync(tmpFile);
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mime },
      body: fileData,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.log(` FAIL (${uploadRes.status}): ${errText.slice(0,100)}`);
      failed++;
      continue;
    }
    const uploadJson = await uploadRes.json();
    const storageId = uploadJson.storageId;
    if (!storageId) {
      console.log(` FAIL: no storageId in response: ${JSON.stringify(uploadJson)}`);
      failed++;
      continue;
    }
    process.stdout.write(` ${storageId.slice(0,12)}...\n  ↻ updating Convex...`);

    // Update sermon record
    const updated = await client.mutation("migration:updateSermonAudio", {
      supabaseFileUrl: sermon.file_url,
      fileId: storageId,
    });

    if (updated) {
      console.log(` ✓\n`);
      done++;
    } else {
      console.log(` ⚠ no match found\n`);
      skipped++;
    }

    if (existsSync(tmpFile)) unlinkSync(tmpFile);
    await sleep(300);
  } catch (err) {
    console.log(`\n  ✗ error: ${err.message}\n`);
    failed++;
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  }
}

console.log(`\n=== Done ===`);
console.log(`  ✓ ${done} migrated  ⚠ ${skipped} no match  ✗ ${failed} failed`);
