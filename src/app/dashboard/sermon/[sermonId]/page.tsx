"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  AlignLeft,
  List,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";

// ─── Highlight colors ────────────────────────────────────────────────────────
const HIGHLIGHT_COLORS = [
  { name: "yellow", hex: "#fef08a" },
  { name: "green", hex: "#39ff14" },
  { name: "orange", hex: "#ff7700" },
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

function formatMsLong(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Group sentences into ~60-word paragraphs
function groupIntoParagraphs<T extends { sentenceText: string }>(sentences: T[]): T[][] {
  const paragraphs: T[][] = [];
  let current: T[] = [];
  let wordCount = 0;
  const MAX_WORDS = 60;
  for (const s of sentences) {
    const words = s.sentenceText.trim().split(/\s+/).length;
    if (current.length > 0 && wordCount + words > MAX_WORDS) {
      paragraphs.push(current);
      current = [s];
      wordCount = words;
    } else {
      current.push(s);
      wordCount += words;
    }
  }
  if (current.length > 0) paragraphs.push(current);
  return paragraphs;
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────
function AnalyticsSkeleton() {
  return (
    <div className="space-y-2 py-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// ─── WPM Sparkline ────────────────────────────────────────────────────────────
function WpmSparkline({
  data,
  currentMs,
  onSeek,
}: {
  data: { wpm: number; startTimeMs: number }[];
  currentMs?: number;
  onSeek?: (ms: number) => void;
}) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((d) => ({ wpm: d.wpm, time: d.startTimeMs }));
  const avg = data.reduce((s, d) => s + d.wpm, 0) / data.length;
  return (
    <div className="h-36 w-full mt-2 cursor-pointer">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          onClick={(d: unknown) => {
            const data = d as { activePayload?: Array<{ payload: { time: number } }> };
            if (data?.activePayload?.[0]?.payload?.time !== undefined && onSeek) {
              onSeek(data.activePayload[0].payload.time);
            }
          }}
        >
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 9 }}
            tickFormatter={(ms) =>
              `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`
            }
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9 }}
            domain={["auto", "auto"]}
            width={30}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const wpm = payload[0].value as number;
              const ms = (payload[0].payload as { time: number }).time;
              const pctDev = avg > 0 ? ((wpm - avg) / avg) * 100 : 0;
              const sign = pctDev >= 0 ? "+" : "";
              return (
                <div className="bg-popover border rounded-lg px-2 py-1.5 shadow-lg text-xs">
                  <p className="text-muted-foreground">{formatMs(ms)}</p>
                  <p className="font-semibold">{wpm} WPM</p>
                  <p className={pctDev >= 0 ? "text-rose-600" : "text-blue-600"}>
                    {sign}
                    {pctDev.toFixed(1)}% from avg
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={Math.round(avg)}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="5 5"
            label={{ value: "Avg", position: "right", fontSize: 9 }}
          />
          {currentMs !== undefined && currentMs > 0 && (
            <ReferenceLine
              x={currentMs}
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
            />
          )}
          <Line
            type="monotone"
            dataKey="wpm"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Severity badge ────────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const classes =
    severity === "severe"
      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      : severity === "moderate"
      ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return <Badge className={classes}>{severity}</Badge>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SermonViewerPage() {
  const params = useParams();
  const router = useRouter();
  const sermonId = params.sermonId as Id<"sermons">;

  // ── Convex queries ──────────────────────────────────────────────────────────
  const sermon = useQuery(api.sermons.get, { sermonId });
  const rawSentences = useQuery(api.sermons.getSentences, { sermonId }) ?? [];
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
  const toggleHighlightMutation = useMutation(api.sermons.toggleHighlight);
  const updateTitle = useMutation(api.sermons.updateTitle);
  const triggerReanalysis = useMutation(api.analytics.triggerReanalysis);

  // ── Audio refs & state ──────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // seconds
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [playerCollapsed, setPlayerCollapsed] = useState(false);

  // Waveform canvas
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);

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

  // ── View mode ───────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"sentence" | "paragraph">("paragraph");
  const [engagementExpanded, setEngagementExpanded] = useState(false);
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false);

  // ── Auto scroll ─────────────────────────────────────────────────────────────
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [userScrolledAway, setUserScrolledAway] = useState(false);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentenceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isAutoScrollingRef = useRef(false);

  // ── Coach / AI section ──────────────────────────────────────────────────────
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachNotes, setCoachNotes] = useState<Array<{
    sentence_index: number;
    category?: string;
    comment_text: string;
    start_time_ms: number;
    end_time_ms: number;
  }> | null>(null);
  const [coachApplying, setCoachApplying] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  // ── Comment hide state ──────────────────────────────────────────────────────
  const [hideMyComments, setHideMyComments] = useState(false);

  // ── Audio URL ───────────────────────────────────────────────────────────────
  const storageUrl = useQuery(
    api.sermons.getStorageUrl,
    sermon?.fileId ? { storageId: sermon.fileId } : "skip"
  );
  const audioUrl = sermon?.fileId ? (storageUrl ?? undefined) : (sermon?.fileUrl ?? undefined);

  // ── Derived data ────────────────────────────────────────────────────────────
  const sortedSentences = useMemo(
    () => [...rawSentences].sort((a, b) => a.orderIndex - b.orderIndex),
    [rawSentences]
  );

  // Highlight map: sentenceIndex → color hex
  const highlightMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const h of highlights) map[h.sentenceIndex] = h.color;
    return map;
  }, [highlights]);

  // Comments by sentence index
  const commentsBySentence = useMemo(() => {
    const map: Record<number, typeof comments> = {};
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
        if (!map[sent]) map[sent] = [];
        map[sent].push(c);
      }
    }
    return map;
  }, [comments, sortedSentences]);

  // Active sentence index
  const currentMs = currentTime * 1000;
  const activeSentenceIdx = sortedSentences.findIndex(
    (s) => s.startTimeMs <= currentMs && s.endTimeMs > currentMs
  );

  // Paragraph grouping
  const paragraphs = useMemo(() => groupIntoParagraphs(sortedSentences), [sortedSentences]);
  const activeParagraphIdx = paragraphs.findIndex((p) => {
    const first = p[0];
    const last = p[p.length - 1];
    return currentMs >= first.startTimeMs && currentMs < last.endTimeMs;
  });

  // Sentence metrics sorted for WPM chart
  const sentenceMetricsSorted = useMemo(
    () => [...sentenceMetrics].sort((a, b) => a.startTimeMs - b.startTimeMs),
    [sentenceMetrics]
  );

  // Analytics derived
  const longSilences = useMemo(() => silences.filter((s) => s.durationMs >= 3000), [silences]);
  const longestSilence = useMemo(
    () => longSilences.reduce((max, s) => (s.durationMs > max ? s.durationMs : max), 0),
    [longSilences]
  );
  const severeCount = useMemo(
    () => confusingPhrases.filter((p) => p.severity === "severe").length,
    [confusingPhrases]
  );
  const moderateCount = useMemo(
    () => confusingPhrases.filter((p) => p.severity === "moderate").length,
    [confusingPhrases]
  );
  const accessibilityScore = useMemo(
    () => Math.max(0, Math.min(10, 10 - severeCount * 0.5 - moderateCount * 0.25)),
    [severeCount, moderateCount]
  );
  const illustrationTypes = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ill of illustrations) m[ill.type] = (m[ill.type] ?? 0) + 1;
    return m;
  }, [illustrations]);
  const congregationQuestions = useMemo(
    () => questions.filter((q) => q.isCongregationQuestion),
    [questions]
  );
  const avgWpm = metrics?.wpm ?? null;
  const wordCount = metrics?.wordCount ?? null;
  const engagementScore = metrics?.engagementScore ?? null;

  // Time since last comment (in seconds)
  const timeSinceLastComment = useMemo(() => {
    const userComments = comments.filter((c) => !c.ruleId);
    if (userComments.length === 0) return null;
    const endedComments = userComments.filter((c) => c.endTimeMs <= currentMs);
    if (endedComments.length === 0) return null;
    const last = endedComments.reduce((lc, c) =>
      c.endTimeMs > lc.endTimeMs ? c : lc
    );
    return Math.floor((currentMs - last.endTimeMs) / 1000);
  }, [comments, currentMs]);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sermon?.title) setTitleInput(sermon.title);
  }, [sermon?.title]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(1, Math.max(0, volume));
  }, [volume]);

  // Auto-scroll to active paragraph
  useEffect(() => {
    if (!autoScrollEnabled || !playing || viewMode !== "paragraph") return;
    if (activeParagraphIdx === -1) return;
    const el = paragraphRefs.current[activeParagraphIdx];
    if (!el || !transcriptContainerRef.current) return;
    const container = transcriptContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const scrollOffset = elRect.top - containerRect.top + container.scrollTop;
    const offset = 80;
    const targetScrollTop = scrollOffset - offset;
    if (Math.abs(targetScrollTop - container.scrollTop) > 50) {
      isAutoScrollingRef.current = true;
      container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      setTimeout(() => { isAutoScrollingRef.current = false; }, 500);
      setUserScrolledAway(false);
    }
  }, [activeParagraphIdx, autoScrollEnabled, playing, viewMode]);

  // Auto-scroll sentence view
  useEffect(() => {
    if (!autoScrollEnabled || !playing || viewMode !== "sentence") return;
    if (activeSentenceIdx === -1) return;
    const el = sentenceRefs.current[activeSentenceIdx];
    if (!el || !transcriptContainerRef.current) return;
    const container = transcriptContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const isVisible = elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom;
    if (!isVisible) {
      isAutoScrollingRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => { isAutoScrollingRef.current = false; }, 500);
    }
  }, [activeSentenceIdx, autoScrollEnabled, playing, viewMode]);

  // Detect user scroll
  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (isAutoScrollingRef.current) return;
      setAutoScrollEnabled(false);
      setUserScrolledAway(true);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Generate waveform when audioUrl available
  useEffect(() => {
    if (audioUrl) generateWaveform(audioUrl);
  }, [audioUrl]);

  // Draw waveform canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    const durationSecs = sermon?.durationSeconds;
    if (!canvas || waveformData.length === 0 || !durationSecs) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const w = rect.width;
    const h = rect.height;
    const playedFraction = currentTime / durationSecs;
    const barWidth = Math.max(w / waveformData.length, 1.5);
    const gap = barWidth * 0.3;
    for (let i = 0; i < waveformData.length; i++) {
      const x = (i / waveformData.length) * w;
      const amplitude = waveformData[i];
      const barH = Math.max(amplitude * h, h * 0.08);
      const y = (h - barH) / 2;
      const isPlayed = i / waveformData.length < playedFraction;
      ctx.fillStyle = isPlayed ? "hsla(0,0%,100%,0.85)" : "hsla(0,0%,100%,0.35)";
      ctx.beginPath();
      const radius = Math.min((barWidth - gap) / 2, barH / 2);
      ctx.roundRect(x, y, Math.max(barWidth - gap, 1), barH, radius);
      ctx.fill();
    }
  }, [waveformData, currentTime, sermon?.durationSeconds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (audioRef.current) audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  // ── Waveform generation ─────────────────────────────────────────────────────
  const generateWaveform = async (url: string) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0);
      await audioContext.close();
      const samples = 1000;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];
      for (let i = 0; i < samples; i++) {
        const start = i * blockSize;
        let max = 0;
        for (let j = 0; j < blockSize; j++) {
          max = Math.max(max, Math.abs(rawData[start + j] ?? 0));
        }
        filteredData.push(max);
      }
      const maxVal = Math.max(...filteredData) || 1;
      setWaveformData(filteredData.map((v) => v / maxVal));
    } catch (err) {
      console.error("Waveform generation failed:", err);
    }
  };

  // ── Audio gain setup ────────────────────────────────────────────────────────
  const ensureAudioGain = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;
    if (!audioContextRef.current || !mediaSourceRef.current || !gainNodeRef.current) {
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        source.connect(gain);
        gain.connect(ctx.destination);
        audioContextRef.current = ctx;
        mediaSourceRef.current = source;
        gainNodeRef.current = gain;
      } catch {
        return false;
      }
    }
    if (audioContextRef.current.state !== "running") {
      try {
        await audioContextRef.current.resume();
      } catch {
        return false;
      }
    }
    if (gainNodeRef.current) gainNodeRef.current.gain.value = Math.min(2, Math.max(0, volume));
    return true;
  }, [volume]);

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

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      if (volume > 1) await ensureAudioGain();
      await audioRef.current.play().catch((err) => console.error("Play failed:", err));
    }
  }, [playing, volume, ensureAudioGain]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && duration) {
      audioRef.current.currentTime = pct * duration;
    }
  };

  const handleSentenceClick = (sentenceIdx: number, startTimeMs: number, endTimeMs: number) => {
    if (highlightMode) {
      toggleHighlightMutation({ sermonId, sentenceIndex: sentenceIdx, color: activeColor.hex });
      return;
    }
    seekTo(startTimeMs);
    setSelectedRange({ start: startTimeMs, end: endTimeMs, sentenceIdx });
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

  const scrollToActive = () => {
    if (viewMode === "paragraph") {
      if (activeParagraphIdx === -1) return;
      const el = paragraphRefs.current[activeParagraphIdx];
      if (!el || !transcriptContainerRef.current) return;
      const container = transcriptContainerRef.current;
      isAutoScrollingRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => { isAutoScrollingRef.current = false; }, 500);
    } else {
      if (activeSentenceIdx === -1) return;
      const el = sentenceRefs.current[activeSentenceIdx];
      if (el) {
        isAutoScrollingRef.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => { isAutoScrollingRef.current = false; }, 500);
      }
    }
    setAutoScrollEnabled(true);
    setUserScrolledAway(false);
  };

  // ── AI Coach ────────────────────────────────────────────────────────────────
  const handleGenerateCoachNotes = async () => {
    if (sortedSentences.length === 0) return;
    setCoachLoading(true);
    try {
      // Build a simple prompt summary for Bert's notes
      const transcriptSample = sortedSentences
        .slice(0, 80)
        .map((s, i) => `[${i}] ${s.sentenceText}`)
        .join("\n");

      // We call Anthropic via the Convex action if one exists, else show a note
      toast.info("AI Coach requires an Anthropic API key to be configured in Convex environment variables (ANTHROPIC_API_KEY). Re-run analysis to generate analytics first.");
      setCoachNotes([]);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not generate coach notes");
    } finally {
      setCoachLoading(false);
    }
  };

  const handleApplyCoachNotes = async () => {
    if (!coachNotes || coachNotes.length === 0) return;
    setCoachApplying(true);
    try {
      for (const note of coachNotes) {
        await addComment({
          sermonId,
          commentText: `[AI Coach] ${note.comment_text}`,
          startTimeMs: note.start_time_ms,
          endTimeMs: note.end_time_ms,
        });
      }
      setCoachNotes(null);
      toast.success(`Applied ${coachNotes.length} AI Coach comments`);
    } catch {
      toast.error("Failed to apply coach notes");
    } finally {
      setCoachApplying(false);
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
    if (s === "error") {
      return (
        <Badge variant="destructive" className="gap-1">
          Error
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <Check className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  // ── Loading / not found ───────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mt-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                className="text-xl font-bold h-10 w-80"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveTitle}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingTitle(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-2xl font-bold truncate">{sermon.title || "Untitled Sermon"}</h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => { setTitleInput(sermon.title ?? ""); setEditingTitle(true); }}
              >
                <Pencil className="h-3.5 w-3.5" />
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

      {/* ── Collapsible Audio Player ── */}
      <Card className={cn("mb-4 shadow-md transition-all duration-300", playerCollapsed ? "py-2 px-4" : "")}>
        <button
          className="w-full flex items-center justify-between cursor-pointer px-6 py-2"
          onClick={() => setPlayerCollapsed(!playerCollapsed)}
        >
          <div className="flex items-center gap-3">
            <h2 className={cn("font-semibold text-primary transition-all duration-300", playerCollapsed ? "text-sm" : "text-base")}>
              Audio Player
            </h2>
            {playerCollapsed && playing && (
              <Badge variant="secondary" className="animate-pulse text-xs">Playing</Badge>
            )}
            {playerCollapsed && (
              <span className="text-xs text-muted-foreground font-mono">
                {formatTime(currentTime)} / {sermon.durationSeconds ? formatTime(sermon.durationSeconds) : "0:00"}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn("h-5 w-5 text-muted-foreground transition-transform duration-300", playerCollapsed && "rotate-180")}
          />
        </button>

        <div className={cn("overflow-hidden transition-all duration-300", playerCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100")}>
          <CardContent className="pt-2 pb-4 space-y-3">
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

            {/* Waveform + Progress */}
            <div className="relative">
              {/* Waveform canvas (background) */}
              <div
                className="relative h-16 bg-primary/80 rounded-lg overflow-hidden cursor-pointer"
                onClick={handleProgressClick}
              >
                <canvas
                  ref={waveformCanvasRef}
                  className="absolute inset-0 w-full h-full"
                />
                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none"
                  style={{ left: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                />
                {/* Comment markers on waveform */}
                {comments.map((c, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 pointer-events-none"
                    style={{ left: duration ? `${(c.startTimeMs / 1000 / duration) * 100}%` : "0%" }}
                  />
                ))}
              </div>
            </div>

            {/* Time + Play row */}
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                onClick={togglePlay}
                disabled={!audioUrl}
                className="h-10 w-10 shrink-0"
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                From start
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatTime(currentTime)}
              </span>
              <div
                className="flex-1 h-2 bg-muted rounded-full cursor-pointer relative"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full bg-primary rounded-full transition-none pointer-events-none"
                  style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                />
                {/* Comment markers */}
                {comments.map((c, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500 rounded-full -ml-1 cursor-pointer z-10"
                    style={{ left: duration ? `${(c.startTimeMs / 1000 / duration) * 100}%` : "0%" }}
                    onClick={(e) => { e.stopPropagation(); seekTo(c.startTimeMs); }}
                    title={c.commentText}
                  />
                ))}
              </div>
              <span className="text-sm tabular-nums text-muted-foreground text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Speed */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Speed:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[3.5rem]">
                      {playbackRate}x
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                      <DropdownMenuItem key={r} onClick={() => setPlaybackRate(r)}>
                        {r}x {playbackRate === r && "✓"}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Slider
                  className="w-24"
                  min={0}
                  max={2}
                  step={0.05}
                  value={[volume]}
                  onValueChange={([v]) => setVolume(v)}
                />
                <span className="text-xs text-muted-foreground w-8">{Math.round(volume * 100)}%</span>
              </div>

              {/* Time since last comment */}
              {timeSinceLastComment !== null && (
                <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="font-mono">
                    {Math.floor(timeSinceLastComment / 60)}:{String(timeSinceLastComment % 60).padStart(2, "0")}
                  </span>
                  <span>since last comment</span>
                </div>
              )}
            </div>
          </CardContent>
        </div>
      </Card>

      {/* ── Analytics dashboard (full-width, collapsible, above transcript) ── */}
      <Card className={`mb-6 shadow-lg transition-all duration-300 ${dashboardCollapsed ? 'py-2 px-4' : 'p-6'}`}>
        <div className="w-full flex items-center justify-between cursor-pointer" onClick={() => setDashboardCollapsed((v) => !v)}>
          <h2 className={`font-semibold transition-all duration-300 ${dashboardCollapsed ? 'text-sm' : 'text-xl'}`} style={{background: 'linear-gradient(135deg, hsl(38,95%,58%), hsl(12,85%,60%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>Sermon Analytics</h2>
          <Button size="icon" variant="ghost" className="h-7 w-7">
            {dashboardCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
        <div className={`overflow-hidden transition-all duration-300 ${dashboardCollapsed ? 'max-h-0 opacity-0 mt-0' : 'mt-4'}`}>
          <AnalyticsSidebar
            metrics={metrics}
            sentenceMetricsSorted={sentenceMetricsSorted}
            fillerWords={fillerWords}
            silences={silences}
            longSilences={longSilences}
            longestSilence={longestSilence}
            scriptureRefs={scriptureRefs}
            confusingPhrases={confusingPhrases}
            accessibilityScore={accessibilityScore}
            questions={questions}
            congregationQuestions={congregationQuestions}
            missedQuestions={missedQuestions}
            illustrations={illustrations}
            illustrationTypes={illustrationTypes}
            intent={intent}
            avgWpm={avgWpm}
            wordCount={wordCount}
            engagementScore={engagementScore}
            engagementExpanded={engagementExpanded}
            setEngagementExpanded={setEngagementExpanded}
            currentMs={currentMs}
            seekTo={seekTo}
            coachLoading={coachLoading}
            coachNotes={coachNotes}
            coachApplying={coachApplying}
            hasSentences={sortedSentences.length > 0}
            onGenerateCoachNotes={handleGenerateCoachNotes}
            onApplyCoachNotes={handleApplyCoachNotes}
            onDiscardCoachNotes={() => setCoachNotes(null)}
          />
        </div>
      </Card>

      {/* ── Transcript row ── */}
      <div className="flex gap-4">
        {/* ── Left sidebar ── */}
        <div className="sticky top-4 self-start shrink-0 w-44 hidden lg:block">
          <Card className="p-4 space-y-4">
            {/* Comment count */}
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{comments.filter((c) => !c.ruleId).length}</div>
              <div className="text-xs text-muted-foreground">Comments</div>
            </div>

            {comments.filter((c) => !c.ruleId).length > 0 && (
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-mine"
                  checked={hideMyComments}
                  onCheckedChange={setHideMyComments}
                />
                <label htmlFor="hide-mine" className="text-xs text-muted-foreground cursor-pointer">
                  Hide mine
                </label>
              </div>
            )}

            <div className="border-t" />

            {/* Playback speed */}
            <div className="space-y-2 text-center">
              <div className="text-xs text-muted-foreground">Speed</div>
              <div className="flex items-center justify-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => {
                    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                    const idx = speeds.indexOf(playbackRate);
                    if (idx > 0) setPlaybackRate(speeds[idx - 1]);
                  }}
                  disabled={playbackRate <= 0.5}
                >
                  <span className="text-xs font-bold">−</span>
                </Button>
                <span className="text-lg font-mono font-bold min-w-[3rem] text-center">{playbackRate}x</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => {
                    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                    const idx = speeds.indexOf(playbackRate);
                    if (idx < speeds.length - 1) setPlaybackRate(speeds[idx + 1]);
                  }}
                  disabled={playbackRate >= 2}
                >
                  <span className="text-xs font-bold">+</span>
                </Button>
              </div>
            </div>

            <div className="border-t" />

            {/* Highlight */}
            <div className="space-y-2 text-center">
              <div className="text-xs text-muted-foreground">Highlighter</div>
              <Button
                variant={highlightMode ? "default" : "outline"}
                size="sm"
                onClick={() => setHighlightMode(!highlightMode)}
                className="w-full"
              >
                <Highlighter className="h-4 w-4 mr-2" />
                {highlightMode ? "Done" : "Highlight"}
              </Button>
              {highlightMode && (
                <div className="flex items-center justify-center gap-1.5">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.name}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-transform",
                        activeColor.name === c.name ? "scale-125 border-foreground" : "border-transparent"
                      )}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => setActiveColor(c)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t" />

            {/* View mode */}
            <div className="space-y-2 text-center">
              <div className="text-xs text-muted-foreground">View Mode</div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setViewMode(viewMode === "sentence" ? "paragraph" : "sentence")}
              >
                {viewMode === "sentence" ? (
                  <><AlignLeft className="h-4 w-4 mr-2" /> Paragraph</>
                ) : (
                  <><List className="h-4 w-4 mr-2" /> Sentence</>
                )}
              </Button>
            </div>

            {userScrolledAway && (
              <>
                <div className="border-t" />
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={scrollToActive}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Return to current
                </Button>
              </>
            )}
          </Card>
        </div>

        {/* ── Center: Transcript ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Mobile controls */}
          <div className="flex items-center gap-2 flex-wrap lg:hidden">
            <Button
              variant={highlightMode ? "default" : "outline"}
              size="sm"
              onClick={() => setHighlightMode(!highlightMode)}
            >
              <Highlighter className="h-4 w-4 mr-2" />
              {highlightMode ? "Highlighting" : "Highlight"}
            </Button>
            {highlightMode && HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.name}
                className={cn(
                  "w-6 h-6 rounded-full border-2",
                  activeColor.name === c.name ? "border-foreground scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c.hex }}
                onClick={() => setActiveColor(c)}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "sentence" ? "paragraph" : "sentence")}
            >
              {viewMode === "sentence" ? <AlignLeft className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
              {viewMode === "sentence" ? "Paragraph" : "Sentence"}
            </Button>
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
                    onClick={() => { setShowCommentBox(false); setSelectedRange(null); setCommentText(""); }}
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
                  onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSaveComment(); }}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowCommentBox(false); setCommentText(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveComment}
                    disabled={!commentText.trim() || savingComment}
                  >
                    {savingComment && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Comment (⌘↵)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transcript card */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Transcript
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {autoScrollEnabled ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Auto-scroll on
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={scrollToActive}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Snap to current
                  </Button>
                )}
              </div>
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
                <div
                  className="space-y-1 overflow-y-auto max-h-[calc(100vh-16rem)] pr-2 scroll-smooth"
                  ref={transcriptContainerRef}
                >
                  {viewMode === "sentence" ? (
                    // ── Sentence view ──
                    sortedSentences.map((sentence, idx) => {
                      const isActive = idx === activeSentenceIdx;
                      const highlightHex = highlightMap[idx];
                      const sentComments = (commentsBySentence[idx] ?? []).filter(
                        (c) => !(hideMyComments && !c.ruleId)
                      );
                      const isSelected = selectedRange?.sentenceIdx === idx;

                      return (
                        <div key={sentence._id} ref={(el) => { sentenceRefs.current[idx] = el; }}>
                          <div
                            className={cn(
                              "px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-base leading-relaxed group",
                              isActive && "bg-blue-100 dark:bg-blue-900/40 font-medium ring-2 ring-blue-300 dark:ring-blue-700",
                              !isActive && !highlightHex && "hover:bg-muted/60",
                              isSelected && "ring-2 ring-primary",
                              highlightMode && "hover:opacity-80"
                            )}
                            style={highlightHex && !isActive ? { backgroundColor: highlightHex + "80" } : undefined}
                            onClick={() => handleSentenceClick(idx, sentence.startTimeMs, sentence.endTimeMs)}
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
                                <div key={c._id} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 group/comment">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm leading-relaxed">{c.commentText}</p>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 shrink-0 opacity-0 group-hover/comment:opacity-100"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteComment(c._id); }}
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
                    })
                  ) : (
                    // ── Paragraph view ──
                    paragraphs.map((para, pIdx) => {
                      const isActivePara = pIdx === activeParagraphIdx;
                      const firstSentenceIdx = sortedSentences.indexOf(para[0]);

                      // Collect comments for sentences in this paragraph
                      const paraComments = para.flatMap((_, sOffset) => {
                        const idx = firstSentenceIdx + sOffset;
                        return (commentsBySentence[idx] ?? []).filter(
                          (c) => !(hideMyComments && !c.ruleId)
                        );
                      });

                      return (
                        <div
                          key={pIdx}
                          ref={(el) => { paragraphRefs.current[pIdx] = el; }}
                          className={cn(
                            "rounded-xl p-4 mb-3 cursor-pointer transition-all duration-200 border border-transparent",
                            isActivePara
                              ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 shadow-sm"
                              : "hover:bg-muted/40"
                          )}
                          onClick={() => {
                            if (para.length > 0) {
                              handleSentenceClick(firstSentenceIdx, para[0].startTimeMs, para[para.length - 1].endTimeMs);
                            }
                          }}
                        >
                          {/* Paragraph timestamp */}
                          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                            <span className="font-mono">{formatMs(para[0].startTimeMs)}</span>
                            {isActivePara && (
                              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Now playing
                              </span>
                            )}
                          </div>

                          {/* Sentences in paragraph */}
                          <p className="text-base leading-relaxed">
                            {para.map((sentence, sOffset) => {
                              const idx = firstSentenceIdx + sOffset;
                              const isActiveSentence = idx === activeSentenceIdx;
                              const highlightHex = highlightMap[idx];
                              return (
                                <span
                                  key={sentence._id}
                                  className={cn(
                                    "transition-all duration-100",
                                    isActiveSentence && "bg-blue-200 dark:bg-blue-800/60 rounded px-0.5 font-medium",
                                    !isActiveSentence && highlightHex && "rounded px-0.5"
                                  )}
                                  style={highlightHex && !isActiveSentence ? { backgroundColor: highlightHex + "80" } : undefined}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSentenceClick(idx, sentence.startTimeMs, sentence.endTimeMs);
                                  }}
                                >
                                  {sentence.sentenceText}{" "}
                                </span>
                              );
                            })}
                          </p>

                          {/* Comments on this paragraph */}
                          {paraComments.length > 0 && (
                            <div className="mt-3 pl-3 border-l-2 border-amber-400 space-y-2">
                              {paraComments.map((c) => (
                                <div key={c._id} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5 group/comment">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm leading-relaxed">{c.commentText}</p>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 shrink-0 opacity-0 group-hover/comment:opacity-100"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteComment(c._id); }}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formatMs(c.startTimeMs)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}

// ─── Analytics Panel Card ─────────────────────────────────────────────────────
function AnalyticsPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}

// ─── Analytics Sidebar Component ──────────────────────────────────────────────
function AnalyticsSidebar({
  metrics,
  sentenceMetricsSorted,
  fillerWords,
  silences,
  longSilences,
  longestSilence,
  scriptureRefs,
  confusingPhrases,
  accessibilityScore,
  questions,
  congregationQuestions,
  missedQuestions,
  illustrations,
  illustrationTypes,
  intent,
  avgWpm,
  wordCount,
  engagementScore,
  engagementExpanded,
  setEngagementExpanded,
  currentMs,
  seekTo,
  coachLoading,
  coachNotes,
  coachApplying,
  hasSentences,
  onGenerateCoachNotes,
  onApplyCoachNotes,
  onDiscardCoachNotes,
}: {
  metrics: {
    wpm?: number | null;
    wordCount?: number | null;
    engagementScore?: number | null;
    illustrationScore?: number | null;
    emotionalResonanceScore?: number | null;
    scriptureRefs?: number | null;
    illustrationCount?: number | null;
    congregationQuestions?: number | null;
  } | null | undefined;
  sentenceMetricsSorted: { wpm: number; startTimeMs: number }[];
  fillerWords: { _id: string; word: string; count: number }[];
  silences: { _id: string; startTimeMs: number; endTimeMs: number; durationMs: number }[];
  longSilences: { _id: string; startTimeMs: number; endTimeMs: number; durationMs: number }[];
  longestSilence: number;
  scriptureRefs: { _id: string; reference: string; context: string; startTimeMs: number }[];
  confusingPhrases: { _id: string; phrase: string; severity: string; suggestion: string; startTimeMs: number }[];
  accessibilityScore: number;
  questions: { _id: string; questionText: string; isCongregationQuestion: boolean; startTimeMs: number }[];
  congregationQuestions: { _id: string; questionText: string; isCongregationQuestion: boolean; startTimeMs: number }[];
  missedQuestions: { _id: string; originalText: string; suggestedQuestion: string; startTimeMs: number }[];
  illustrations: { _id: string; type: string; description: string; startTimeMs: number }[];
  illustrationTypes: Record<string, number>;
  intent: { know: string; feel: string; doAction: string; emotionalTone: string; headHeartRatio: number } | null | undefined;
  avgWpm: number | null;
  wordCount: number | null;
  engagementScore: number | null;
  engagementExpanded: boolean;
  setEngagementExpanded: (v: boolean) => void;
  currentMs: number;
  seekTo: (ms: number) => void;
  coachLoading: boolean;
  coachNotes: Array<{ sentence_index: number; category?: string; comment_text: string; start_time_ms: number; end_time_ms: number }> | null;
  coachApplying: boolean;
  hasSentences: boolean;
  onGenerateCoachNotes: () => void;
  onApplyCoachNotes: () => void;
  onDiscardCoachNotes: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* ── Engagement Score ── full width */}
      <AnalyticsPanel title="Engagement Score">
        {metrics === undefined ? (
          <AnalyticsSkeleton />
        ) : metrics === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing...
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-4xl font-bold text-amber-600">
                {engagementScore !== null ? engagementScore.toFixed(1) : "—"}
                <span className="text-base text-muted-foreground font-normal">/10</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setEngagementExpanded(!engagementExpanded)}
              >
                {engagementExpanded ? "Collapse" : "Details"}
              </Button>
            </div>
            {engagementScore !== null && (
              <Progress value={(engagementScore / 10) * 100} className="h-2 mb-3" />
            )}
            {engagementExpanded && (
              <div className="space-y-2 border-t pt-3">
                {[
                  { label: "🎭 Stories & Illustrations", value: metrics.illustrationScore },
                  { label: "❤️ Emotional Resonance", value: metrics.emotionalResonanceScore },
                  { label: "📖 Scripture", value: metrics.scriptureRefs ? Math.min(10, metrics.scriptureRefs * 1.5) : null },
                  { label: "🎤 Engagement", value: engagementScore },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            value === null || value === undefined ? "bg-muted-foreground/30" :
                            value >= 7 ? "bg-emerald-500" : value >= 4 ? "bg-amber-500" : "bg-red-500"
                          )}
                          style={{ width: value !== null && value !== undefined ? `${(value / 10) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="font-medium w-5 text-right">
                        {value !== null && value !== undefined ? value.toFixed(1) : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </AnalyticsPanel>

      {/* ── 3-column grid for remaining panels ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ── Speaking Pace / WPM ── */}
      <AnalyticsPanel title="Speaking Pace">
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
              <WpmSparkline
                data={sentenceMetricsSorted}
                currentMs={currentMs}
                onSeek={seekTo}
              />
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
      </AnalyticsPanel>

      {/* ── Filler Words ── */}
      <AnalyticsPanel title="Filler Words">
        {fillerWords === undefined ? (
          <AnalyticsSkeleton />
        ) : fillerWords.length === 0 ? (
          <p className="text-sm text-muted-foreground">None detected</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              {fillerWords.reduce((s, fw) => s + fw.count, 0)} total filler words
            </p>
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
      </AnalyticsPanel>

      {/* ── Use of Silence ── */}
      <AnalyticsPanel title="Use of Silence">
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
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {longSilences.map((s) => (
                  <button
                    key={s._id}
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-center justify-between"
                    onClick={() => seekTo(s.startTimeMs)}
                  >
                    <span className="text-muted-foreground">{formatMs(s.startTimeMs)}</span>
                    <span className="font-medium">{(s.durationMs / 1000).toFixed(1)}s pause</span>
                  </button>
                ))}
              </div>
            )}
            {longSilences.length === 0 && (
              <p className="text-sm text-muted-foreground">No significant pauses detected</p>
            )}
          </div>
        )}
      </AnalyticsPanel>

      {/* ── Scripture References ── */}
      <AnalyticsPanel title="Scripture References">
        {scriptureRefs === undefined ? (
          <AnalyticsSkeleton />
        ) : scriptureRefs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scripture references detected</p>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {scriptureRefs.length} reference{scriptureRefs.length !== 1 ? "s" : ""} found
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scriptureRefs.map((ref) => (
                <button
                  key={ref._id}
                  className="w-full text-left rounded-lg border p-2.5 hover:bg-muted transition-colors"
                  onClick={() => seekTo(ref.startTimeMs)}
                >
                  <div className="font-medium text-sm text-emerald-700 dark:text-emerald-400">{ref.reference}</div>
                  {ref.context && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ref.context}</div>
                  )}
                  <div className="text-xs text-primary mt-1">{formatMs(ref.startTimeMs)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </AnalyticsPanel>

      {/* ── Insider Language ── */}
      <AnalyticsPanel title="Insider Language">
        {confusingPhrases === undefined ? (
          <AnalyticsSkeleton />
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                {confusingPhrases.length} flagged phrase{confusingPhrases.length !== 1 ? "s" : ""}
              </span>
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
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {confusingPhrases.map((p) => (
                  <div key={p._id} className="border rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">"{p.phrase}"</span>
                      <SeverityBadge severity={p.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground">💡 {p.suggestion}</p>
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
      </AnalyticsPanel>

      {/* ── Questions ── */}
      <AnalyticsPanel title="Questions">
        {questions === undefined ? (
          <AnalyticsSkeleton />
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions detected</p>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {congregationQuestions.length} congregation · {questions.length} total
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {congregationQuestions.map((q) => (
                <button
                  key={q._id}
                  className="w-full text-left rounded-lg border border-blue-200 dark:border-blue-800 p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  onClick={() => seekTo(q.startTimeMs)}
                >
                  <p className="text-sm line-clamp-2">{q.questionText}</p>
                  <span className="text-xs text-primary mt-0.5 block">{formatMs(q.startTimeMs)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </AnalyticsPanel>

      {/* ── Missed Question Opportunities ── */}
      <AnalyticsPanel title="Missed Question Opportunities">
        {missedQuestions === undefined ? (
          <AnalyticsSkeleton />
        ) : missedQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missed opportunities found</p>
        ) : (
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {missedQuestions.map((mq) => (
              <div key={mq._id} className="border rounded-lg p-2.5 space-y-1.5">
                <p className="text-xs text-muted-foreground italic line-clamp-2">"{mq.originalText}"</p>
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
      </AnalyticsPanel>

      {/* ── Stories & Illustrations ── */}
      <AnalyticsPanel title="Stories & Illustrations">
        {illustrations === undefined ? (
          <AnalyticsSkeleton />
        ) : illustrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No illustrations detected</p>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(illustrationTypes).map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {type}: {count}
                </Badge>
              ))}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {illustrations.map((ill) => (
                <button
                  key={ill._id}
                  className="w-full text-left rounded-lg border p-2.5 hover:bg-muted transition-colors"
                  onClick={() => seekTo(ill.startTimeMs)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{ill.type}</Badge>
                    <span className="text-xs text-primary">{formatMs(ill.startTimeMs)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{ill.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </AnalyticsPanel>

      {/* ── Preacher’s Intent ── */}
      <AnalyticsPanel title="Preacher’s Intent">
        {intent === undefined ? (
          <AnalyticsSkeleton />
        ) : intent === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing intent...
          </div>
        ) : (
          <div className="space-y-3">
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
            {intent.emotionalTone && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Emotional Tone</div>
                <Badge variant="secondary">{intent.emotionalTone}</Badge>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>🧠 Head (logic)</span>
                <span>❤️ Heart (emotion)</span>
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
      </AnalyticsPanel>

      {/* ── Digital Bert AI Coach ── */}
      <AnalyticsPanel title="Digital Bert — AI Coach">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            AI reviews this sermon&apos;s transcript and writes timestamped coaching notes in your voice.
          </p>
          <Button
            onClick={onGenerateCoachNotes}
            disabled={coachLoading || !hasSentences}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {coachLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reviewing sermon...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" />{coachNotes ? "Re-generate notes" : "Generate AI Coach notes"}</>
            )}
          </Button>

          {coachNotes && coachNotes.length > 0 ? (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {coachNotes.map((n, i) => {
                  const ms = n.start_time_ms || 0;
                  const ts = formatMsLong(ms);
                  return (
                    <div key={i} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant="default" className="font-mono text-[10px]">#{i + 1}</Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">{ts}</Badge>
                        {n.category && (
                          <Badge variant="secondary" className="text-[10px] capitalize">{n.category}</Badge>
                        )}
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-auto"
                          onClick={() => seekTo(ms)}
                        >
                          Jump to moment
                        </button>
                      </div>
                      <p className="text-sm leading-relaxed">{n.comment_text}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={onDiscardCoachNotes} disabled={coachApplying}>
                  Discard
                </Button>
                <Button size="sm" onClick={onApplyCoachNotes} disabled={coachApplying}>
                  {coachApplying ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying...</>
                  ) : (
                    `Apply ${coachNotes.length} as comments`
                  )}
                </Button>
              </div>
            </>
          ) : coachNotes !== null ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              No notes generated. Check that ANTHROPIC_API_KEY is configured and try re-running analysis.
            </p>
          ) : null}
        </div>
      </AnalyticsPanel>
      </div>
    </div>
  );
}
