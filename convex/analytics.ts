import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// Helper: call Anthropic claude-haiku-4-5 (cheapest fast model)
// ---------------------------------------------------------------------------
async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.content[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Helper: parse JSON from AI response (strips markdown fences if present)
// ---------------------------------------------------------------------------
function parseJson(text: string): unknown {
  const stripped = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(stripped);
}

// ---------------------------------------------------------------------------
// Internal query: get sentences for a sermon (used by analytics actions)
// ---------------------------------------------------------------------------
export const getSentencesInternal = internalQuery({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sermonSentences")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .order("asc")
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Internal mutation: clear all analytics rows for a sermon
// ---------------------------------------------------------------------------
export const clearAnalytics = internalMutation({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const tables = [
      "sermonSentenceMetrics",
      "sermonFillerWords",
      "sermonSilences",
      "sermonScriptureRefs",
      "sermonConfusingPhrases",
      "sermonQuestions",
      "sermonMissedQuestions",
      "sermonIllustrations",
      "sermonIntent",
    ] as const;

    for (const table of tables) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
  },
});

// ---------------------------------------------------------------------------
// Internal mutation: upsert sermonMetrics (patch or insert)
// ---------------------------------------------------------------------------
export const upsertSermonMetrics = internalMutation({
  args: {
    sermonId: v.id("sermons"),
    userId: v.string(),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sermonMetrics")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args.patch, updatedAt: now });
    } else {
      await ctx.db.insert("sermonMetrics", {
        userId: args.userId,
        sermonId: args.sermonId,
        ...args.patch,
        updatedAt: now,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Internal mutations: bulk insert for each analytics table
// ---------------------------------------------------------------------------
export const insertSentenceMetrics = internalMutation({
  args: {
    rows: v.array(
      v.object({
        sermonId: v.id("sermons"),
        sentenceIndex: v.number(),
        wpm: v.number(),
        wordCount: v.number(),
        startTimeMs: v.number(),
        endTimeMs: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) await ctx.db.insert("sermonSentenceMetrics", row);
  },
});

export const insertFillerWords = internalMutation({
  args: {
    rows: v.array(
      v.object({
        sermonId: v.id("sermons"),
        word: v.string(),
        count: v.number(),
        occurrences: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) await ctx.db.insert("sermonFillerWords", row);
  },
});

export const insertSilences = internalMutation({
  args: {
    rows: v.array(
      v.object({
        sermonId: v.id("sermons"),
        startTimeMs: v.number(),
        endTimeMs: v.number(),
        durationMs: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) await ctx.db.insert("sermonSilences", row);
  },
});

export const insertScriptureRefs = internalMutation({
  args: {
    rows: v.array(
      v.object({
        sermonId: v.id("sermons"),
        reference: v.string(),
        context: v.string(),
        startTimeMs: v.number(),
        sentenceIndex: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) await ctx.db.insert("sermonScriptureRefs", row);
  },
});

export const insertConfusingPhrases = internalMutation({
  args: {
    rows: v.array(
      v.object({
        sermonId: v.id("sermons"),
        phrase: v.string(),
        severity: v.string(),
        suggestion: v.string(),
        sentenceIndex: v.number(),
        startTimeMs: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) await ctx.db.insert("sermonConfusingPhrases", row);
  },
});

export const insertQuestions = internalMutation({
  args: {
    rows: v.array(
      v.object({
        sermonId: v.id("sermons"),
        questionText: v.string(),
        isCongregationQuestion: v.boolean(),
        sentenceIndex: v.number(),
        startTimeMs: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) await ctx.db.insert("sermonQuestions", row);
  },
});

export const insertMissedQuestions = internalMutation({
  args: {
    rows: v.array(
      v.object({
        sermonId: v.id("sermons"),
        originalText: v.string(),
        suggestedQuestion: v.string(),
        sentenceIndex: v.number(),
        startTimeMs: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) await ctx.db.insert("sermonMissedQuestions", row);
  },
});

export const insertIllustrations = internalMutation({
  args: {
    rows: v.array(
      v.object({
        sermonId: v.id("sermons"),
        type: v.string(),
        description: v.string(),
        startSentenceIndex: v.number(),
        endSentenceIndex: v.number(),
        startTimeMs: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) await ctx.db.insert("sermonIllustrations", row);
  },
});

export const upsertIntent = internalMutation({
  args: {
    sermonId: v.id("sermons"),
    know: v.string(),
    feel: v.string(),
    doAction: v.string(),
    emotionalTone: v.string(),
    headHeartRatio: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sermonIntent")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        know: args.know,
        feel: args.feel,
        doAction: args.doAction,
        emotionalTone: args.emotionalTone,
        headHeartRatio: args.headHeartRatio,
      });
    } else {
      await ctx.db.insert("sermonIntent", {
        sermonId: args.sermonId,
        know: args.know,
        feel: args.feel,
        doAction: args.doAction,
        emotionalTone: args.emotionalTone,
        headHeartRatio: args.headHeartRatio,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Internal query: get metrics for engagement score computation
// ---------------------------------------------------------------------------
export const getMetricsInternal = internalQuery({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const [illustrations, scriptureRefs, questions, silences, confusingPhrases, metrics] =
      await Promise.all([
        ctx.db
          .query("sermonIllustrations")
          .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
          .collect(),
        ctx.db
          .query("sermonScriptureRefs")
          .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
          .collect(),
        ctx.db
          .query("sermonQuestions")
          .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
          .filter((q) => q.eq(q.field("isCongregationQuestion"), true))
          .collect(),
        ctx.db
          .query("sermonSilences")
          .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
          .collect(),
        ctx.db
          .query("sermonConfusingPhrases")
          .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
          .collect(),
        ctx.db
          .query("sermonMetrics")
          .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
          .first(),
      ]);
    return { illustrations, scriptureRefs, questions, silences, confusingPhrases, metrics };
  },
});

// ---------------------------------------------------------------------------
// computeWpm — internalAction
// ---------------------------------------------------------------------------
export const computeWpm = internalAction({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const sentences = await ctx.runQuery(internal.analytics.getSentencesInternal, {
      sermonId: args.sermonId,
    });

    if (sentences.length === 0) return;

    const sermon = await ctx.runQuery(internal.sermons.getInternal, {
      sermonId: args.sermonId,
    });
    if (!sermon) return;

    // --- Sentence WPM metrics ---
    const sentenceMetrics = sentences.map((s, i) => {
      const wordCount = s.sentenceText.split(/\s+/).filter(Boolean).length;
      const durationMs = s.endTimeMs - s.startTimeMs;
      const wpm =
        durationMs > 0 ? Math.round((wordCount / (durationMs / 1000)) * 60) : 0;
      return {
        sermonId: args.sermonId,
        sentenceIndex: i,
        wpm,
        wordCount,
        startTimeMs: s.startTimeMs,
        endTimeMs: s.endTimeMs,
      };
    });

    // Clear and insert sentence metrics
    const existingMetrics = await ctx.runQuery(internal.analytics.getSentencesInternal, {
      sermonId: args.sermonId,
    });
    void existingMetrics; // already fetched above

    await ctx.runMutation(internal.analytics.insertSentenceMetrics, {
      rows: sentenceMetrics,
    });

    // --- Aggregate WPM stats ---
    const wpms = sentenceMetrics.map((m) => m.wpm).filter((w) => w > 0);
    const totalWords = sentenceMetrics.reduce((sum, m) => sum + m.wordCount, 0);
    const avgWpm = wpms.length > 0 ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length) : 0;

    await ctx.runMutation(internal.analytics.upsertSermonMetrics, {
      sermonId: args.sermonId,
      userId: sermon.userId,
      patch: { wpm: avgWpm, wordCount: totalWords },
    });

    // --- Silences: gaps > 3000ms between consecutive sentences ---
    const silences: {
      sermonId: typeof args.sermonId;
      startTimeMs: number;
      endTimeMs: number;
      durationMs: number;
    }[] = [];
    for (let i = 1; i < sentences.length; i++) {
      const gap = sentences[i].startTimeMs - sentences[i - 1].endTimeMs;
      if (gap > 3000) {
        silences.push({
          sermonId: args.sermonId,
          startTimeMs: sentences[i - 1].endTimeMs,
          endTimeMs: sentences[i].startTimeMs,
          durationMs: gap,
        });
      }
    }
    if (silences.length > 0) {
      await ctx.runMutation(internal.analytics.insertSilences, { rows: silences });
    }

    // --- Filler words ---
    const fillerWords = [
      "um",
      "uh",
      "like",
      "you know",
      "basically",
      "literally",
      "actually",
      "so",
      "right",
      "okay",
      "well",
      "kind of",
      "sort of",
      "i mean",
    ];

    type FillerOccurrence = { sentenceIndex: number; startTimeMs: number };
    const fillerMap = new Map<string, FillerOccurrence[]>();

    for (let i = 0; i < sentences.length; i++) {
      const text = sentences[i].sentenceText.toLowerCase();
      for (const word of fillerWords) {
        const regex = new RegExp(`\\b${word.replace(/\s+/g, "\\s+")}\\b`, "gi");
        const matches = [...text.matchAll(regex)];
        if (matches.length > 0) {
          if (!fillerMap.has(word)) fillerMap.set(word, []);
          for (let m = 0; m < matches.length; m++) {
            fillerMap.get(word)!.push({
              sentenceIndex: i,
              startTimeMs: sentences[i].startTimeMs,
            });
          }
        }
      }
    }

    const fillerRows = Array.from(fillerMap.entries()).map(([word, occurrences]) => ({
      sermonId: args.sermonId,
      word,
      count: occurrences.length,
      occurrences: JSON.stringify(occurrences),
    }));

    if (fillerRows.length > 0) {
      await ctx.runMutation(internal.analytics.insertFillerWords, { rows: fillerRows });
    }
  },
});

// ---------------------------------------------------------------------------
// computeScriptureRefs — internalAction
// ---------------------------------------------------------------------------
export const computeScriptureRefs = internalAction({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log("computeScriptureRefs: ANTHROPIC_API_KEY not configured, skipping");
      return;
    }

    const sentences = await ctx.runQuery(internal.analytics.getSentencesInternal, {
      sermonId: args.sermonId,
    });
    if (sentences.length === 0) return;

    const sermon = await ctx.runQuery(internal.sermons.getInternal, {
      sermonId: args.sermonId,
    });
    if (!sermon) return;

    const numberedTranscript = sentences
      .map((s, i) => `[${i}] ${s.sentenceText}`)
      .join("\n");
    const maxChars = 30000;
    const transcript =
      numberedTranscript.length > maxChars
        ? numberedTranscript.slice(0, maxChars) + "\n[TRUNCATED]"
        : numberedTranscript;

    try {
      const raw = await callAnthropic(
        "You are a biblical scholar assistant. Identify all scripture references in sermons. Return only valid JSON.",
        `Analyze this sermon transcript. Each sentence is numbered with [index].
Identify ALL Bible citations/references with book, chapter, verse and the sentence index they appear in.

Return ONLY valid JSON (no markdown):
{"references": [{"reference": "Romans 6:1-4", "context": "brief quote or surrounding text", "sentenceIndex": 5}]}

Transcript:
${transcript}`,
        2048
      );

      const result = parseJson(raw) as {
        references?: Array<{ reference: string; context: string; sentenceIndex: number }>;
      };
      const refs = result.references ?? [];

      const rows = refs
        .filter((r) => r.sentenceIndex >= 0 && r.sentenceIndex < sentences.length)
        .map((r) => ({
          sermonId: args.sermonId,
          reference: r.reference ?? "",
          context: r.context ?? "",
          startTimeMs: sentences[r.sentenceIndex]?.startTimeMs ?? 0,
          sentenceIndex: r.sentenceIndex,
        }));

      if (rows.length > 0) {
        await ctx.runMutation(internal.analytics.insertScriptureRefs, { rows });
      }

      await ctx.runMutation(internal.analytics.upsertSermonMetrics, {
        sermonId: args.sermonId,
        userId: sermon.userId,
        patch: { scriptureRefs: rows.length },
      });
    } catch (err) {
      console.error("computeScriptureRefs error:", err);
    }
  },
});

// ---------------------------------------------------------------------------
// computeConfusingPhrases — internalAction
// ---------------------------------------------------------------------------
export const computeConfusingPhrases = internalAction({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log("computeConfusingPhrases: ANTHROPIC_API_KEY not configured, skipping");
      return;
    }

    const sentences = await ctx.runQuery(internal.analytics.getSentencesInternal, {
      sermonId: args.sermonId,
    });
    if (sentences.length === 0) return;

    const indexedTranscript = sentences
      .map((s, i) => `[${i}] ${s.sentenceText}`)
      .join("\n");
    const maxChars = 30000;
    const transcript =
      indexedTranscript.length > maxChars
        ? indexedTranscript.slice(0, maxChars) + "\n[TRUNCATED]"
        : indexedTranscript;

    try {
      const raw = await callAnthropic(
        `You are an expert at evaluating sermons for accessibility to first-time church visitors. Identify phrases that would confuse someone who has never been to church.

Look for: theological jargon without explanation, assumed Bible knowledge, church insider references (small groups, altar call), alienating phrases (washed in the blood), denominational references, assumptions about shared beliefs.

Do NOT flag: the name "Jesus", common English words, simple references to God/prayer/the Bible, phrases the speaker already explains.

Severity: mild = standalone biblical names; moderate = theological terms briefly explainable; severe = dense theological language, direct Trinitarian invocations, or multi-concept constructs requiring significant background.

Return only valid JSON.`,
        `Analyze this sermon transcript. Each sentence is prefixed with its index in brackets.
Return ONLY valid JSON (no markdown):
{"phrases": [{"sentenceIndex": 5, "phrase": "washed in the blood", "severity": "severe", "suggestion": "cleansed by Jesus sacrifice"}]}

Transcript:
${transcript}`,
        3000
      );

      const result = parseJson(raw) as {
        phrases?: Array<{
          sentenceIndex: number;
          phrase: string;
          severity: string;
          suggestion: string;
        }>;
      };
      const phrases = result.phrases ?? [];

      const rows = phrases
        .filter((p) => p.sentenceIndex >= 0 && p.sentenceIndex < sentences.length)
        .map((p) => ({
          sermonId: args.sermonId,
          phrase: p.phrase ?? "",
          severity: p.severity ?? "mild",
          suggestion: p.suggestion ?? "",
          sentenceIndex: p.sentenceIndex,
          startTimeMs: sentences[p.sentenceIndex]?.startTimeMs ?? 0,
        }));

      if (rows.length > 0) {
        await ctx.runMutation(internal.analytics.insertConfusingPhrases, { rows });
      }
    } catch (err) {
      console.error("computeConfusingPhrases error:", err);
    }
  },
});

// ---------------------------------------------------------------------------
// computeQuestions — internalAction
// ---------------------------------------------------------------------------
export const computeQuestions = internalAction({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const sentences = await ctx.runQuery(internal.analytics.getSentencesInternal, {
      sermonId: args.sermonId,
    });
    if (sentences.length === 0) return;

    // --- Questions (sentences ending with ?) ---
    const questionSentences = sentences
      .map((s, i) => ({ index: i, text: s.sentenceText.trim(), startTimeMs: s.startTimeMs }))
      .filter((s) => s.text.endsWith("?"));

    const questionRows: {
      sermonId: typeof args.sermonId;
      questionText: string;
      isCongregationQuestion: boolean;
      sentenceIndex: number;
      startTimeMs: number;
    }[] = [];

    if (questionSentences.length > 0) {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (apiKey) {
        // Use AI to classify congregation vs. non-congregation
        const questionsBlock = questionSentences
          .slice(0, 80)
          .map((q) => `[${q.index}] "${q.text}"`)
          .join("\n");

        try {
          const raw = await callAnthropic(
            `You are a sermon analysis expert. Classify questions as directed TO THE CONGREGATION or not.
Questions TO congregation: direct engagement ("How many of you...?"), rhetorical for reflection ("Have you ever felt...?"), invitations to respond ("Are you ready?").
Questions NOT to congregation: narrative questions ("What did Jesus say next?"), scripture quotes, self-rhetorical questions the preacher immediately answers.
Return only valid JSON.`,
            `Classify each question. Return ONLY valid JSON (no markdown):
{"congregation_indices": [list of sentence indices that are questions TO the congregation]}

Questions:
${questionsBlock}`,
            1024
          );

          const result = parseJson(raw) as { congregation_indices?: number[] };
          const congregationSet = new Set(result.congregation_indices ?? []);

          for (const q of questionSentences) {
            questionRows.push({
              sermonId: args.sermonId,
              questionText: q.text,
              isCongregationQuestion: congregationSet.has(q.index),
              sentenceIndex: q.index,
              startTimeMs: q.startTimeMs,
            });
          }
        } catch (err) {
          console.error("computeQuestions classification error:", err);
          // Fall back: store all as non-congregation
          for (const q of questionSentences) {
            questionRows.push({
              sermonId: args.sermonId,
              questionText: q.text,
              isCongregationQuestion: false,
              sentenceIndex: q.index,
              startTimeMs: q.startTimeMs,
            });
          }
        }
      } else {
        // No API key: store all questions, mark as non-classified
        for (const q of questionSentences) {
          questionRows.push({
            sermonId: args.sermonId,
            questionText: q.text,
            isCongregationQuestion: false,
            sentenceIndex: q.index,
            startTimeMs: q.startTimeMs,
          });
        }
      }
    }

    if (questionRows.length > 0) {
      await ctx.runMutation(internal.analytics.insertQuestions, { rows: questionRows });
    }

    // --- Missed question opportunities ---
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return;

    const candidateKeywords =
      /\b(many of us|some of us|all of us|we all|we've all|we have all|you've|you have|we know|we feel|we've felt|we have felt|i know what it|you know what it|there are times|there comes a time|it hurts|it's painful|the pain of|the joy of|the fear of|the shame of|the loneliness of|have known|has known|felt the|felt that|been there|carry the|carrying|wrestle with|struggle with|struggling with)\b/i;

    const candidates = sentences
      .map((s, i) => ({ index: i, text: s.sentenceText.trim(), startTimeMs: s.startTimeMs }))
      .filter((s) => {
        if (s.text.endsWith("?")) return false;
        if (s.text.length < 25) return false;
        return candidateKeywords.test(s.text);
      })
      .slice(0, 80);

    if (candidates.length === 0) return;

    const candidateBlock = candidates.map((c) => `[${c.index}] ${c.text}`).join("\n");

    try {
      const raw = await callAnthropic(
        `You are a homiletics coach. Identify declarative statements where rephrasing as a direct question would create dramatically more emotional impact.
Flag statements like "Many of us have known the pain of divorce" → "Do you know what it feels like to walk through a divorce?"
Do NOT flag: theological claims, scripture quotes, practical instructions, weak cases.
Return only valid JSON.`,
        `Analyze these candidate statements. Return ONLY valid JSON (no markdown):
{"opportunities": [{"index": <sentence_index>, "statement": "<original>", "suggested_question": "<rewrite under 15 words>"}]}

Candidates:
${candidateBlock}`,
        2048
      );

      const result = parseJson(raw) as {
        opportunities?: Array<{
          index: number;
          statement: string;
          suggested_question: string;
        }>;
      };
      const opps = result.opportunities ?? [];

      const missedRows = opps
        .filter(
          (o) =>
            typeof o.index === "number" &&
            o.index >= 0 &&
            o.index < sentences.length &&
            typeof o.suggested_question === "string" &&
            o.suggested_question.trim().length > 0
        )
        .map((o) => ({
          sermonId: args.sermonId,
          originalText: sentences[o.index].sentenceText,
          suggestedQuestion: o.suggested_question,
          sentenceIndex: o.index,
          startTimeMs: sentences[o.index].startTimeMs,
        }));

      if (missedRows.length > 0) {
        await ctx.runMutation(internal.analytics.insertMissedQuestions, { rows: missedRows });
      }
    } catch (err) {
      console.error("computeQuestions missed-opportunities error:", err);
    }
  },
});

// ---------------------------------------------------------------------------
// computeIllustrations — internalAction
// ---------------------------------------------------------------------------
export const computeIllustrations = internalAction({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log("computeIllustrations: ANTHROPIC_API_KEY not configured, skipping");
      return;
    }

    const sentences = await ctx.runQuery(internal.analytics.getSentencesInternal, {
      sermonId: args.sermonId,
    });
    if (sentences.length === 0) return;

    const sermon = await ctx.runQuery(internal.sermons.getInternal, {
      sermonId: args.sermonId,
    });
    if (!sermon) return;

    const indexedTranscript = sentences
      .map((s, i) => `[${i}] ${s.sentenceText}`)
      .join("\n");
    const maxChars = 60000;
    const transcript =
      indexedTranscript.length > maxChars
        ? indexedTranscript.slice(0, 40000) +
          "\n\n[...middle truncated...]\n\n" +
          indexedTranscript.slice(-15000)
        : indexedTranscript;

    try {
      const raw = await callAnthropic(
        `You are an expert at analyzing sermons for engagement. Identify illustrations, stories, humor, analogies, personal anecdotes, and crowd work moments.

Types: story (personal anecdotes/narratives), humor (jokes/lighthearted moments), illustration (analogies/metaphors/examples), crowd_work (audience interaction like "raise your hand", "turn to your neighbor").

For each element, provide: type, description (1-2 sentence summary), startSentenceIndex, endSentenceIndex (the range of sentences spanning the element).

Return only valid JSON.`,
        `Analyze this sermon transcript and identify all illustrations, stories, humor, analogies, and engaging elements. Each sentence is numbered [index].

Return ONLY valid JSON (no markdown):
{"elements": [{"type": "story", "description": "Brief summary", "startSentenceIndex": 10, "endSentenceIndex": 15}]}

Transcript:
${transcript}`,
        3000
      );

      const result = parseJson(raw) as {
        elements?: Array<{
          type: string;
          description: string;
          startSentenceIndex: number;
          endSentenceIndex: number;
        }>;
      };
      const elements = result.elements ?? [];

      const rows = elements
        .filter(
          (e) =>
            e.startSentenceIndex >= 0 &&
            e.startSentenceIndex < sentences.length &&
            e.endSentenceIndex >= 0
        )
        .map((e) => ({
          sermonId: args.sermonId,
          type: e.type ?? "illustration",
          description: e.description ?? "",
          startSentenceIndex: e.startSentenceIndex,
          endSentenceIndex: Math.min(e.endSentenceIndex, sentences.length - 1),
          startTimeMs: sentences[e.startSentenceIndex]?.startTimeMs ?? 0,
        }));

      if (rows.length > 0) {
        await ctx.runMutation(internal.analytics.insertIllustrations, { rows });
      }

      await ctx.runMutation(internal.analytics.upsertSermonMetrics, {
        sermonId: args.sermonId,
        userId: sermon.userId,
        patch: { illustrationCount: rows.length },
      });
    } catch (err) {
      console.error("computeIllustrations error:", err);
    }
  },
});

// ---------------------------------------------------------------------------
// computeIntent — internalAction
// ---------------------------------------------------------------------------
export const computeIntent = internalAction({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log("computeIntent: ANTHROPIC_API_KEY not configured, skipping");
      return;
    }

    const sentences = await ctx.runQuery(internal.analytics.getSentencesInternal, {
      sermonId: args.sermonId,
    });
    if (sentences.length === 0) return;

    const fullText = sentences.map((s) => s.sentenceText).join(" ");
    const maxChars = 40000;
    const transcript =
      fullText.length > maxChars
        ? fullText.slice(0, 20000) + "\n\n[...middle truncated...]\n\n" + fullText.slice(-15000)
        : fullText;

    try {
      const raw = await callAnthropic(
        `You are a homiletics coach. Every sermon should answer three questions about the preacher's intent:
1. KNOW — the core truth, idea, or doctrine (short phrase or single sentence under 12 words)
2. FEEL — the emotional response the preacher wants to evoke (short phrase under 12 words)
3. DO — the concrete action or change the preacher is calling for (short phrase under 12 words)

State the thing itself — no framing phrases like "the preacher wants..." or "listeners should...".
Also provide: emotionalTone (one-sentence description of the sermon's overall tone) and headHeartRatio (0-100, where 100 = fully emotional/affective, 0 = fully intellectual).

Return only valid JSON.`,
        `Analyze this sermon transcript. Return ONLY valid JSON (no markdown):
{
  "know": "<core truth stated plainly, under 12 words>",
  "feel": "<the emotion itself, e.g. 'Hopeful in the face of struggle.'>",
  "doAction": "<the action itself, e.g. 'Entrust their lives to Jesus Christ.'>",
  "emotionalTone": "<one sentence describing the sermon's overall emotional tone>",
  "headHeartRatio": <number 0-100 where 100 is fully emotional/affective>
}

Transcript:
${transcript}`,
        1024
      );

      const result = parseJson(raw) as {
        know?: string;
        feel?: string;
        doAction?: string;
        emotionalTone?: string;
        headHeartRatio?: number;
      };

      await ctx.runMutation(internal.analytics.upsertIntent, {
        sermonId: args.sermonId,
        know: result.know ?? "Not clearly addressed.",
        feel: result.feel ?? "Not clearly addressed.",
        doAction: result.doAction ?? "Not clearly addressed.",
        emotionalTone: result.emotionalTone ?? "",
        headHeartRatio: typeof result.headHeartRatio === "number" ? result.headHeartRatio : 50,
      });
    } catch (err) {
      console.error("computeIntent error:", err);
    }
  },
});

// ---------------------------------------------------------------------------
// computeEngagementScore — internalAction
// ---------------------------------------------------------------------------
export const computeEngagementScore = internalAction({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.analytics.getMetricsInternal, {
      sermonId: args.sermonId,
    });
    if (!data.metrics) return;

    const illustrationCount = data.illustrations.length;
    const questionCount = data.questions.length;
    const scriptureCount = data.scriptureRefs.length;
    const silenceCount = data.silences.length;
    const confusingPhrases = data.confusingPhrases;
    const wpm = data.metrics.wpm ?? 0;

    let score = 2; // base

    // Illustrations: up to 2 points
    if (illustrationCount >= 2) score += 2;
    else if (illustrationCount === 1) score += 1;

    // Questions: up to 2 points
    if (questionCount >= 3) score += 2;
    else if (questionCount >= 1) score += 1;

    // Scripture: up to 1.5 points
    if (scriptureCount >= 3) score += 1.5;
    else if (scriptureCount >= 1) score += 0.75;

    // Silence (pauses): up to 1 point
    if (silenceCount >= 3) score += 1;
    else if (silenceCount >= 1) score += 0.5;

    // Insider language penalty
    for (const phrase of confusingPhrases) {
      if (phrase.severity === "severe") score -= 0.5;
      else if (phrase.severity === "moderate") score -= 0.25;
    }

    // WPM sweet spot
    if (wpm >= 130 && wpm <= 160) score += 1.5;
    else if (wpm >= 110 && wpm <= 180) score += 1;
    else score += 0.5;

    const finalScore = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

    await ctx.runMutation(internal.analytics.upsertSermonMetrics, {
      sermonId: args.sermonId,
      userId: data.metrics.userId,
      patch: { engagementScore: finalScore },
    });
  },
});

// ---------------------------------------------------------------------------
// runAllAnalytics — internalAction (orchestrator)
// ---------------------------------------------------------------------------
export const runAllAnalytics = internalAction({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    // 1. Clear existing analytics
    await ctx.runMutation(internal.analytics.clearAnalytics, {
      sermonId: args.sermonId,
    });

    // 2. First: computeWpm (no dependencies)
    await ctx.runAction(internal.analytics.computeWpm, { sermonId: args.sermonId });

    // 3. Parallel: AI-powered analytics
    await Promise.allSettled([
      ctx.runAction(internal.analytics.computeScriptureRefs, { sermonId: args.sermonId }),
      ctx.runAction(internal.analytics.computeConfusingPhrases, { sermonId: args.sermonId }),
      ctx.runAction(internal.analytics.computeQuestions, { sermonId: args.sermonId }),
      ctx.runAction(internal.analytics.computeIllustrations, { sermonId: args.sermonId }),
      ctx.runAction(internal.analytics.computeIntent, { sermonId: args.sermonId }),
    ]);

    // 4. Engagement score (depends on all the above)
    await ctx.runAction(internal.analytics.computeEngagementScore, {
      sermonId: args.sermonId,
    });
  },
});

// ---------------------------------------------------------------------------
// Public mutation: triggerReanalysis — re-schedules all analytics for a sermon
// ---------------------------------------------------------------------------
export const triggerReanalysis = mutation({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    // Schedule the analytics action
    await ctx.scheduler.runAfter(0, internal.analytics.runAllAnalytics, { sermonId: args.sermonId });
  },
});
