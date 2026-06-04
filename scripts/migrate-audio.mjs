import { ConvexHttpClient } from "convex/browser";
import { readFileSync, createWriteStream, unlinkSync, existsSync } from "fs";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createReadStream, statSync } from "fs";

const CONVEX_URL = "https://elated-setter-33.convex.cloud";
const AUDIO_EXPORT = "/home/exedev/.openclaw/media/inbound/preachers-lens-audio-export---0e943ef0-db81-458b-b2f9-e2d11ea8b284.json";

const client = new ConvexHttpClient(CONVEX_URL);
const sermons = JSON.parse(readFileSync(AUDIO_EXPORT, "utf8"));

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

console.log(`=== Audio Migration: ${sermons.length} sermons ===\n`);

let done = 0, skipped = 0, failed = 0;

for (const sermon of sermons) {
  const label = `[${done + skipped + failed + 1}/${sermons.length}] "${sermon.title}"`;
  const tmpFile = join(tmpdir(), `sermon-${Date.now()}.audio`);

  try {
    // 1. Download from Supabase signed URL
    process.stdout.write(`${label} downloading...`);
    const dlRes = await fetch(sermon.signed_url);
    if (!dlRes.ok) {
      console.log(` ✗ download failed (${dlRes.status})`);
      failed++;
      continue;
    }

    const writer = createWriteStream(tmpFile);
    await pipeline(dlRes.body, writer);
    const size = statSync(tmpFile).size;
    process.stdout.write(` ${formatBytes(size)} | uploading to Convex...`);

    // 2. Get Convex upload URL
    const uploadUrl = await client.mutation("migration:generateUploadUrlUnauthed", {});

    // Determine mime type
    const ext = sermon.file_url.split('.').pop().toLowerCase();
    const mimeMap = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' };
    const mime = mimeMap[ext] || 'audio/mpeg';

    // 3. Upload to Convex storage (stream to avoid OOM)
    const { Readable } = await import("stream");
    const fileStream = createReadStream(tmpFile);
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mime, "Content-Length": String(size) },
      body: Readable.toWeb(fileStream),
      duplex: "half",
    });
    if (!uploadRes.ok) {
      console.log(` ✗ upload failed (${uploadRes.status})`);
      failed++;
      continue;
    }
    const { storageId } = await uploadRes.json();

    // 4. Update Convex sermon record
    const updated = await client.mutation("migration:updateSermonAudio", {
      supabaseFileUrl: sermon.file_url,
      fileId: storageId,
    });

    if (updated) {
      console.log(` ✓ done (${storageId.slice(0, 12)}...)`);
      done++;
    } else {
      console.log(` ⚠ no matching Convex sermon found`);
      skipped++;
    }

    // Cleanup
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
    await sleep(200);

  } catch (err) {
    console.log(` ✗ error: ${err.message}`);
    failed++;
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  }
}

console.log(`\n=== Done ===`);
console.log(`  ✓ Migrated: ${done}`);
console.log(`  ⚠ Skipped:  ${skipped}`);
console.log(`  ✗ Failed:   ${failed}`);
