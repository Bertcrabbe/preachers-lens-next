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
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Internal queries/mutations called from actions
export const getInternal = internalQuery({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sermonId);
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
