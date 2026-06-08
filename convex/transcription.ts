import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

interface AssemblyAISentence {
  text: string;
  start: number;
  end: number;
}

export const transcribeSermon = internalAction({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const assemblyApiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!assemblyApiKey) {
      await ctx.runMutation(internal.sermons.setStatus, {
        sermonId: args.sermonId,
        status: "error",
        errorMessage: "AssemblyAI API key not configured",
      });
      return;
    }

    try {
      // Get sermon record
      const sermon = await ctx.runQuery(internal.sermons.getInternal, {
        sermonId: args.sermonId,
      });
      if (!sermon) throw new Error("Sermon not found");

      // Update to processing
      await ctx.runMutation(internal.sermons.setStatus, {
        sermonId: args.sermonId,
        status: "processing",
      });

      // Get storage URL
      let audioUrl: string;
      if (sermon.fileId) {
        const url = await ctx.storage.getUrl(sermon.fileId);
        if (!url) throw new Error("Could not get storage URL");
        audioUrl = url;
      } else if (sermon.fileUrl) {
        audioUrl = sermon.fileUrl;
      } else {
        throw new Error("No audio file found");
      }

      // Submit transcription to AssemblyAI
      const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: {
          Authorization: assemblyApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          punctuate: true,
          format_text: true,
          sentiment_analysis: false,
          auto_highlights: false,
          summarization: false,
        }),
      });

      if (!transcriptRes.ok) {
        const err = await transcriptRes.text();
        throw new Error(`AssemblyAI submit failed: ${err}`);
      }

      const transcript = await transcriptRes.json();
      const transcriptId: string = transcript.id;

      await ctx.runMutation(internal.sermons.setStatus, {
        sermonId: args.sermonId,
        status: "processing",
        assemblyAiTranscriptId: transcriptId,
      });

      // Poll for completion (max ~12 minutes)
      let attempts = 0;
      const maxAttempts = 144; // 144 × 5s = 12 min

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 5000));
        attempts++;

        const statusRes = await fetch(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          { headers: { Authorization: assemblyApiKey } }
        );
        const statusData = await statusRes.json();

        if (statusData.status === "error") {
          throw new Error(`AssemblyAI error: ${statusData.error}`);
        }

        if (statusData.status === "completed") {
          // Fetch sentences
          const sentencesRes = await fetch(
            `https://api.assemblyai.com/v2/transcript/${transcriptId}/sentences`,
            { headers: { Authorization: assemblyApiKey } }
          );
          const sentencesData = await sentencesRes.json();
          const rawSentences: AssemblyAISentence[] = sentencesData.sentences || [];

          const sentences = rawSentences.map((s, i) => ({
            orderIndex: i,
            sentenceText: s.text,
            startTimeMs: s.start,
            endTimeMs: s.end,
          }));

          const durationMs = statusData.audio_duration
            ? statusData.audio_duration * 1000
            : rawSentences.length > 0
            ? rawSentences[rawSentences.length - 1].end
            : undefined;

          await ctx.runMutation(internal.sermons.saveSentences, {
            sermonId: args.sermonId,
            sentences,
            durationSeconds: durationMs ? Math.round(durationMs / 1000) : undefined,
          });

          // Kick off analytics pipeline
          await ctx.runAction(internal.analytics.runAllAnalytics, {
            sermonId: args.sermonId,
          });

          return;
        }

        // status === "queued" or "processing" — keep polling
      }

      throw new Error("Transcription timed out after 12 minutes");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.sermons.setStatus, {
        sermonId: args.sermonId,
        status: "error",
        errorMessage: message,
      });
    }
  },
});
