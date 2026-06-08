"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Play,
  Pause,
  MessageSquare,
  Trash2,
  Highlighter,
  Loader2,
  Clock,
  X,
  RefreshCw,
  Volume2,
  Check,
  Pencil,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";

// ─── Highlight colors ────────────────────────────────────────────────────────
const HIGHLIGHT_COLORS = [
  { name: "yellow", bg: "bg-yellow-200 dark:bg-yellow-800/60", hex: "#fef08a" },
  { name: "green", bg: "bg-green-200 dark:bg-green-800/60", hex: "#bbf7d0" },
  { name: "blue", bg: "bg-blue-200 dark:bg-blue-800/60", hex: "#bfdbfe" },
  { name: "pink", bg: "bg-pink-200 dark:bg-pink-800/60", hex: "#fbcfe8" },
  { name: "orange", bg: "bg-orange-200 dark:bg-orange-800/60", hex: "#fed7aa" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatMs(ms: number): string {
  return formatTime(ms / 1000);
}

// ─── Loading skeleton for analytics sections ──────────────────────────────────
function AnalyticsSkeleton() {
  return (
    <div className="space-y-2 py-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// ─── WPM Sparkline using recharts ────────────────────────────────────────────
function WpmSparkline({ data }: { data: { wpm: number; startTimeMs: number }[] }) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((d) => ({ wpm: d.wpm }));
  return (
    <div className="h-14 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={["auto", "auto"]} hide />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="bg-popover border rounded px-2 py-1 text-xs shadow">
                  {payload[0].value} WPM
                </div>
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="wpm"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SermonViewerPage() {
  const params = useParams();
  const router = useRouter();
  const sermonId = params.sermonId as Id<"sermons">;

  // ── Convex queries ──────────────────────────────────────────────────────────
  const sermon = useQuery(api.sermons.get, { sermonId });
  const sentences = useQuery(api.sermons.getSentences, { sermonId }) ?? [];
  const comments = useQuery(api.sermons.getComments, { sermonId }) ?? [];
  const highlights = useQuery(api.sermons.getHighlights, { sermonId }) ?? [];

  // Analytics queries
  const metrics = useQuery(api.sermons.getSermonMetrics, { sermonId });
  const sentenceMetrics = useQuery(api.sermons.getSentenceMetrics, { sermonId }) ?? [];
  const fillerWords = useQuery(api.sermons.getFillerWords, { sermonId }) ?? [];
  const silences = useQuery(api.sermons.getSilences, { sermonId }) ?? [];
  const scriptureRefs = useQuery(api.sermons.getScriptureRefs, { sermonId }) ?? [];
  const confusingPhrases = useQuery(api.sermons.getConfusingPhrases, { sermonId }) ?? [];
  const questions = useQuery(api.sermons.getQuestions, { sermonId }) ?? [];
  const missedQuestions = useQuery(api.sermons.getMissedQuestions, { sermonId }) ?? [];
  const illustrations = useQuery(api.sermons.getIllustrations, { sermonId }) ?? [];
  const intent = useQuery(api.sermons.getIntent, { sermonId });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const addComment = useMutation(api.sermons.addComment);
  const deleteComment = useMutation(api.sermons.deleteComment);
  const toggleHighlight = useMutation(api.sermons.toggleHighlight);
  const updateTitle = useMutation(api.sermons.updateTitle);
  const triggerReanalysis = useMutation(api.analytics.triggerReanalysis);

  // ── Audio refs & state ──────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const activeSentenceRef = useRef<HTMLDivElement>(null);

  // ── Title editing ───────────────────────────────────────────────────────────
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  // ── Comment state ───────────────────────────────────────────────────────────
  const [selectedRange, setSelectedRange] = useState<{
    start: number;
    end: number;
    sentenceIdx: number;
  } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);

  // ── Highlight state ─────────────────────────────────────────────────────────
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0]);

  // ── Reanalysis state ────────────────────────────────────────────────────────
  const [reanalyzing, setReanalyzing] = useState(false);

  // ── Audio URL ───────────────────────────────────────────────────────────────
  const storageUrl = useQuery(
    api.sermons.getStorageUrl,
    sermon?.fileId ? { storageId: sermon.fileId } : "skip"
  );
  const audioUrl = sermon?.fileId ? storageUrl : sermon?.fileUrl;

  // ── Derived data ────────────────────────────────────────────────────────────
  const sortedSentences = [...sentences].sort((a, b) => a.orderIndex - b.orderIndex);

  // Highlight map: sentenceIndex → color hex
  const highlightMap: Record<number, string> = {};
  for (const h of highlights) {
    highlightMap[h.sentenceIndex] = h.color;
  }

  // Comments by sentence
  const commentsBySentence: Record<number, typeof comments> = {};
  for (const c of comments) {
    let sent = sortedSentences.findIndex(
      (s) => s.startTimeMs <= c.startTimeMs && s.endTimeMs > c.startTimeMs
    );
    if (sent < 0 && sortedSentences.length > 0) {
      let minDiff = Infinity;
      sortedSentences.forEach((s, i) => {
        const diff = Math.abs(s.startTimeMs - c.startTimeMs);
        if (diff < minDiff) {
          minDiff = diff;
          sent = i;
        }
      });
    }
    if (sent >= 0) {
      if (!commentsBySentence[sent]) commentsBySentence[sent] = [];
      commentsBySentence[sent].push(c);
    }
  }

  // Active sentence index
  const currentMs = currentTime * 1000;
  const activeSentenceIdx = sortedSentences.findIndex(
    (s) => s.startTimeMs <= currentMs && s.endTimeMs > currentMs
  );

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSentenceIdx]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, volume));
    }
  }, [volume]);

  useEffect(() => {
    if (sermon?.title) setTitleInput(sermon.title);
  }, [sermon?.title]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  }, []);

  const seekTo = useCallback((ms: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = ms / 1000;
      setCurrentTime(ms / 1000);
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && duration) {
      audioRef.current.currentTime = pct * duration;
    }
  };

  const handleSentenceClick = (sentence: (typeof sortedSentences)[0], idx: number) => {
    if (highlightMode) {
      toggleHighlight({ sermonId, sentenceIndex: idx, color: activeColor.hex });
      return;
    }
    seekTo(sentence.startTimeMs);
    setSelectedRange({ start: sentence.startTimeMs, end: sentence.endTimeMs, sentenceIdx: idx });
    setShowCommentBox(true);
  };

  const handleSaveComment = async () => {
    if (!selectedRange || !commentText.trim()) return;
    setSavingComment(true);
    try {
      await addComment({
        sermonId,
        commentText: commentText.trim(),
        startTimeMs: selectedRange.start,
        endTimeMs: selectedRange.end,
      });
      setCommentText("");
      setShowCommentBox(false);
      setSelectedRange(null);
      toast.success("Comment saved");
    } catch {
      toast.error("Failed to save comment");
    } finally {
      setSavingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: Id<"sermonComments">) => {
    try {
      await deleteComment({ commentId });
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleSaveTitle = async () => {
    if (!sermon) return;
    try {
      await updateTitle({ sermonId, title: titleInput.trim() || "Untitled Sermon" });
      setEditingTitle(false);
      toast.success("Title updated");
    } catch {
      toast.error("Failed to update title");
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      await triggerReanalysis({ sermonId });
      toast.success("Re-analysis started — results will appear shortly");
    } catch {
      toast.error("Failed to start re-analysis");
    } finally {
      setReanalyzing(false);
    }
  };

  // ── Status badge ─────────────────────────────────────────────────────────────
  function StatusBadge() {
    if (!sermon) return null;
    const s = sermon.transcriptionStatus;
    if (s === "processing" || s === "pending") {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {s === "pending" ? "Queued" : "Transcribing"}
        </Badge>
      );
    }
    // If metrics not yet available, analytics may still be running
    if (metrics === undefined || metrics === null) {
      return (
        <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <Check className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  // ── Loading / not found states ────────────────────────────────────────────────
  if (sermon === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sermon === null) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-4">
        <p className="text-muted-foreground">Sermon not found</p>
        <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  // ── Compute analytics helpers ─────────────────────────────────────────────────
  const avgWpm = metrics?.wpm ?? null;
  const wordCount = metrics?.wordCount ?? null;
  const engagementScore = metrics?.engagementScore ?? null;

  // Sentence metrics sorted by time for sparkline
  const sentenceMetricsSorted = [...sentenceMetrics].sort((a, b) => a.startTimeMs - b.startTimeMs);

  // Silences ≥ 3s
  const longSilences = silences.filter((s) => s.durationMs >= 3000);
  const longestSilence = longSilences.reduce(
    (max, s) => (s.durationMs > max ? s.durationMs : max),
    0
  );

  // Insider language accessibility score
  const severeCount = confusingPhrases.filter((p) => p.severity === "severe").length;
  const moderateCount = confusingPhrases.filter((p) => p.severity === "moderate").length;
  const accessibilityScore = Math.max(
    0,
    Math.min(10, 10 - severeCount * 0.5 - moderateCount * 0.25)
  );

  // Illustration type counts
  const illustrationTypes: Record<string, number> = {};
  for (const ill of illustrations) {
    illustrationTypes[ill.type] = (illustrationTypes[ill.type] ?? 0) + 1;
  }

  // Congregation questions
  const congregationQuestions = questions.filter((q) => q.isCongregationQuestion);

  // ── Severity badge ────────────────────────────────────────────────────────────
  function SeverityBadge({ severity }: { severity: string }) {
    const classes =
      severity === "severe"
        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        : severity === "moderate"
        ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return <Badge className={classes}>{severity}</Badge>;
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                className="text-xl font-bold bg-transparent border-b border-primary outline-none flex-1"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveTitle}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTitle(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-xl font-bold truncate">{sermon.title || "Untitled Sermon"}</h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setEditingTitle(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
            <StatusBadge />
            {sermon.durationSeconds ? (
              <>
                <Clock className="h-3 w-3" />
                <span>{formatTime(sermon.durationSeconds)}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{sortedSentences.length} sentences</span>
            <span>·</span>
            <span>{comments.length} comments</span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleReanalyze}
          disabled={reanalyzing}
        >
          {reanalyzing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Re-run Analysis
        </Button>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left column (60%) ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Audio Player */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                />
              )}

              {/* Play / progress row */}
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  onClick={togglePlay}
                  disabled={!audioUrl}
                  className="h-10 w-10 shrink-0"
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>

                <span className="text-sm tabular-nums text-muted-foreground w-10">
                  {formatTime(currentTime)}
                </span>

                {/* Progress bar */}
                <div
                  className="flex-1 h-2.5 bg-muted rounded-full cursor-pointer relative group"
                  onClick={handleProgressClick}
                >
                  <div
                    className="h-full bg-primary rounded-full transition-all pointer-events-none"
                    style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                  />
                  {/* Comment markers */}
                  {comments.map((c, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500 rounded-full -ml-1 cursor-pointer z-10"
                      style={{
                        left: duration
                          ? `${(c.startTimeMs / 1000 / duration) * 100}%`
                          : "0%",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        seekTo(c.startTimeMs);
                      }}
                      title={c.commentText}
                    />
                  ))}
                </div>

                <span className="text-sm tabular-nums text-muted-foreground w-10 text-right">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Playback speed */}
                <div className="flex items-center gap-1">
                  {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={cn(
                        "text-xs px-2 py-1 rounded transition-colors",
                        playbackRate === rate
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2 ml-auto">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <Slider
                    className="w-24"
                    min={0}
                    max={1}
                    step={0.05}
                    value={[volume]}
                    onValueChange={([v]) => setVolume(v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Highlight toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={highlightMode ? "default" : "outline"}
              size="sm"
              onClick={() => setHighlightMode(!highlightMode)}
            >
              <Highlighter className="h-4 w-4 mr-2" />
              {highlightMode ? "Highlighting" : "Highlight"}
            </Button>
            {highlightMode && (
              <div className="flex items-center gap-1">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setActiveColor(c)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-transform",
                      activeColor.name === c.name
                        ? "border-foreground scale-125"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Comment box */}
          {showCommentBox && selectedRange && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      Comment at {formatMs(selectedRange.start)}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setShowCommentBox(false);
                      setSelectedRange(null);
                      setCommentText("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type your coaching comment..."
                  className="mb-3"
                  rows={3}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) handleSaveComment();
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCommentBox(false);
                      setCommentText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveComment}
                    disabled={!commentText.trim() || savingComment}
                  >
                    {savingComment && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Comment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transcript */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedSentences.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  {sermon.transcriptionStatus === "processing" ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
                      <p>Transcribing...</p>
                    </>
                  ) : sermon.transcriptionStatus === "pending" ? (
                    <p>Transcription queued...</p>
                  ) : (
                    <p>No transcript available</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedSentences.map((sentence, idx) => {
                    const isActive = idx === activeSentenceIdx;
                    const highlightHex = highlightMap[idx];
                    const sentComments = commentsBySentence[idx] ?? [];
                    const isSelected = selectedRange?.sentenceIdx === idx;

                    return (
                      <div key={sentence._id} ref={isActive ? activeSentenceRef : null}>
                        <div
                          className={cn(
                            "px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-base leading-relaxed group",
                            isActive && "bg-blue-100 dark:bg-blue-900/40 font-medium",
                            !isActive && !highlightHex && "hover:bg-muted/60",
                            isSelected && "ring-2 ring-primary",
                            highlightMode && "hover:opacity-80"
                          )}
                          style={
                            highlightHex && !isActive
                              ? { backgroundColor: highlightHex + "80" }
                              : undefined
                          }
                          onClick={() => handleSentenceClick(sentence, idx)}
                        >
                          <span className="text-xs text-muted-foreground mr-2 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatMs(sentence.startTimeMs)}
                          </span>
                          {sentence.sentenceText}
                          {sentComments.length > 0 && (
                            <span className="ml-2 inline-flex items-center">
                              <MessageSquare className="h-3 w-3 text-amber-500" />
                            </span>
                          )}
                        </div>

                        {/* Inline comments */}
                        {sentComments.length > 0 && (
                          <div className="ml-4 pl-4 border-l-2 border-amber-400 space-y-2 my-2">
                            {sentComments.map((c) => (
                              <div
                                key={c._id}
                                className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 group"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm leading-relaxed">{c.commentText}</p>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteComment(c._id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatMs(c.startTimeMs)} – {formatMs(c.endTimeMs)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column (40%) — Analytics ── */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3">
              <Accordion type="multiple" defaultValue={["engagement"]} className="w-full">

                {/* ── Section 1: Engagement Score ── */}
                <AccordionItem value="engagement">
                  <AccordionTrigger className="text-sm font-medium">
                    Engagement Score
                  </AccordionTrigger>
                  <AccordionContent>
                    {metrics === undefined ? (
                      <AnalyticsSkeleton />
                    ) : metrics === null ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </div>
                    ) : (
                      <div>
                        <div className="text-4xl font-bold text-primary mb-3">
                          {engagementScore !== null ? `${engagementScore.toFixed(1)} / 10` : "—"}
                        </div>
                        <div className="space-y-2">
                          {[
                            { label: "WPM Score", value: metrics.wpm ? (metrics.wpm > 120 && metrics.wpm < 180 ? 8 : 5) : null },
                            { label: "Illustrations", value: metrics.illustrationScore ?? null },
                            { label: "Emotional Resonance", value: metrics.emotionalResonanceScore ?? null },
                            { label: "Scripture Usage", value: metrics.scriptureRefs ? Math.min(10, metrics.scriptureRefs) : null },
                            { label: "Engagement", value: metrics.engagementScore ?? null },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="font-medium">
                                {value !== null ? `${value}/10` : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ── Section 2: Speaking Pace ── */}
                <AccordionItem value="pace">
                  <AccordionTrigger className="text-sm font-medium">
                    Speaking Pace
                  </AccordionTrigger>
                  <AccordionContent>
                    {metrics === undefined ? (
                      <AnalyticsSkeleton />
                    ) : (
                      <div>
                        <div className="text-3xl font-bold text-primary">
                          {avgWpm !== null ? `${avgWpm} WPM` : "—"}
                        </div>
                        {wordCount !== null && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {wordCount.toLocaleString()} words total
                          </p>
                        )}
                        {sentenceMetricsSorted.length >= 2 && (
                          <WpmSparkline data={sentenceMetricsSorted} />
                        )}
                        {avgWpm !== null && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {avgWpm < 120
                              ? "⚠️ Slower than ideal — consider picking up the pace"
                              : avgWpm > 180
                              ? "⚠️ Fast pace — listeners may struggle to keep up"
                              : "✅ Good pace for comprehension (120–180 WPM)"}
                          </p>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ── Section 3: Filler Words ── */}
                <AccordionItem value="filler">
                  <AccordionTrigger className="text-sm font-medium">
                    Filler Words
                  </AccordionTrigger>
                  <AccordionContent>
                    {fillerWords === undefined ? (
                      <AnalyticsSkeleton />
                    ) : fillerWords.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None detected</p>
                    ) : (
                      <div className="space-y-2">
                        {[...fillerWords]
                          .sort((a, b) => b.count - a.count)
                          .map((fw) => (
                            <div key={fw._id} className="flex items-center justify-between">
                              <span className="text-sm">"{fw.word}"</span>
                              <Badge variant="secondary">{fw.count}×</Badge>
                            </div>
                          ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ── Section 4: Use of Silence ── */}
                <AccordionItem value="silence">
                  <AccordionTrigger className="text-sm font-medium">
                    Use of Silence
                  </AccordionTrigger>
                  <AccordionContent>
                    {silences === undefined ? (
                      <AnalyticsSkeleton />
                    ) : (
                      <div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-muted rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold">{longSilences.length}</div>
                            <div className="text-xs text-muted-foreground">Pauses ≥ 3s</div>
                          </div>
                          <div className="bg-muted rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold">
                              {longestSilence > 0 ? `${(longestSilence / 1000).toFixed(1)}s` : "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">Longest pause</div>
                          </div>
                        </div>
                        {longSilences.length > 0 && (
                          <div className="space-y-1">
                            {longSilences.map((s) => (
                              <button
                                key={s._id}
                                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-center justify-between"
                                onClick={() => seekTo(s.startTimeMs)}
                              >
                                <span className="text-muted-foreground">{formatMs(s.startTimeMs)}</span>
                                <span>{(s.durationMs / 1000).toFixed(1)}s pause</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {longSilences.length === 0 && silences.length === 0 && (
                          <p className="text-sm text-muted-foreground">No significant pauses detected</p>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ── Section 5: Scripture References ── */}
                <AccordionItem value="scripture">
                  <AccordionTrigger className="text-sm font-medium">
                    Scripture References
                  </AccordionTrigger>
                  <AccordionContent>
                    {scriptureRefs === undefined ? (
                      <AnalyticsSkeleton />
                    ) : scriptureRefs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No scripture references detected</p>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {scriptureRefs.length} reference{scriptureRefs.length !== 1 ? "s" : ""} found
                        </p>
                        <div className="space-y-2">
                          {scriptureRefs.map((ref) => (
                            <button
                              key={ref._id}
                              className="w-full text-left rounded-lg border p-2.5 hover:bg-muted transition-colors"
                              onClick={() => seekTo(ref.startTimeMs)}
                            >
                              <div className="font-medium text-sm">{ref.reference}</div>
                              {ref.context && (
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {ref.context}
                                </div>
                              )}
                              <div className="text-xs text-primary mt-1">{formatMs(ref.startTimeMs)}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ── Section 6: Insider Language ── */}
                <AccordionItem value="insider">
                  <AccordionTrigger className="text-sm font-medium">
                    Insider Language
                  </AccordionTrigger>
                  <AccordionContent>
                    {confusingPhrases === undefined ? (
                      <AnalyticsSkeleton />
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="text-sm text-muted-foreground">
                              {confusingPhrases.length} flagged phrase{confusingPhrases.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              Accessibility: {accessibilityScore.toFixed(1)}/10
                            </div>
                            <Progress value={accessibilityScore * 10} className="h-1.5 w-20 mt-1" />
                          </div>
                        </div>
                        {confusingPhrases.length === 0 ? (
                          <p className="text-sm text-muted-foreground">✅ No insider language detected</p>
                        ) : (
                          <div className="space-y-3">
                            {confusingPhrases.map((p) => (
                              <div key={p._id} className="border rounded-lg p-2.5 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">"{p.phrase}"</span>
                                  <SeverityBadge severity={p.severity} />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  💡 {p.suggestion}
                                </p>
                                <button
                                  className="text-xs text-primary hover:underline"
                                  onClick={() => seekTo(p.startTimeMs)}
                                >
                                  {formatMs(p.startTimeMs)}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ── Section 7: Questions ── */}
                <AccordionItem value="questions">
                  <AccordionTrigger className="text-sm font-medium">
                    Questions
                  </AccordionTrigger>
                  <AccordionContent>
                    {questions === undefined ? (
                      <AnalyticsSkeleton />
                    ) : questions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No questions detected</p>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {congregationQuestions.length} congregation question{congregationQuestions.length !== 1 ? "s" : ""}
                          {" · "}
                          {questions.length} total
                        </p>
                        <div className="space-y-1.5">
                          {congregationQuestions.map((q) => (
                            <button
                              key={q._id}
                              className="w-full text-left rounded-lg border border-blue-200 dark:border-blue-800 p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                              onClick={() => seekTo(q.startTimeMs)}
                            >
                              <p className="text-sm line-clamp-2">{q.questionText}</p>
                              <span className="text-xs text-primary mt-0.5 block">
                                {formatMs(q.startTimeMs)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ── Section 8: Missed Question Opportunities ── */}
                <AccordionItem value="missed-questions">
                  <AccordionTrigger className="text-sm font-medium">
                    Missed Question Opportunities
                  </AccordionTrigger>
                  <AccordionContent>
                    {missedQuestions === undefined ? (
                      <AnalyticsSkeleton />
                    ) : missedQuestions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No missed opportunities found</p>
                    ) : (
                      <div className="space-y-3">
                        {missedQuestions.map((mq) => (
                          <div key={mq._id} className="border rounded-lg p-2.5 space-y-1.5">
                            <p className="text-xs text-muted-foreground italic line-clamp-2">
                              "{mq.originalText}"
                            </p>
                            <p className="text-sm font-medium">→ {mq.suggestedQuestion}</p>
                            <button
                              className="text-xs text-primary hover:underline"
                              onClick={() => seekTo(mq.startTimeMs)}
                            >
                              {formatMs(mq.startTimeMs)}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ── Section 9: Stories & Illustrations ── */}
                <AccordionItem value="illustrations">
                  <AccordionTrigger className="text-sm font-medium">
                    Stories & Illustrations
                  </AccordionTrigger>
                  <AccordionContent>
                    {illustrations === undefined ? (
                      <AnalyticsSkeleton />
                    ) : illustrations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No illustrations detected</p>
                    ) : (
                      <div>
                        {/* Type breakdown */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {Object.entries(illustrationTypes).map(([type, count]) => (
                            <Badge key={type} variant="secondary">
                              {type}: {count}
                            </Badge>
                          ))}
                        </div>
                        <div className="space-y-2">
                          {illustrations.map((ill) => (
                            <button
                              key={ill._id}
                              className="w-full text-left rounded-lg border p-2.5 hover:bg-muted transition-colors"
                              onClick={() => seekTo(ill.startTimeMs)}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {ill.type}
                                </Badge>
                                <span className="text-xs text-primary">{formatMs(ill.startTimeMs)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {ill.description}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ── Section 10: Preacher's Intent ── */}
                <AccordionItem value="intent">
                  <AccordionTrigger className="text-sm font-medium">
                    Preacher's Intent
                  </AccordionTrigger>
                  <AccordionContent>
                    {intent === undefined ? (
                      <AnalyticsSkeleton />
                    ) : intent === null ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing intent...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Know / Feel / Do cards */}
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { label: "Know", value: intent.know, color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
                            { label: "Feel", value: intent.feel, color: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800" },
                            { label: "Do", value: intent.doAction, color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className={cn("rounded-lg border p-2.5", color)}>
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                {label}
                              </div>
                              <p className="text-sm">{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Emotional tone */}
                        {intent.emotionalTone && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Emotional Tone</div>
                            <Badge variant="secondary">{intent.emotionalTone}</Badge>
                          </div>
                        )}

                        {/* Head / Heart ratio */}
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Head (logic)</span>
                            <span>Heart (emotion)</span>
                          </div>
                          <Progress
                            value={Math.round((1 - intent.headHeartRatio) * 100)}
                            className="h-2"
                          />
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span>{Math.round(intent.headHeartRatio * 100)}% head</span>
                            <span>{Math.round((1 - intent.headHeartRatio) * 100)}% heart</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
