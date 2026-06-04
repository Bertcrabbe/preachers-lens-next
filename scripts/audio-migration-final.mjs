import { ConvexHttpClient } from "convex/browser";
import { readFileSync, createWriteStream, unlinkSync, existsSync } from "fs";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import { join, extname } from "path";
import { statSync } from "fs";

const CONVEX_URL = "https://elated-setter-33.convex.cloud";
const SUPABASE_BASE = "https://lrvisxodjsubifwyfkjr.supabase.co/storage/v1/object/public/sermons";
const AUDIO_EXPORT = "/home/exedev/.openclaw/media/inbound/preachers-lens-audio-export---0e943ef0-db81-458b-b2f9-e2d11ea8b284.json";

const client = new ConvexHttpClient(CONVEX_URL);
const allSermons = JSON.parse(readFileSync(AUDIO_EXPORT, "utf8"));

// Only Bert's sermons (his Supabase user prefix)
const sermons = allSermons.filter(s => s.file_url.startsWith("1902a65a-"));
console.log(`Processing ${sermons.length} of ${allSermons.length} sermons (Bert's only)\n`);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fmt(bytes) { return `${(bytes/1024/1024).toFixed(1)}MB`; }

let done = 0, skipped = 0, failed = 0;

for (const sermon of sermons) {
  const n = done + skipped + failed + 1;
  const label = `[${n}/${sermons.length}] "${sermon.title}"`;
  const ext = sermon.file_url.split('.').pop().toLowerCase();
  const mime = {mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav'}[ext] || 'audio/mpeg';
  const tmpFile = join(tmpdir(), `pl-audio-${n}.${ext}`);

  try {
    // Download
    process.stdout.write(`${label}\n  ↓ `);
    const dl = await fetch(sermon.signed_url);
    if (!dl.ok) throw new Error(`Download failed: ${dl.status}`);
    await pipeline(dl.body, createWriteStream(tmpFile));
    const size = statSync(tmpFile).size;
    process.stdout.write(`${fmt(size)} downloaded\n  ↑ uploading...`);

    // Get Convex upload URL
    const uploadUrl = await client.mutation("migration:generateUploadUrlUnauthed", {});

    // Upload (readFileSync is fine for up to ~200MB)
    const body = readFileSync(tmpFile);
    const up = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mime },
      body,
    });
    if (!up.ok) throw new Error(`Upload failed: ${up.status} ${await up.text()}`);
    const { storageId } = await up.json();
    if (!storageId) throw new Error(`No storageId in upload response`);
    process.stdout.write(` ${storageId.slice(0,10)}...\n  ↻ updating...`);

    // Update Convex sermon record (tries fileUrl match, falls back to title)
    const updated = await client.mutation("migration:updateSermonAudio", {
      supabaseFileUrl: sermon.file_url,
      fullFileUrl: `${SUPABASE_BASE}/${sermon.file_url}`,
      title: sermon.title || "",
      fileId: storageId,
    });

    if (updated) {
      console.log(` ✓`);
      done++;
    } else {
      console.log(` ⚠ no match`);
      skipped++;
    }

    unlinkSync(tmpFile);
    await sleep(200);

  } catch (err) {
    console.log(`\n  ✗ ${err.message}`);
    failed++;
    if (existsSync(tmpFile)) try { unlinkSync(tmpFile); } catch {}
  }
}

console.log(`\n=== Audio migration complete ===`);
console.log(`  ✓ ${done}  ⚠ ${skipped}  ✗ ${failed}`);
