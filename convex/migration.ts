import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── User ID fix ────────────────────────────────────────────────────────────

export const fixAllUserIds = mutation({
  args: {
    oldUserId: v.string(),
    newUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const tables = [
      "communicators",
      "sermons",
      "sermonComments",
      "sermonHighlights",
      "sermonMetrics",
      "evaluationRules",
      "coachStyleGuides",
    ] as const;

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const rows = await ctx.db
        .query(table)
        .filter((q) => q.eq(q.field("userId"), args.oldUserId))
        .collect();
      for (const row of rows) {
        await ctx.db.patch(row._id, { userId: args.newUserId });
      }
      counts[table] = rows.length;
    }

    return counts;
  },
});

// ─── Migration mutations ──────────────────────────────────────────────────────

export const createCommunicatorMigrated = mutation({
  args: { userId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("communicators", {
      userId: args.userId,
      name: args.name.trim(),
    });
  },
});

export const createSermonMigrated = mutation({
  args: {
    userId: v.string(),
    title: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    fileType: v.string(),
    transcriptionStatus: v.string(),
    durationSeconds: v.optional(v.number()),
    communicatorId: v.optional(v.id("communicators")),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sermons", {
      userId: args.userId,
      title: args.title,
      fileUrl: args.fileUrl,
      fileType: args.fileType,
      transcriptionStatus: args.transcriptionStatus,
      durationSeconds: args.durationSeconds,
      communicatorId: args.communicatorId,
      createdAt: args.createdAt,
    });
  },
});

export const saveSentencesBulk = mutation({
  args: {
    sermonId: v.id("sermons"),
    sentences: v.array(v.object({
      orderIndex: v.number(),
      sentenceText: v.string(),
      startTimeMs: v.number(),
      endTimeMs: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    for (const s of args.sentences) {
      await ctx.db.insert("sermonSentences", {
        sermonId: args.sermonId,
        orderIndex: s.orderIndex,
        sentenceText: s.sentenceText,
        startTimeMs: s.startTimeMs,
        endTimeMs: s.endTimeMs,
      });
    }
  },
});

export const createCommentMigrated = mutation({
  args: {
    userId: v.string(),
    sermonId: v.id("sermons"),
    commentText: v.string(),
    startTimeMs: v.number(),
    endTimeMs: v.number(),
    audioUrl: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sermonComments", {
      userId: args.userId,
      sermonId: args.sermonId,
      commentText: args.commentText,
      startTimeMs: args.startTimeMs,
      endTimeMs: args.endTimeMs,
      audioUrl: args.audioUrl,
      createdAt: args.createdAt,
    });
  },
});

export const createHighlightMigrated = mutation({
  args: {
    userId: v.string(),
    sermonId: v.id("sermons"),
    sentenceIndex: v.number(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sermonHighlights", {
      userId: args.userId,
      sermonId: args.sermonId,
      sentenceIndex: args.sentenceIndex,
      color: args.color,
    });
  },
});

export const createMetricsMigrated = mutation({
  args: {
    userId: v.string(),
    sermonId: v.id("sermons"),
    wpm: v.optional(v.number()),
    wordCount: v.optional(v.number()),
    engagementScore: v.optional(v.number()),
    illustrationScore: v.optional(v.number()),
    emotionalResonanceScore: v.optional(v.number()),
    congregationQuestions: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sermonMetrics", {
      userId: args.userId,
      sermonId: args.sermonId,
      wpm: args.wpm,
      wordCount: args.wordCount,
      engagementScore: args.engagementScore,
      illustrationScore: args.illustrationScore,
      emotionalResonanceScore: args.emotionalResonanceScore,
      congregationQuestions: args.congregationQuestions,
    });
  },
});
