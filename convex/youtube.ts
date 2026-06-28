import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Extracts audio from a YouTube URL via the local yt-audio-service tunnel,
 * uploads the resulting MP3 to Convex storage, and creates a sermon record.
 */
export const extractAndCreate = action({
  args: {
    youtubeUrl: v.string(),
    title: v.optional(v.string()),
    communicatorId: v.optional(v.id("communicators")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const serviceUrl = process.env.YT_SERVICE_URL;
    const serviceSecret = process.env.YT_SERVICE_SECRET;
    if (!serviceUrl) throw new Error("YT_SERVICE_URL not configured");

    // 1. Call the local extraction service
    const extractRes = await fetch(`${serviceUrl}/extract-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serviceSecret ? { "x-api-secret": serviceSecret } : {}),
      },
      body: JSON.stringify({ url: args.youtubeUrl }),
    });

    if (!extractRes.ok) {
      const detail = await extractRes.text().catch(() => extractRes.statusText);
      throw new Error(`Audio extraction failed: ${detail}`);
    }

    // 2. Get an upload URL from Convex storage
    const uploadUrl: string = await ctx.runMutation(api.sermons.generateUploadUrl);

    // 3. Stream the MP3 directly into Convex storage
    const audioBlob = await extractRes.blob();
    const storeRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "audio/mpeg" },
      body: audioBlob,
    });
    if (!storeRes.ok) throw new Error(`Storage upload failed: ${storeRes.statusText}`);
    const { storageId } = await storeRes.json();

    // 4. Create the sermon record (triggers transcription)
    const sermonId: string = await ctx.runMutation(api.sermons.create, {
      title: args.title?.trim() || "YouTube Sermon",
      fileId: storageId,
      fileType: "audio",
      communicatorId: args.communicatorId,
    });

    return { sermonId };
  },
});
