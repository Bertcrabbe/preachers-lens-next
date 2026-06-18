import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    fileId: v.id("_storage"),
    fileType: v.string(),
    communicatorId: v.optional(v.id("communicators")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sermonId = await ctx.db.insert("sermons", {
      userId: identity.subject,
      title: args.title,
      fileId: args.fileId,
      fileType: args.fileType,
      transcriptionStatus: "pending",
      communicatorId: args.communicatorId,
      createdAt: Date.now(),
    });

    // Kick off transcription in the background
    await ctx.scheduler.runAfter(0, internal.transcription.transcribeSermon, { sermonId });

    return sermonId;
  },
});

export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermons")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const sermon = await ctx.db.get(args.sermonId);
    if (!sermon || sermon.userId !== identity.subject) return null;
    return sermon;
  },
});

export const updateTitle = mutation({
  args: { sermonId: v.id("sermons"), title: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const sermon = await ctx.db.get(args.sermonId);
    if (!sermon || sermon.userId !== identity.subject) throw new Error("Not found");
    await ctx.db.patch(args.sermonId, { title: args.title });
  },
});

export const assignCommunicator = mutation({
  args: {
    sermonId: v.id("sermons"),
    communicatorId: v.optional(v.id("communicators")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const sermon = await ctx.db.get(args.sermonId);
    if (!sermon || sermon.userId !== identity.subject) throw new Error("Not found");
    await ctx.db.patch(args.sermonId, { communicatorId: args.communicatorId });
  },
});

export const remove = mutation({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const sermon = await ctx.db.get(args.sermonId);
    if (!sermon || sermon.userId !== identity.subject) throw new Error("Not found");

    // Delete related records
    const sentences = await ctx.db
      .query("sermonSentences")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
    for (const s of sentences) await ctx.db.delete(s._id);

    const comments = await ctx.db
      .query("sermonComments")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);

    const highlights = await ctx.db
      .query("sermonHighlights")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
    for (const h of highlights) await ctx.db.delete(h._id);

    const metrics = await ctx.db
      .query("sermonMetrics")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
    for (const m of metrics) await ctx.db.delete(m._id);

    // Delete file from storage
    if (sermon.fileId) {
      await ctx.storage.delete(sermon.fileId);
    }

    await ctx.db.delete(args.sermonId);
  },
});

export const getStorageUrl = query({
  args: { storageId: v.string() }, // accept string to handle migrated IDs
  handler: async (ctx, args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await ctx.storage.getUrl(args.storageId as any);
  },
});

// ---------------------------------------------------------------------------
// Public queries for the sermon viewer
// ---------------------------------------------------------------------------

export const getSermonMetrics = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("sermonMetrics")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .first();
  },
});

export const getSentenceMetrics = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonSentenceMetrics")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getFillerWords = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonFillerWords")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getSilences = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonSilences")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getScriptureRefs = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonScriptureRefs")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getConfusingPhrases = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonConfusingPhrases")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getQuestions = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonQuestions")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getMissedQuestions = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonMissedQuestions")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getIllustrations = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonIllustrations")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getIntent = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("sermonIntent")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .first();
  },
});

// ---------------------------------------------------------------------------
// Internal queries/mutations called from actions
// ---------------------------------------------------------------------------

export const getInternal = internalQuery({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sermonId);
  },
});

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


export const setStatus = internalMutation({
  args: {
    sermonId: v.id("sermons"),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    assemblyAiTranscriptId: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sermonId, {
      transcriptionStatus: args.status,
      errorMessage: args.errorMessage,
      assemblyAiTranscriptId: args.assemblyAiTranscriptId,
      durationSeconds: args.durationSeconds,
    });
  },
});

export const saveSentences = internalMutation({
  args: {
    sermonId: v.id("sermons"),
    sentences: v.array(
      v.object({
        orderIndex: v.number(),
        sentenceText: v.string(),
        startTimeMs: v.number(),
        endTimeMs: v.number(),
      })
    ),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    for (const s of args.sentences) {
      await ctx.db.insert("sermonSentences", {
        sermonId: args.sermonId,
        ...s,
      });
    }
    await ctx.db.patch(args.sermonId, {
      transcriptionStatus: "completed",
      durationSeconds: args.durationSeconds,
    });
  },
});

export const getSentences = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const sermon = await ctx.db.get(args.sermonId);
    if (!sermon || sermon.userId !== identity.subject) return [];
    return await ctx.db
      .query("sermonSentences")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getComments = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonComments")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const getHighlights = query({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sermonHighlights")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .collect();
  },
});

export const addComment = mutation({
  args: {
    sermonId: v.id("sermons"),
    commentText: v.string(),
    startTimeMs: v.number(),
    endTimeMs: v.number(),
    ruleId: v.optional(v.id("evaluationRules")),
    audioUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.db.insert("sermonComments", {
      userId: identity.subject,
      sermonId: args.sermonId,
      commentText: args.commentText,
      startTimeMs: args.startTimeMs,
      endTimeMs: args.endTimeMs,
      ruleId: args.ruleId,
      audioUrl: args.audioUrl,
      createdAt: Date.now(),
    });
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("sermonComments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.userId !== identity.subject) throw new Error("Not found");
    await ctx.db.delete(args.commentId);
  },
});

export const toggleHighlight = mutation({
  args: {
    sermonId: v.id("sermons"),
    sentenceIndex: v.number(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("sermonHighlights")
      .withIndex("by_sermon", (q) => q.eq("sermonId", args.sermonId))
      .filter((q) => q.eq(q.field("sentenceIndex"), args.sentenceIndex))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("sermonHighlights", {
        userId: identity.subject,
        sermonId: args.sermonId,
        sentenceIndex: args.sentenceIndex,
        color: args.color,
      });
    }
  },
});
