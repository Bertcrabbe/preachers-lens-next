import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";

const CONVEX_URL = "https://elated-setter-33.convex.cloud";
const EXPORT_FILE = "/home/exedev/.openclaw/media/inbound/preachers-lens-export---ced91691-f5a3-4236-bd52-b18ec61c795c.json";
// Bert's Clerk user ID (from JWT token shared during setup)
const CLERK_USER_ID = "user_01KT55JVKKNZXV8ZXRREBNJK46";
// Supabase base URL for audio files
const SUPABASE_STORAGE_URL = "https://lrvisxodjsubifwyfkjr.supabase.co/storage/v1/object/public/sermons";

const client = new ConvexHttpClient(CONVEX_URL);

const data = JSON.parse(readFileSync(EXPORT_FILE, "utf8"));
const { communicators, sermons, sermon_sentences, sermon_comments, sermon_highlights, sermon_metrics, evaluation_rules } = data.tables;

// Map old Supabase IDs to new Convex IDs
const commIdMap = {};   // supabase_id -> convex_id
const sermonIdMap = {}; // supabase_id -> convex_id

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Batch insert with rate limiting
async function batchRun(items, fn, batchSize = 10, delayMs = 100) {
  let done = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(fn));
    done += batch.length;
    process.stdout.write(`\r  ${done}/${items.length}`);
    if (i + batchSize < items.length) await sleep(delayMs);
  }
  console.log();
}

console.log("=== Preacher's Lens Migration: Supabase → Convex ===\n");

// 1. Communicators
console.log(`[1/7] Communicators (${communicators.length})...`);
await batchRun(communicators, async (c) => {
  const id = await client.mutation("migration:createCommunicatorMigrated", {
    userId: CLERK_USER_ID,
    name: c.name,
  });
  commIdMap[c.id] = id;
}, 5, 200);
console.log(`  ✓ ${Object.keys(commIdMap).length} communicators created`);

// 2. Sermons
console.log(`[2/7] Sermons (${sermons.length})...`);
const completedSermons = sermons.filter(s => s.transcription_status === 'completed');
const otherSermons = sermons.filter(s => s.transcription_status !== 'completed');
console.log(`  ${completedSermons.length} completed, ${otherSermons.length} other status`);

await batchRun(sermons, async (s) => {
  // Build the public Supabase storage URL for the audio file
  const fileUrl = s.file_url
    ? `${SUPABASE_STORAGE_URL}/${s.file_url}`
    : undefined;

  const id = await client.mutation("migration:createSermonMigrated", {
    userId: CLERK_USER_ID,
    title: s.title || undefined,
    fileUrl,
    fileType: s.file_type || "audio",
    transcriptionStatus: s.transcription_status === 'completed' ? 'completed' : s.transcription_status,
    durationSeconds: s.duration_seconds || undefined,
    communicatorId: s.communicator_id ? commIdMap[s.communicator_id] : undefined,
    createdAt: new Date(s.created_at).getTime(),
  });
  sermonIdMap[s.id] = id;
}, 5, 200);
console.log(`  ✓ ${Object.keys(sermonIdMap).length} sermons created`);

// 3. Sermon sentences
console.log(`[3/7] Sermon sentences (${sermon_sentences.length})...`);
// Group by sermon for efficiency
const sentencesBySermon = {};
for (const s of sermon_sentences) {
  if (!sentencesBySermon[s.sermon_id]) sentencesBySermon[s.sermon_id] = [];
  sentencesBySermon[s.sermon_id].push(s);
}

let sentencesDone = 0;
for (const [supSermonId, sentences] of Object.entries(sentencesBySermon)) {
  const convexSermonId = sermonIdMap[supSermonId];
  if (!convexSermonId) continue;

  // Insert in chunks of 200 sentences per mutation
  for (let i = 0; i < sentences.length; i += 200) {
    const chunk = sentences.slice(i, i + 200);
    await client.mutation("migration:saveSentencesBulk", {
      sermonId: convexSermonId,
      sentences: chunk.map(s => ({
        orderIndex: s.order_index,
        sentenceText: s.sentence_text,
        startTimeMs: s.start_time_ms,
        endTimeMs: s.end_time_ms,
      })),
    });
    sentencesDone += chunk.length;
    process.stdout.write(`\r  ${sentencesDone}/${sermon_sentences.length}`);
    await sleep(150);
  }
}
console.log(`\n  ✓ ${sentencesDone} sentences inserted`);

// 4. Comments
console.log(`[4/7] Comments (${sermon_comments.length})...`);
let commentsDone = 0;
await batchRun(sermon_comments, async (c) => {
  const convexSermonId = sermonIdMap[c.sermon_id];
  if (!convexSermonId) return;
  await client.mutation("migration:createCommentMigrated", {
    userId: CLERK_USER_ID,
    sermonId: convexSermonId,
    commentText: c.comment_text,
    startTimeMs: c.start_time_ms,
    endTimeMs: c.end_time_ms,
    audioUrl: c.audio_url || undefined,
    createdAt: new Date(c.created_at).getTime(),
  });
  commentsDone++;
}, 5, 200);
console.log(`  ✓ ${commentsDone} comments inserted`);

// 5. Highlights
console.log(`[5/7] Highlights (${sermon_highlights.length})...`);
let highlightsDone = 0;
await batchRun(sermon_highlights, async (h) => {
  const convexSermonId = sermonIdMap[h.sermon_id];
  if (!convexSermonId) return;
  await client.mutation("migration:createHighlightMigrated", {
    userId: CLERK_USER_ID,
    sermonId: convexSermonId,
    sentenceIndex: h.sentence_index,
    color: h.color,
  });
  highlightsDone++;
}, 5, 200);
console.log(`  ✓ ${highlightsDone} highlights inserted`);

// 6. Metrics
console.log(`[6/7] Metrics (${sermon_metrics.length})...`);
let metricsDone = 0;
await batchRun(sermon_metrics, async (m) => {
  const convexSermonId = sermonIdMap[m.sermon_id];
  if (!convexSermonId) return;
  await client.mutation("migration:createMetricsMigrated", {
    userId: CLERK_USER_ID,
    sermonId: convexSermonId,
    wpm: m.wpm || undefined,
    wordCount: m.word_count || undefined,
    engagementScore: m.engagement_score || undefined,
    illustrationScore: m.illustration_score || undefined,
    emotionalResonanceScore: m.emotional_resonance_score || undefined,
    congregationQuestions: m.congregation_questions || undefined,
  });
  metricsDone++;
}, 5, 200);
console.log(`  ✓ ${metricsDone} metrics inserted`);

// 7. Evaluation rules
console.log(`[7/7] Evaluation rules (${evaluation_rules.length})...`);
let rulesDone = 0;
await batchRun(evaluation_rules, async (r) => {
  await client.mutation("evaluationRules:create", {
    userId: CLERK_USER_ID,
    name: r.name,
    description: r.description || "",
    prompt: r.prompt || "",
    color: r.color || "#6366f1",
  });
  rulesDone++;
}, 5, 200);
console.log(`  ✓ ${rulesDone} evaluation rules inserted`);

console.log("\n=== Migration complete! ===");
console.log(`  Communicators: ${Object.keys(commIdMap).length}`);
console.log(`  Sermons: ${Object.keys(sermonIdMap).length}`);
console.log(`  Sentences: ${sentencesDone}`);
console.log(`  Comments: ${commentsDone}`);
console.log(`  Highlights: ${highlightsDone}`);
console.log(`  Metrics: ${metricsDone}`);
console.log(`  Rules: ${rulesDone}`);
