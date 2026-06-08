# Analytics Backend — Build Status

**Built:** 2026-06-07  
**Convex Deployment:** elated-setter-33.convex.cloud  
**TypeScript errors:** 0

---

## ✅ What Was Built

### Schema (convex/schema.ts)
All 11 new analytics tables added and deployed:
- `sermonSentenceMetrics` — per-sentence WPM data
- `sermonFillerWords` — filler word counts + occurrence positions
- `sermonSilences` — detected silence pauses (>3s gaps)
- `sermonScriptureRefs` — AI-detected Bible citations
- `sermonConfusingPhrases` — insider/jargon flags with severity
- `sermonQuestions` — questions (congregation + non-congregation classified by AI)
- `sermonMissedQuestions` — AI-suggested question rewrites
- `sermonIllustrations` — stories, humor, analogies, crowd work
- `sermonIntent` — Know/Feel/Do + emotional tone + head/heart ratio
- `sermonRuleResults` — evaluation rule flagged sentences
- All indexes confirmed deployed ✅

### convex/analytics.ts (NEW FILE)
All internal Actions + mutations/queries:

**Internal Actions:**
- `computeWpm` — per-sentence WPM, silences, filler words (no AI needed)
- `computeScriptureRefs` — Anthropic-powered Bible reference detection
- `computeConfusingPhrases` — insider language flagging with severity
- `computeQuestions` — congregation question classification + missed question opportunities
- `computeIllustrations` — story/humor/illustration/crowd_work detection
- `computeIntent` — Know/Feel/Do + emotional tone + headHeartRatio
- `computeEngagementScore` — 0-10 score computed from all analytics data
- `runAllAnalytics` — orchestrator (WPM → parallel AI analytics → engagement score)

**Internal Mutations:**
- `clearAnalytics` — wipes all 9 analytics tables for a sermon
- `upsertSermonMetrics` — patch/insert sermonMetrics
- `insertSentenceMetrics`, `insertFillerWords`, `insertSilences`
- `insertScriptureRefs`, `insertConfusingPhrases`, `insertQuestions`
- `insertMissedQuestions`, `insertIllustrations`, `upsertIntent`

**Internal Queries:**
- `getSentencesInternal` — all sentences for a sermon (used by analytics actions)
- `getMetricsInternal` — aggregated data for engagement score computation

### convex/sermons.ts (UPDATED)
New public queries for the sermon viewer:
- `getSermonMetrics`
- `getSentenceMetrics`
- `getFillerWords`
- `getSilences`
- `getScriptureRefs`
- `getConfusingPhrases`
- `getQuestions`
- `getMissedQuestions`
- `getIllustrations`
- `getIntent`

New internal query:
- `getSentencesInternal` — mirror of analytics.getSentencesInternal

### convex/transcription.ts (UPDATED)
After `saveSentences` mutation succeeds, analytics pipeline is triggered:
```typescript
await ctx.runAction(internal.analytics.runAllAnalytics, { sermonId: args.sermonId });
```

---

## ⏳ Pending

### 1. ANTHROPIC_API_KEY not set in Convex
The API key was not found in any local env files. The WPM/silence/filler-word computation works without it (no AI needed). All AI-powered analytics (scripture refs, confusing phrases, questions, illustrations, intent) will gracefully skip and log a warning until the key is set.

**To set it:**
```bash
cd ~/preachers-lens-next && npx convex env set ANTHROPIC_API_KEY sk-ant-api03-YOUR-KEY-HERE
```

### 2. Vercel redeployment
No Vercel token found in local config. Bert will need to redeploy to Vercel manually:
```bash
cd ~/preachers-lens-next && VERCEL_TOKEN=vcp_YOUR_TOKEN vercel deploy --prod
```
Project ID: `prj_zC0DJEDp1ZNNFzgjQeBcNxRyLuk0` (team: `team_MlImScCPe7cf9qcnst6aUzaT`)

### 3. SermonViewer UI integration
The public query functions are ready. The front-end SermonViewer page needs to be updated to call them and render the analytics panels.

---

## Engagement Score Algorithm
- Base: 2 points
- Illustrations: +2 (≥2), +1 (1)
- Congregation questions: +2 (≥3), +1 (1-2)
- Scripture refs: +1.5 (≥3), +0.75 (1-2)
- Silences/pauses: +1 (≥3), +0.5 (1-2)
- Confusing phrases: -0.5 per severe, -0.25 per moderate
- WPM sweet spot: +1.5 (130-160 wpm), +1 (110-180), +0.5 (else)
- Max score: 10, min: 0

## AI Model Used
`claude-haiku-4-5` (cheapest/fastest Anthropic model) via direct API calls to `https://api.anthropic.com/v1/messages`
