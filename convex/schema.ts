import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sermons: defineTable({
    userId: v.string(),
    communicatorId: v.optional(v.id("communicators")),
    title: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")), // Convex file storage
    fileUrl: v.optional(v.string()),       // fallback for migrated data
    fileType: v.string(),
    transcriptionStatus: v.string(),       // "pending" | "processing" | "completed" | "error"
    errorMessage: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    assemblyAiTranscriptId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_communicator", ["communicatorId"]),

  sermonSentences: defineTable({
    sermonId: v.id("sermons"),
    orderIndex: v.number(),
    sentenceText: v.string(),
    startTimeMs: v.number(),
    endTimeMs: v.number(),
  })
    .index("by_sermon", ["sermonId"]),

  sermonComments: defineTable({
    userId: v.string(),
    sermonId: v.id("sermons"),
    ruleId: v.optional(v.id("evaluationRules")),
    commentText: v.string(),
    startTimeMs: v.number(),
    endTimeMs: v.number(),
    audioUrl: v.optional(v.string()),
    audioFileId: v.optional(v.id("_storage")),
    createdAt: v.optional(v.number()),
  })
    .index("by_sermon", ["sermonId"])
    .index("by_user", ["userId"]),

  sermonHighlights: defineTable({
    userId: v.string(),
    sermonId: v.id("sermons"),
    sentenceIndex: v.number(),
    color: v.string(),
  })
    .index("by_sermon", ["sermonId"]),

  sermonMetrics: defineTable({
    userId: v.string(),
    sermonId: v.id("sermons"),
    wpm: v.optional(v.number()),
    wordCount: v.optional(v.number()),
    engagementScore: v.optional(v.number()),
    illustrationScore: v.optional(v.number()),
    emotionalResonanceScore: v.optional(v.number()),
    congregationQuestions: v.optional(v.number()),
    scriptureRefs: v.optional(v.number()),
    illustrationCount: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_sermon", ["sermonId"])
    .index("by_user", ["userId"]),

  communicators: defineTable({
    userId: v.string(),
    name: v.string(),
    voiceSampleFileId: v.optional(v.id("_storage")),
    voiceCloneId: v.optional(v.string()), // ElevenLabs or similar voice clone ID
  })
    .index("by_user", ["userId"]),

  communicatorLinks: defineTable({
    userId: v.string(),
    communicatorId: v.id("communicators"),
    label: v.string(),
    url: v.string(),
  })
    .index("by_communicator", ["communicatorId"]),

  evaluationRules: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.string(),
    color: v.string(),
    prompt: v.string(),
    orderIndex: v.optional(v.number()),
  })
    .index("by_user", ["userId"]),

  coachStyleGuides: defineTable({
    userId: v.string(),
    guideText: v.string(),
    commentsAnalyzed: v.number(),
    lastAnalyzedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"]),

  // Detailed per-sentence WPM data
  sermonSentenceMetrics: defineTable({
    sermonId: v.id("sermons"),
    sentenceIndex: v.number(),
    wpm: v.number(),
    wordCount: v.number(),
    startTimeMs: v.number(),
    endTimeMs: v.number(),
  }).index("by_sermon", ["sermonId"]),

  // Filler words
  sermonFillerWords: defineTable({
    sermonId: v.id("sermons"),
    word: v.string(),
    count: v.number(),
    // occurrences as JSON array of {sentenceIndex, startTimeMs}
    occurrences: v.string(),
  }).index("by_sermon", ["sermonId"]),

  // Silence pauses
  sermonSilences: defineTable({
    sermonId: v.id("sermons"),
    startTimeMs: v.number(),
    endTimeMs: v.number(),
    durationMs: v.number(),
  }).index("by_sermon", ["sermonId"]),

  // Scripture references
  sermonScriptureRefs: defineTable({
    sermonId: v.id("sermons"),
    reference: v.string(),
    context: v.string(),
    startTimeMs: v.number(),
    sentenceIndex: v.number(),
  }).index("by_sermon", ["sermonId"]),

  // Confusing phrases / insider language
  sermonConfusingPhrases: defineTable({
    sermonId: v.id("sermons"),
    phrase: v.string(),
    severity: v.string(),
    suggestion: v.string(),
    sentenceIndex: v.number(),
    startTimeMs: v.number(),
  }).index("by_sermon", ["sermonId"]),

  // Questions asked
  sermonQuestions: defineTable({
    sermonId: v.id("sermons"),
    questionText: v.string(),
    isCongregationQuestion: v.boolean(),
    sentenceIndex: v.number(),
    startTimeMs: v.number(),
  }).index("by_sermon", ["sermonId"]),

  // Missed question opportunities
  sermonMissedQuestions: defineTable({
    sermonId: v.id("sermons"),
    originalText: v.string(),
    suggestedQuestion: v.string(),
    sentenceIndex: v.number(),
    startTimeMs: v.number(),
  }).index("by_sermon", ["sermonId"]),

  // Illustrations / stories
  sermonIllustrations: defineTable({
    sermonId: v.id("sermons"),
    type: v.string(),
    description: v.string(),
    startSentenceIndex: v.number(),
    endSentenceIndex: v.number(),
    startTimeMs: v.number(),
  }).index("by_sermon", ["sermonId"]),

  // Preacher's intent
  sermonIntent: defineTable({
    sermonId: v.id("sermons"),
    know: v.string(),
    feel: v.string(),
    doAction: v.string(),
    emotionalTone: v.string(),
    headHeartRatio: v.number(),
  }).index("by_sermon", ["sermonId"]),

  // Evaluation rule results
  sermonRuleResults: defineTable({
    sermonId: v.id("sermons"),
    ruleId: v.id("evaluationRules"),
    flaggedSentences: v.string(),
    updatedAt: v.number(),
  }).index("by_sermon", ["sermonId"]).index("by_sermon_rule", ["sermonId", "ruleId"]),
});
