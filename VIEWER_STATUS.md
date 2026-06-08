# Sermon Viewer Analytics — Build Status

**Completed:** 2026-06-07

## What was built

### Page: `src/app/dashboard/sermon/[sermonId]/page.tsx`

Full replacement of the basic sermon viewer with a two-column analytics layout:

#### Header area
- Back button → `/dashboard`
- Inline-editable sermon title (click pencil icon, press Enter/Escape)
- Status badge: Queued / Transcribing / Analyzing / Ready (derived from transcriptionStatus + metrics availability)
- Duration, sentence count, comment count
- "Re-run Analysis" button — calls `api.analytics.triggerReanalysis`

#### Left column (60% / 3 of 5 grid cols on lg+)

**Audio Player card:**
- Play/pause button
- Clickable progress bar with amber comment markers
- Current time / total duration display
- Playback speed selector (0.75x, 1x, 1.25x, 1.5x, 2x)
- Volume slider (0–1)

**Highlight toolbar:**
- Toggle highlight mode button
- 5-color palette when active (yellow, green, blue, pink, orange)
- Clicking a sentence in highlight mode toggles highlight with selected color

**Comment box (inline):**
- Appears when clicking a sentence outside highlight mode
- Shows timestamp, text area, Save/Cancel
- Cmd+Enter to save
- Saved comments appear inline with amber left border

**Transcript:**
- Sentence-by-sentence, auto-scrolls to active (blue highlight)
- Hover shows timestamp
- Click to seek OR toggle highlight OR open comment box
- Inline comments below sentences with delete button

#### Right column (40% / 2 of 5 grid cols on lg+)

shadcn/ui Accordion with 10 collapsible sections. All show skeleton/loading state when data is undefined, "Analyzing..." spinner when null.

1. **Engagement Score** — large number `/10`, sub-scores list
2. **Speaking Pace** — WPM, word count, recharts sparkline, pace hint
3. **Filler Words** — sorted list with count badges; "None detected" if empty
4. **Use of Silence** — pause count + longest pause grid; clickable pause list to seek
5. **Scripture References** — count + list; click to seek; shows context snippet
6. **Insider Language** — flagged count, accessibility score (10 - severe×0.5 - moderate×0.25), severity badges (yellow/orange/red), suggestions, click to seek
7. **Questions** — congregation questions count + clickable list
8. **Missed Question Opportunities** — original→suggested pairs, click to seek
9. **Stories & Illustrations** — type breakdown badges + clickable list
10. **Preacher's Intent** — Know/Feel/Do cards, emotional tone badge, Head/Heart ratio progress bar

### Convex: `convex/analytics.ts`

Added `triggerReanalysis` public mutation:
```typescript
export const triggerReanalysis = mutation({
  args: { sermonId: v.id("sermons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.scheduler.runAfter(0, internal.analytics.runAllAnalytics, { sermonId: args.sermonId });
  },
});
```

## TypeScript
✅ `npx tsc --noEmit` — zero errors

## Convex deploy
✅ `npx convex dev --once` — deployed successfully in 2.54s

## Not included (per spec)
- ElevenLabs / AI Coach voice features
- Vercel deploy (deferred to main session)
