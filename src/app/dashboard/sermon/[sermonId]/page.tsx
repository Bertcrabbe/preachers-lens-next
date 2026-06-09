"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useMicrophoneSelector } from "@/hooks/useMicrophoneSelector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  Play,
  Pause,
  Download,
  Loader2,
  FileText,
  List,
  AlignLeft,
  MessageSquare,
  X,
  Sparkles,
  RotateCcw,
  Mic,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Check,
  Scissors,
  Volume2,
  ZoomIn,
  Maximize2,
  Minimize2,
  ZoomOut,
  Highlighter,
  FileBarChart,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AudioRecorder } from "@/components/AudioRecorder";
import { FloatingRecordingIndicator } from "@/components/FloatingRecordingIndicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { combineAudioFiles } from "@/utils/audioCombiner";
import { generateClientReportPdf, type ClientReportData } from "@/utils/clientReportPdf";
import { toPng } from "html-to-image";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import Sparkline from "@/components/Sparkline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Type definitions matching Convex schema ─────────────────────────────────

type Sermon = {
  _id: Id<"sermons">;
  title?: string | null;
  fileId?: Id<"_storage">;
  fileUrl?: string;
  transcriptionStatus: string;
  durationSeconds?: number | null;
};

type Sentence = {
  _id: Id<"sermonSentences">;
  sermonId: Id<"sermons">;
  startTimeMs: number;
  endTimeMs: number;
  sentenceText: string;
  orderIndex: number;
};

type Comment = {
  _id: Id<"sermonComments">;
  userId: string;
  sermonId: Id<"sermons">;
  startTimeMs: number;
  endTimeMs: number;
  commentText: string;
  ruleId?: Id<"evaluationRules"> | null;
  audioUrl?: string | null;
  createdAt?: number;
};

type EvaluationRule = {
  _id: Id<"evaluationRules">;
  name: string;
  description: string;
  color: string;
  prompt: string;
};

// ── Convex coach style guide type ───────────────────────────────────────────
type CoachStyleGuide = {
  _id: string;
  userId: string;
  guideText: string;
  commentsAnalyzed: number;
  lastAnalyzedAt?: number | null;
};

// ── Helper: compute confusingPhrases-like shape from Convex data ────────────
type ConfusingPhrase = {
  _id: string;
  phrase: string;
  severity: string;
  suggestion: string;
  sentenceIndex: number;
  startTimeMs: number;
};

type ScriptureRef = {
  _id: string;
  reference: string;
  context: string;
  startTimeMs: number;
  sentenceIndex: number;
};

type MissedQuestion = {
  _id: string;
  originalText: string;
  suggestedQuestion: string;
  sentenceIndex: number;
  startTimeMs: number;
};

type Illustration = {
  _id: string;
  type: string;
  description: string;
  startSentenceIndex: number;
  endSentenceIndex: number;
  startTimeMs: number;
};

type SermonIntent = {
  _id: string;
  know: string;
  feel: string;
  doAction: string;
  emotionalTone: string;
  headHeartRatio: number;
};

type Question = {
  _id: string;
  questionText: string;
  isCongregationQuestion: boolean;
  sentenceIndex: number;
  startTimeMs: number;
};

type Silence = {
  _id: string;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
};

type FillerWord = {
  _id: string;
  word: string;
  count: number;
  occurrences: string;
};

type Highlight = {
  _id: string;
  sentenceIndex: number;
  color: string;
};

export default function SermonViewer() {
  const params = useParams();
  const id = params.sermonId as string;
  const sermonId = id as Id<"sermons">;
  const router = useRouter();
  const { user } = useUser();
  const { audioDevices, selectedDeviceId, setSelectedDeviceId, getSelectedDeviceLabel } = useMicrophoneSelector();

  // ── Convex queries ──────────────────────────────────────────────────────────
  const sermon = useQuery(api.sermons.get, { sermonId });
  const rawSentences = useQuery(api.sermons.getSentences, { sermonId }) ?? [];
  const convexComments = useQuery(api.sermons.getComments, { sermonId }) ?? [];
  const convexHighlights = useQuery(api.sermons.getHighlights, { sermonId }) ?? [];
  const convexFillerWords = useQuery(api.sermons.getFillerWords, { sermonId }) ?? [];
  const convexSilences = useQuery(api.sermons.getSilences, { sermonId }) ?? [];
  const convexScriptureRefs = useQuery(api.sermons.getScriptureRefs, { sermonId }) ?? [];
  const convexConfusingPhrases = useQuery(api.sermons.getConfusingPhrases, { sermonId }) ?? [];
  const convexQuestions = useQuery(api.sermons.getQuestions, { sermonId }) ?? [];
  const convexMissedQuestions = useQuery(api.sermons.getMissedQuestions, { sermonId }) ?? [];
  const convexIllustrations = useQuery(api.sermons.getIllustrations, { sermonId }) ?? [];
  const convexIntent = useQuery(api.sermons.getIntent, { sermonId });
  const convexMetrics = useQuery(api.sermons.getSermonMetrics, { sermonId });

  // Audio URL from Convex storage
  const storageUrl = useQuery(
    api.sermons.getStorageUrl,
    sermon?.fileId ? { storageId: sermon.fileId } : "skip"
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const addCommentMutation = useMutation(api.sermons.addComment);
  const deleteCommentMutation = useMutation(api.sermons.deleteComment);
  const toggleHighlightMutation = useMutation(api.sermons.toggleHighlight);
  const updateTitleMutation = useMutation(api.sermons.updateTitle);

  // ── Audio refs & state ──────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Derive sentences sorted by orderIndex
  const sentences: Sentence[] = useMemo(
    () => [...rawSentences].sort((a, b) => a.orderIndex - b.orderIndex) as Sentence[],
    [rawSentences]
  );

  // Derive comments with ruleId check (Convex has ruleId, no evaluation_rules join)
  const comments: Comment[] = useMemo(() => convexComments as Comment[], [convexComments]);

  // Highlights map
  const highlightMap: Record<number, string> = useMemo(() => {
    const map: Record<number, string> = {};
    for (const h of convexHighlights as Highlight[]) map[h.sentenceIndex] = h.color;
    return map;
  }, [convexHighlights]);

  // Scripture sentence indices (from Convex data)
  const scriptureRefs = convexScriptureRefs as ScriptureRef[];
  const confusingPhrases = convexConfusingPhrases as ConfusingPhrase[];
  const missedQuestionsData = useMemo(() => ({
    opportunities: (convexMissedQuestions as MissedQuestion[]).map(mq => ({
      index: mq.sentenceIndex,
      statement: mq.originalText,
      suggested_question: mq.suggestedQuestion,
      reason: undefined as string | undefined,
    })),
  }), [convexMissedQuestions]);
  const intentData = useMemo(() => {
    const d = convexIntent as SermonIntent | null | undefined;
    if (!d) return null;
    return { know: d.know, feel: d.feel, do: d.doAction, summary: d.emotionalTone };
  }, [convexIntent]);
  const illustrationData = useMemo(() => {
    const ills = convexIllustrations as Illustration[];
    if (ills.length === 0) return null;
    const breakdown = { stories: 0, humor: 0, illustrations: 0, audience_interactions: 0 };
    for (const ill of ills) {
      if (ill.type === "story") breakdown.stories++;
      else if (ill.type === "humor") breakdown.humor++;
      else if (ill.type === "crowd_work") breakdown.audience_interactions++;
      else breakdown.illustrations++;
    }
    return {
      elements: ills.map(ill => ({ type: ill.type, summary: ill.description, excerpt: "" })),
      total_count: ills.length,
      illustration_score: convexMetrics?.illustrationScore ?? (ills.length > 0 ? Math.min(10, ills.length * 2) : 0),
      breakdown,
    };
  }, [convexIllustrations, convexMetrics]);
  const congregationQuestionIndices = useMemo(() => {
    const qs = convexQuestions as Question[];
    return new Set(qs.filter(q => q.isCongregationQuestion).map(q => q.sentenceIndex));
  }, [convexQuestions]);

  // State
  const [audioUrl, setAudioUrl] = useState<string>("");
  const audioUrlTimestampRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<"sentence" | "paragraph">("paragraph");
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<{ start: number; end: number } | null>(null);
  const [newComment, setNewComment] = useState("");
  const [rules, setRules] = useState<EvaluationRule[]>([]);
  const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [commentType, setCommentType] = useState<"text" | "audio">("audio");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [combiningAudio, setCombiningAudio] = useState(false);
  const [combineProgress, setCombineProgress] = useState(0);
  const [combineStatus, setCombineStatus] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string>("");
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewingParagraph, setPreviewingParagraph] = useState<number | null>(null);
  const [showFastSpeech, setShowFastSpeech] = useState(false);
  const [showVerbalPauses, setShowVerbalPauses] = useState(false);
  const [showSlowSpeech, setShowSlowSpeech] = useState(false);
  const [showVolumeChanges, setShowVolumeChanges] = useState(false);
  const [showInsiderLanguage, setShowInsiderLanguage] = useState(false);
  const [showSilentPauses, setShowSilentPauses] = useState(false);
  const [visibleFillerWords, setVisibleFillerWords] = useState<Set<string>>(new Set());
  const [visibleInsiderTerms, setVisibleInsiderTerms] = useState<Set<string>>(new Set());
  const [fastSpeechThreshold, setFastSpeechThreshold] = useState(1.2);
  const [slowSpeechThreshold, setSlowSpeechThreshold] = useState(0.75);
  const [volumeChangeThreshold, setVolumeChangeThreshold] = useState(1.0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [commentSummary, setCommentSummary] = useState<{
    summary: string;
    bulletPoints: string[];
  } | null>(null);
  // AI Coach
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachApplying, setCoachApplying] = useState(false);
  const [coachDeleting, setCoachDeleting] = useState(false);
  const [coachRegenAudio, setCoachRegenAudio] = useState(false);
  const [coachNotes, setCoachNotes] = useState<Array<{
    sentence_index: number;
    category?: string;
    comment_text: string;
    start_time_ms: number;
    end_time_ms: number;
  }> | null>(null);
  const [coachPreviewLoadingIdx, setCoachPreviewLoadingIdx] = useState<number | null>(null);
  const [coachPreviewPlayingIdx, setCoachPreviewPlayingIdx] = useState<number | null>(null);
  const coachPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const coachPreviewCacheRef = useRef<Map<number, string>>(new Map());

  // Style guide (from Convex)
  const [styleGuide, setStyleGuide] = useState<{
    last_analyzed_at: string | null;
    comments_analyzed: number;
  } | null>(null);
  const [relearning, setRelearning] = useState(false);

  // Loading state managed by sermon query
  useEffect(() => {
    if (sermon !== undefined) setLoading(false);
  }, [sermon]);

  // Auth guard
  useEffect(() => {
    if (user === null) router.push("/sign-in");
  }, [user, router]);

  // Set audio URL from Convex storage or fallback
  useEffect(() => {
    if (sermon?.fileId && storageUrl) {
      setAudioUrl(storageUrl);
      audioUrlTimestampRef.current = Date.now();
    } else if (sermon?.fileUrl) {
      setAudioUrl(sermon.fileUrl);
      audioUrlTimestampRef.current = Date.now();
    }
  }, [sermon, storageUrl]);

  const handleRelearnStyle = async () => {
    // TODO: stub — requires ElevenLabs/voice API integration
    toast.info("Style re-learning requires ElevenLabs configuration (TODO).");
  };

  const handlePreviewCoachNote = async (idx: number, text: string) => {
    // If already playing this one, stop
    if (coachPreviewPlayingIdx === idx && coachPreviewAudioRef.current) {
      coachPreviewAudioRef.current.pause();
      coachPreviewAudioRef.current = null;
      setCoachPreviewPlayingIdx(null);
      return;
    }
    // Stop any other preview
    if (coachPreviewAudioRef.current) {
      coachPreviewAudioRef.current.pause();
      coachPreviewAudioRef.current = null;
      setCoachPreviewPlayingIdx(null);
    }
    // Pause sermon audio if it's playing
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    // TODO: stub — requires TTS clone API
    toast.info("Voice preview requires ElevenLabs voice clone configuration (TODO).");
  };

  const [viewStart, setViewStart] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  // Scripture refs from Convex
  const [showScriptureRefs, setShowScriptureRefs] = useState(false);
  const [showConfusingPhrases, setShowConfusingPhrases] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [loadingQuestions] = useState(false);
  const [previewWithComments, setPreviewWithComments] = useState(true);
  const [playingCommentId, setPlayingCommentId] = useState<string | null>(null);
  const commentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [commentSignedUrls, setCommentSignedUrls] = useState<Record<string, string>>({});
  const [playedCommentIds, setPlayedCommentIds] = useState<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);
  const isPlayingCommentRef = useRef<boolean>(false);
  const [wpmChartClockActive, setWpmChartClockActive] = useState(false);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const dragStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const [volumeChartClockActive, setVolumeChartClockActive] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [userScrolledAway, setUserScrolledAway] = useState(false);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isAutoScrollingRef = useRef(false);
  const [transcribing, setTranscribing] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [sermonVolume, setSermonVolume] = useState(1.0);
  const [commentVolume, setCommentVolume] = useState(1.0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [floatingRecording, setFloatingRecording] = useState<{
    isRecording: boolean;
    time: number;
    stopFn: (() => void) | null;
  }>({ isRecording: false, time: 0, stopFn: null });
  const [preAcquiredStream, setPreAcquiredStream] = useState<MediaStream | null | undefined>(undefined);
  const [showAudioEditor, setShowAudioEditor] = useState(false);

  // Loading states (analytics computed server-side by Convex, always available)
  const [loadingIllustrations] = useState(false);
  const [loadingEmotional] = useState(false);
  const [loadingMissedQuestions] = useState(false);
  const [loadingIntent] = useState(false);
  const [loadingConfusing] = useState(false);
  const [loadingScriptures] = useState(false);

  // Emotional data (from Convex metrics)
  const emotionalData = useMemo(() => {
    if (!convexMetrics) return null;
    const score = convexMetrics.emotionalResonanceScore ?? 0;
    if (score === 0) return null;
    return {
      overall_score: score,
      subscores: {
        vulnerability: score,
        affective_language: score,
        sensory_imagery: score,
        pathos_moments: score,
      },
      affective_percentage: Math.round(score * 10),
      summary: "",
      pathos_moments: [] as Array<{ type: string; excerpt: string; note: string }>,
    };
  }, [convexMetrics]);

  const [showMissedQuestions, setShowMissedQuestions] = useState(false);
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false);
  const [hideAIEvalComments, setHideAIEvalComments] = useState(false);
  const [hiddenRuleIds, setHiddenRuleIds] = useState<Set<string>>(new Set());
  const [hideMyComments, setHideMyComments] = useState(false);

  // Registry of all AI-driven overlay toggles
  const aiOverlayToggles = [
    { active: showScriptureRefs, clear: () => setShowScriptureRefs(false) },
    { active: showConfusingPhrases, clear: () => setShowConfusingPhrases(false) },
    { active: showQuestions, clear: () => setShowQuestions(false) },
    { active: showMissedQuestions, clear: () => setShowMissedQuestions(false) },
    {
      active: !hideAIEvalComments && comments.some(c => !!c.ruleId),
      clear: () => setHideAIEvalComments(true),
    },
  ];
  const anyAIOverlayActive = aiOverlayToggles.some(t => t.active);
  const clearAllAIOverlays = () => aiOverlayToggles.forEach(t => t.clear());
  const [playerCollapsed, setPlayerCollapsed] = useState(false);
  const [highlights, setHighlights] = useState<Record<number, string>>({});
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeHighlightColor, setActiveHighlightColor] = useState('#39ff14');
  const [transcriptFullscreen, setTranscriptFullscreen] = useState(false);

  const HIGHLIGHT_COLORS = ['#ffff00', '#39ff14', '#ff7700'];

  // Sync highlights from Convex
  useEffect(() => {
    const map: Record<number, string> = {};
    for (const h of convexHighlights as Highlight[]) map[h.sentenceIndex] = h.color;
    setHighlights(map);
  }, [convexHighlights]);

  const toggleHighlight = async (sentenceIndex: number) => {
    if (!user?.id) return;
    await toggleHighlightMutation({
      sermonId,
      sentenceIndex,
      color: activeHighlightColor,
    });
  };

  useEffect(() => {
    if (audioUrl) {
      generateWaveform(audioUrl);
    }
  }, [audioUrl]);

  // Reset played comments when preview mode is toggled
  useEffect(() => {
    if (previewWithComments) {
      setPlayedCommentIds(new Set());
      lastTimeRef.current = audioRef.current?.currentTime ? audioRef.current.currentTime * 1000 : 0;
    }
  }, [previewWithComments]);

  // Apply playback rate to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const ensureAudioGain = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;
    const clampedSermonVolume = Number.isFinite(sermonVolume)
      ? Math.min(2, Math.max(0, sermonVolume))
      : 1;
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
      } catch (err) {
        console.warn("Web Audio boost unavailable, falling back to native audio output:", err);
        return false;
      }
    }
    if (!audioContextRef.current || !gainNodeRef.current) return false;
    if (audioContextRef.current.state !== "running") {
      try {
        await audioContextRef.current.resume();
      } catch (err) {
        console.error("AudioContext resume failed:", err);
        return false;
      }
    }
    gainNodeRef.current.gain.value = clampedSermonVolume;
    return true;
  }, [sermonVolume]);

  const playSermonAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const clampedSermonVolume = Number.isFinite(sermonVolume)
      ? Math.min(2, Math.max(0, sermonVolume))
      : 1;
    if (preAcquiredStream?.active) {
      preAcquiredStream.getTracks().forEach((t) => t.stop());
      setPreAcquiredStream(undefined);
    }
    const wantsBoost = clampedSermonVolume > 1;
    audio.muted = false;
    if (wantsBoost) {
      const boostReady = await ensureAudioGain();
      audio.volume = boostReady ? 1 : Math.min(1, clampedSermonVolume);
    } else {
      audio.volume = clampedSermonVolume;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch (err: unknown) {
      console.error("Failed to play sermon audio:", err);
      audio.muted = false;
      audio.volume = Math.min(1, clampedSermonVolume);
      setPlaying(false);
    }
  }, [ensureAudioGain, sermonVolume, preAcquiredStream]);

  // Apply gain value when sermonVolume changes
  useEffect(() => {
    const clampedSermonVolume = Number.isFinite(sermonVolume)
      ? Math.min(2, Math.max(0, sermonVolume))
      : 1;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedSermonVolume;
    }
    if (audioRef.current) {
      audioRef.current.muted = false;
      audioRef.current.volume = clampedSermonVolume > 1 ? 1 : clampedSermonVolume;
    }
  }, [sermonVolume]);

  // Apply comment volume and playback rate to comment audio element
  useEffect(() => {
    if (commentAudioRef.current) {
      commentAudioRef.current.volume = commentVolume;
      commentAudioRef.current.playbackRate = playbackRate;
    }
  }, [commentVolume, playbackRate, playingCommentId]);

  // Auto-scroll transcript to keep active paragraph as second from top
  useEffect(() => {
    if (!autoScrollEnabled || !playing || viewMode !== "paragraph") return;
    const paragraphs = groupIntoParagraphs(sentences);
    const activeIdx = paragraphs.findIndex(p => isCurrentParagraph(p));
    if (activeIdx === -1) return;
    const el = paragraphRefs.current[activeIdx];
    if (!el || !transcriptContainerRef.current) return;
    const container = transcriptContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const scrollOffset = elRect.top - containerRect.top + container.scrollTop;
    const firstEl = paragraphRefs.current[activeIdx > 0 ? activeIdx - 1 : 0];
    const offset = firstEl ? firstEl.getBoundingClientRect().height + 16 : 80;
    const targetScrollTop = scrollOffset - offset;
    const currentScroll = container.scrollTop;
    if (Math.abs(targetScrollTop - currentScroll) > 50) {
      isAutoScrollingRef.current = true;
      container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      setTimeout(() => { isAutoScrollingRef.current = false; }, 500);
      setUserScrolledAway(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, autoScrollEnabled, playing, viewMode, sentences]);

  // Detect user scroll to show "return" button
  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (isAutoScrollingRef.current) return;
      const paragraphs = groupIntoParagraphs(sentences);
      const activeIdx = paragraphs.findIndex(p => isCurrentParagraph(p));
      if (activeIdx === -1) return;
      const el = paragraphRefs.current[activeIdx];
      if (!el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const isVisible = elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom;
      setUserScrolledAway(!isVisible);
      if (!isVisible) setAutoScrollEnabled(false);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences, currentTime]);

  // Parallax depth effect for transcript paragraphs
  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;
    const updateDepth = () => {
      const containerRect = container.getBoundingClientRect();
      const containerHeight = containerRect.height;
      paragraphRefs.current.forEach(el => {
        if (!el) return;
        const elRect = el.getBoundingClientRect();
        const elCenter = elRect.top + elRect.height / 2 - containerRect.top;
        const ratio = elCenter / containerHeight;
        let depth: string;
        if (ratio < 0.1 || ratio > 0.9) depth = "far";
        else if (ratio < 0.25 || ratio > 0.75) depth = "mid";
        else if (ratio < 0.4 || ratio > 0.6) depth = "near";
        else depth = "focus";
        el.setAttribute("data-depth", depth);
      });
    };
    updateDepth();
    container.addEventListener("scroll", updateDepth, { passive: true });
    return () => container.removeEventListener("scroll", updateDepth);
  }, [sentences]);

  const scrollToActiveParagraph = () => {
    const paragraphs = groupIntoParagraphs(sentences);
    const activeIdx = paragraphs.findIndex(p => isCurrentParagraph(p));
    if (activeIdx === -1) return;
    const el = paragraphRefs.current[activeIdx];
    if (!el || !transcriptContainerRef.current) return;
    const container = transcriptContainerRef.current;
    container.scrollIntoView({ behavior: "smooth", block: "start" });
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const scrollOffset = elRect.top - containerRect.top + container.scrollTop;
    const firstEl = paragraphRefs.current[activeIdx > 0 ? activeIdx - 1 : 0];
    const offset = firstEl ? firstEl.getBoundingClientRect().height + 16 : 80;
    isAutoScrollingRef.current = true;
    setTimeout(() => {
      container.scrollTo({ top: scrollOffset - offset, behavior: "smooth" });
      setTimeout(() => { isAutoScrollingRef.current = false; }, 500);
    }, 300);
    setAutoScrollEnabled(true);
    setUserScrolledAway(false);
  };

  // Keyboard shortcuts for audio player
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        if (e.target instanceof HTMLButtonElement) {
          (e.target as HTMLButtonElement).blur();
        }
      }
      const sermonAudio = audioRef.current;
      const commentAudio = commentAudioRef.current;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (commentDialogOpen) {
            if (floatingRecording.isRecording && floatingRecording.stopFn) {
              floatingRecording.stopFn();
            }
            return;
          }
          if (playingCommentId) {
            if (commentAudio) {
              if (commentAudio.paused) commentAudio.play().catch(() => {});
              else commentAudio.pause();
            }
            return;
          }
          if (sermonAudio) {
            if (!sermonAudio.paused) sermonAudio.pause();
            else await playSermonAudio();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (commentAudio && playingCommentId) {
            commentAudio.currentTime = Math.max(0, commentAudio.currentTime - 5);
          } else if (sermonAudio) {
            sermonAudio.currentTime = Math.max(0, sermonAudio.currentTime - 5);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (commentAudio && playingCommentId) {
            commentAudio.currentTime = Math.min(commentAudio.duration || 0, commentAudio.currentTime + 5);
          } else if (sermonAudio) {
            sermonAudio.currentTime = Math.min(sermonAudio.duration || 0, sermonAudio.currentTime + 5);
          }
          break;
        case "KeyC":
          if (!playing && !playingCommentId && audioUrl && currentTime > 0) {
            e.preventDefault();
            const currentSentence = sentences.find(
              s => currentTime >= s.startTimeMs && currentTime <= s.endTimeMs
            );
            const timeMs = currentSentence ? currentSentence.startTimeMs : Math.round(currentTime);
            const endMs = currentSentence ? currentSentence.endTimeMs : Math.round(currentTime) + 1000;
            openCommentDialog(timeMs, endMs);
          }
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, playingCommentId, audioUrl, currentTime, sentences, commentDialogOpen, floatingRecording, playSermonAudio]);

  // Calculate time since last comment ended in audio timeline
  const timeSinceLastCommentInAudio = (() => {
    const userComments = comments.filter(c => !c.ruleId);
    if (userComments.length === 0) return null;
    const currentTimeMs = currentTime;
    const endedComments = userComments.filter(c => c.endTimeMs <= currentTimeMs);
    if (endedComments.length === 0) return null;
    const lastComment = endedComments.reduce((latest, comment) =>
      comment.endTimeMs > latest.endTimeMs ? comment : latest
    , endedComments[0]);
    return Math.floor((currentTimeMs - lastComment.endTimeMs) / 1000);
  })();

  const generateWaveform = async (url: string) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0);
      await audioContext.close();
      const worker = new Worker(
        new URL('../../../../utils/waveformWorker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (e) => {
        if (e.data.type === 'done') setWaveformData(e.data.data);
        worker.terminate();
      };
      worker.onerror = (err) => {
        console.error("Waveform worker failed:", err);
        worker.terminate();
      };
      worker.postMessage({ rawData, samples: 2000 }, [rawData.buffer]);
    } catch (error) {
      console.error("Error generating waveform:", error);
    }
  };

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || waveformData.length === 0 || !sermon?.durationSeconds) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const w = rect.width;
    const h = rect.height;
    const barCount = waveformData.length;
    const playedFraction = currentTime / (sermon.durationSeconds * 1000);
    const theme = document.documentElement.getAttribute('data-theme');
    let unplayedColor: string;
    let playedColor: string;
    if (theme === 'arctic-steel') {
      unplayedColor = 'hsla(215, 30%, 20%, 0.35)';
      playedColor = 'hsla(215, 30%, 20%, 0.85)';
    } else {
      unplayedColor = 'hsla(0, 0%, 100%, 0.35)';
      playedColor = 'hsla(0, 0%, 100%, 0.85)';
    }
    const barWidth = Math.max(w / barCount, 1.5);
    const gap = barWidth * 0.3;
    for (let i = 0; i < barCount; i++) {
      const x = (i / barCount) * w;
      const amplitude = waveformData[i];
      const barH = Math.max(amplitude * h, h * 0.08);
      const y = (h - barH) / 2;
      const isPlayed = (i / barCount) < playedFraction;
      ctx.fillStyle = isPlayed ? playedColor : unplayedColor;
      ctx.beginPath();
      const radius = Math.min((barWidth - gap) / 2, barH / 2);
      ctx.roundRect(x, y, Math.max(barWidth - gap, 1), barH, radius);
      ctx.fill();
    }
  }, [waveformData, currentTime, sermon?.durationSeconds, zoomLevel]);

  const paragraphHasPeak = (paragraph: Sentence[]): boolean => {
    if (!sermon?.durationSeconds || waveformData.length === 0) return false;
    const firstSentence = paragraph[0];
    const lastSentence = paragraph[paragraph.length - 1];
    const startTime = firstSentence.startTimeMs;
    const endTime = lastSentence.endTimeMs;
    const totalDuration = sermon.durationSeconds * 1000;
    const baselineAverage = waveformData.reduce((sum, amp) => sum + amp, 0) / waveformData.length;
    const startIdx = Math.floor((startTime / totalDuration) * waveformData.length);
    const endIdx = Math.ceil((endTime / totalDuration) * waveformData.length);
    const paragraphAmplitudes = waveformData.slice(startIdx, endIdx);
    const paragraphAverage = paragraphAmplitudes.reduce((sum, amp) => sum + amp, 0) / paragraphAmplitudes.length;
    return paragraphAverage < (baselineAverage * 0.67);
  };

  const hasSignificantVolumeChange = (paragraph: Sentence[], threshold: number): 'increase' | 'decrease' | null => {
    if (!sermon?.durationSeconds || waveformData.length === 0) return null;
    const firstSentence = paragraph[0];
    const lastSentence = paragraph[paragraph.length - 1];
    const startTime = firstSentence.startTimeMs;
    const endTime = lastSentence.endTimeMs;
    const totalDuration = sermon.durationSeconds * 1000;
    const baselineAverage = waveformData.reduce((sum, amp) => sum + amp, 0) / waveformData.length;
    const startIdx = Math.floor((startTime / totalDuration) * waveformData.length);
    const endIdx = Math.ceil((endTime / totalDuration) * waveformData.length);
    const paragraphAmplitudes = waveformData.slice(startIdx, endIdx);
    const paragraphAverage = paragraphAmplitudes.reduce((sum, amp) => sum + amp, 0) / paragraphAmplitudes.length;
    const volumeRatio = paragraphAverage / baselineAverage;
    const sensitivityMultiplier = 1 + (threshold * 0.3);
    if (volumeRatio > sensitivityMultiplier) return 'increase';
    if (volumeRatio < (1 / sensitivityMultiplier)) return 'decrease';
    return null;
  };

  const calculateSpeechRate = (paragraph: Sentence[]): number => {
    const firstSentence = paragraph[0];
    const lastSentence = paragraph[paragraph.length - 1];
    const durationSeconds = (lastSentence.endTimeMs - firstSentence.startTimeMs) / 1000;
    const text = paragraph.map(s => s.sentenceText).join(" ");
    const wordCount = text.split(/\s+/).length;
    return (wordCount / durationSeconds) * 60;
  };

  const getAverageSpeechRate = (): number => {
    if (sentences.length === 0) return 0;
    const paragraphs = groupIntoParagraphs(sentences);
    const rates = paragraphs.map(p => calculateSpeechRate(p));
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  };

  const hasFastSpeechRate = (paragraph: Sentence[], threshold: number = 1.5): boolean => {
    if (sentences.length === 0) return false;
    const paragraphRate = calculateSpeechRate(paragraph);
    const averageRate = getAverageSpeechRate();
    return paragraphRate > averageRate * threshold;
  };

  const countFastSpeechParagraphs = (threshold: number = 1.2): number => {
    if (sentences.length === 0) return 0;
    const paragraphs = groupIntoParagraphs(sentences);
    const averageRate = getAverageSpeechRate();
    return paragraphs.filter(p => {
      const rate = calculateSpeechRate(p);
      return rate > averageRate * threshold;
    }).length;
  };

  const getSpeedVariance = (): { min: number; max: number; stdDev: number; range: number } => {
    if (sentences.length === 0) return { min: 0, max: 0, stdDev: 0, range: 0 };
    const paragraphs = groupIntoParagraphs(sentences);
    const rates = paragraphs.map(p => calculateSpeechRate(p));
    if (rates.length === 0) return { min: 0, max: 0, stdDev: 0, range: 0 };
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const avg = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);
    return { min, max, stdDev, range: max - min };
  };

  const countSpeedTransitions = (thresholdPct: number = 15): number => {
    if (sentences.length === 0) return 0;
    const avgWpm = getAverageSpeechRate();
    if (avgWpm === 0) return 0;
    const paragraphs = groupIntoParagraphs(sentences);
    const rates = paragraphs.map(p => calculateSpeechRate(p));
    let transitions = 0;
    for (let i = 1; i < rates.length; i++) {
      const pctChange = (Math.abs(rates[i] - rates[i - 1]) / avgWpm) * 100;
      if (pctChange >= thresholdPct) transitions++;
    }
    return transitions;
  };

  const countSustainedDeviations = (thresholdPct: number = 15, minDurationMs: number = 10000): { faster: number; slower: number; total: number } => {
    if (sentences.length === 0) return { faster: 0, slower: 0, total: 0 };
    const avgWpm = getAverageSpeechRate();
    if (avgWpm === 0) return { faster: 0, slower: 0, total: 0 };
    const sentenceWpms = sentences.map(s => {
      const durationSec = (s.endTimeMs - s.startTimeMs) / 1000;
      if (durationSec <= 0) return avgWpm;
      const words = s.sentenceText.split(/\s+/).filter(Boolean).length;
      return (words / durationSec) * 60;
    });
    let fasterCount = 0;
    let slowerCount = 0;
    let runStartMs: number | null = null;
    let runDirection: 'faster' | 'slower' | null = null;
    for (let i = 0; i < sentences.length; i++) {
      const diff = sentenceWpms[i] - avgWpm;
      const pctDev = (Math.abs(diff) / avgWpm) * 100;
      const dir: 'faster' | 'slower' = diff >= 0 ? 'faster' : 'slower';
      if (pctDev >= thresholdPct && (runDirection === null || dir === runDirection)) {
        if (runStartMs === null) { runStartMs = sentences[i].startTimeMs; runDirection = dir; }
      } else {
        if (runStartMs !== null) {
          const runEndMs = sentences[i - 1].endTimeMs;
          if (runEndMs - runStartMs >= minDurationMs) {
            if (runDirection === 'faster') fasterCount++;
            else slowerCount++;
          }
          runStartMs = null;
          runDirection = null;
        }
        if (pctDev >= thresholdPct) { runStartMs = sentences[i].startTimeMs; runDirection = dir; }
      }
    }
    if (runStartMs !== null) {
      const runEndMs = sentences[sentences.length - 1].endTimeMs;
      if (runEndMs - runStartMs >= minDurationMs) {
        if (runDirection === 'faster') fasterCount++;
        else slowerCount++;
      }
    }
    return { faster: fasterCount, slower: slowerCount, total: fasterCount + slowerCount };
  };

  const getWpmTimelineData = (): { time: number; wpm: number; timeLabel: string }[] => {
    if (sentences.length === 0) return [];
    const paragraphs = groupIntoParagraphs(sentences);
    return paragraphs.map((p) => {
      const startMs = p[0].startTimeMs;
      const minutes = Math.floor(startMs / 60000);
      const seconds = Math.floor((startMs % 60000) / 1000);
      return {
        time: startMs,
        wpm: Math.round(calculateSpeechRate(p)),
        timeLabel: `${minutes}:${String(seconds).padStart(2, '0')}`
      };
    });
  };

  const getVolumeTimelineData = (): { time: number; volume: number; timeLabel: string }[] => {
    if (sentences.length === 0 || !sermon?.durationSeconds || waveformData.length === 0) return [];
    const paragraphs = groupIntoParagraphs(sentences);
    const totalDuration = sermon.durationSeconds * 1000;
    const baselineAverage = waveformData.reduce((sum, amp) => sum + amp, 0) / waveformData.length;
    return paragraphs.map((p) => {
      const startMs = p[0].startTimeMs;
      const endMs = p[p.length - 1].endTimeMs;
      const minutes = Math.floor(startMs / 60000);
      const seconds = Math.floor((startMs % 60000) / 1000);
      const startIdx = Math.floor((startMs / totalDuration) * waveformData.length);
      const endIdx = Math.ceil((endMs / totalDuration) * waveformData.length);
      const paragraphData = waveformData.slice(startIdx, endIdx);
      if (paragraphData.length === 0) {
        return { time: startMs, volume: 100, timeLabel: `${minutes}:${String(seconds).padStart(2, '0')}` };
      }
      const paragraphAverage = paragraphData.reduce((sum, amp) => sum + amp, 0) / paragraphData.length;
      const volumePercent = Math.round((paragraphAverage / baselineAverage) * 100);
      return { time: startMs, volume: volumePercent, timeLabel: `${minutes}:${String(seconds).padStart(2, '0')}` };
    });
  };

  const countVerbalPauses = (): number => {
    const fillerWords = {
      single: ['uh', 'um', 'like', 'so', 'well', 'okay', 'right', 'actually', 'basically',
               'literally', 'honestly', 'seriously', 'anyway', 'just', 'really', 'maybe',
               'perhaps', 'possibly', 'hmm', 'er', 'ah', 'oh'],
      phrases: ['you know', 'i mean', 'sort of', 'kind of', 'you know what i mean',
                'the thing is', 'at the end of the day', 'in a sense', 'to be honest',
                'if you will', 'so yeah', 'well you see', 'i guess', 'i suppose',
                'its like', 'i was gonna say', 'i think', 'i feel like', 'im not sure but',
                'uh-huh', 'mm-hmm']
    };
    let pauseCount = 0;
    sentences.forEach(sentence => {
      const text = sentence.sentenceText.toLowerCase();
      fillerWords.phrases.forEach(filler => {
        const regex = new RegExp(`\\b${filler.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) pauseCount += matches.length;
      });
      fillerWords.single.forEach(filler => {
        const regex = new RegExp(`\\b${filler}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) pauseCount += matches.length;
      });
    });
    return pauseCount;
  };

  const handleSaveTitle = async () => {
    if (!sermon) return;
    try {
      await updateTitleMutation({ sermonId, title: titleInput.trim() || "" });
      toast.success("Title updated", { description: "Sermon title has been saved" });
    } catch (error: unknown) {
      toast.error("Error", { description: "Failed to update title" });
    } finally {
      setEditingTitle(false);
    }
  };

  const getTopFillerWords = (): { word: string; count: number; color: string }[] => {
    const fillerWords = {
      single: ['uh', 'um', 'like', 'so', 'well', 'okay', 'right', 'actually', 'basically',
               'literally', 'honestly', 'seriously', 'anyway', 'just', 'really', 'maybe',
               'perhaps', 'possibly', 'hmm', 'er', 'ah', 'oh'],
      phrases: ['you know', 'i mean', 'sort of', 'kind of', 'you know what i mean',
                'the thing is', 'at the end of the day', 'in a sense', 'to be honest',
                'if you will', 'so yeah', 'well you see', 'i guess', 'i suppose',
                'its like', 'i was gonna say', 'i think', 'i feel like', 'im not sure but',
                'uh-huh', 'mm-hmm']
    };
    const colors = ['#f97316', '#fb923c', '#fdba74'];
    const wordCounts: { [key: string]: number } = {};
    sentences.forEach(sentence => {
      const text = sentence.sentenceText.toLowerCase();
      fillerWords.phrases.forEach(filler => {
        const regex = new RegExp(`\\b${filler.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) wordCounts[filler] = (wordCounts[filler] || 0) + matches.length;
      });
      fillerWords.single.forEach(filler => {
        const regex = new RegExp(`\\b${filler}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) wordCounts[filler] = (wordCounts[filler] || 0) + matches.length;
      });
    });
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry, idx) => ({ word: entry[0], count: entry[1], color: colors[idx] }));
  };

  const getAllFillerWords = (): { word: string; count: number }[] => {
    const fillerWords = {
      single: ['uh', 'um', 'like', 'so', 'well', 'okay', 'right', 'actually', 'basically',
               'literally', 'honestly', 'seriously', 'anyway', 'just', 'really', 'maybe',
               'perhaps', 'possibly', 'hmm', 'er', 'ah', 'oh'],
      phrases: ['you know', 'i mean', 'sort of', 'kind of', 'you know what i mean',
                'the thing is', 'at the end of the day', 'in a sense', 'to be honest',
                'if you will', 'so yeah', 'well you see', 'i guess', 'i suppose',
                'its like', 'i was gonna say', 'i think', 'i feel like', 'im not sure but',
                'uh-huh', 'mm-hmm']
    };
    const wordCounts: { [key: string]: number } = {};
    sentences.forEach(sentence => {
      const text = sentence.sentenceText.toLowerCase();
      fillerWords.phrases.forEach(filler => {
        const regex = new RegExp(`\\b${filler.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) wordCounts[filler] = (wordCounts[filler] || 0) + matches.length;
      });
      fillerWords.single.forEach(filler => {
        const regex = new RegExp(`\\b${filler}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) wordCounts[filler] = (wordCounts[filler] || 0) + matches.length;
      });
    });
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([word, count]) => ({ word, count }));
  };

  const getFillerWordTimestamps = (fillerWord: string): { start: number; end: number }[] => {
    const timestamps: { start: number; end: number }[] = [];
    sentences.forEach(sentence => {
      const text = sentence.sentenceText.toLowerCase();
      const regex = new RegExp(`\\b${fillerWord}\\b`, 'gi');
      if (regex.test(text)) {
        timestamps.push({ start: sentence.startTimeMs, end: sentence.endTimeMs });
      }
    });
    return timestamps;
  };

  const toggleFillerWord = (word: string) => {
    const newSet = new Set(visibleFillerWords);
    if (newSet.has(word)) newSet.delete(word);
    else newSet.add(word);
    setVisibleFillerWords(newSet);
  };

  const countSilentPauses = (minGapMs: number = 3000): number => getSilentPauseTimestamps(minGapMs).length;

  const getSilentPauseTimestamps = (minGapMs: number = 3000): { start: number; end: number; durationMs: number }[] => {
    if (waveformData.length === 0 || !sermon?.durationSeconds) return [];
    const totalDurationMs = sermon.durationSeconds * 1000;
    const msPerSample = totalDurationMs / waveformData.length;
    const silenceThreshold = 0.05;
    const pauses: { start: number; end: number; durationMs: number }[] = [];
    let silenceStart: number | null = null;
    for (let i = 0; i < waveformData.length; i++) {
      const isSilent = waveformData[i] < silenceThreshold;
      if (isSilent && silenceStart === null) {
        silenceStart = i * msPerSample;
      } else if (!isSilent && silenceStart !== null) {
        const silenceEnd = i * msPerSample;
        const duration = silenceEnd - silenceStart;
        if (duration >= minGapMs) pauses.push({ start: silenceStart, end: silenceEnd, durationMs: duration });
        silenceStart = null;
      }
    }
    return pauses;
  };

  const countInsiderLanguage = (): number => {
    const insiderTerms = {
      single: ['sanctification', 'justification', 'redemption', 'atonement', 'repentance',
               'trinity', 'gospel', 'salvation', 'saved', 'resurrection', 'discipleship',
               'covenant', 'righteousness', 'idolatry', 'pharisee', 'sadducee', 'propitiation',
               'disciple', 'apostle', 'shepherding', 'iniquity', 'transgression', 'missional',
               'elders', 'deacons', 'liturgy', 'narthex', 'vestibule', 'sanctuary', 'anointed',
               'revival', 'holiness', 'calvinist', 'arminian', 'eucharist', 'apologetics',
               'legalism', 'benediction', 'baptism'],
      phrases: ['quiet time', 'devotional time', 'prayer warrior', 'love offering', 'fellowship',
                'covered by the blood', 'hedge of protection', 'being led', 'i feel led',
                'doing life together', 'on fire for god', 'being called', 'baby christian',
                'mature christian', 'servant leadership', 'missional living', 'the church',
                'accountability partner', 'small group', 'community group', 'life group',
                'spiritual disciplines', 'worship time', 'church home', 'church family',
                'church plant', 'doing ministry', 'sin nature', 'spiritual gifts',
                'spiritual warfare', 'holy spirit', 'the spirit', 'born again', 'new birth',
                'altar call', "the lord's supper", 'passing the plate', 'worship leader',
                'sermon series', 'asking jesus into your heart', 'personal relationship with jesus',
                'lost people', 'the lost', 'reaching the unreached', 'the great commission',
                'spiritual attack', 'prayer covering', 'kingdom work', 'called to ministry',
                'faith step', 'prosperity gospel', 'fruit of the spirit', 'armor of god',
                'kingdom of heaven', 'kingdom of god', 'lamb of god', 'ministry team',
                'global partners', 'pastoral care', 'shepherding team', 'church polity',
                'praise and worship', 'praise & worship', 'worship experience', 'spirit moving',
                'worship night', 'vacation bible school', 'vbs', 'testimony', 'purity culture',
                'accountability group', 'contemporary christian music', 'ccm', 'we as christians']
    };
    let termCount = 0;
    sentences.forEach(sentence => {
      const text = sentence.sentenceText.toLowerCase();
      insiderTerms.phrases.forEach(term => {
        const regex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+').replace(/'/g, "\\'")}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) termCount += matches.length;
      });
      insiderTerms.single.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) termCount += matches.length;
      });
    });
    return termCount;
  };

  const getTopInsiderTerms = (): { word: string; count: number; color: string }[] => {
    const insiderTerms = {
      single: ['sanctification', 'justification', 'redemption', 'atonement', 'repentance',
               'trinity', 'gospel', 'salvation', 'saved', 'resurrection', 'discipleship',
               'covenant', 'righteousness', 'idolatry', 'pharisee', 'sadducee', 'propitiation',
               'disciple', 'apostle', 'shepherding', 'iniquity', 'transgression', 'missional',
               'elders', 'deacons', 'liturgy', 'narthex', 'vestibule', 'sanctuary', 'anointed',
               'revival', 'holiness', 'calvinist', 'arminian', 'eucharist', 'apologetics',
               'legalism', 'benediction', 'baptism'],
      phrases: ['quiet time', 'devotional time', 'prayer warrior', 'love offering', 'fellowship',
                'covered by the blood', 'hedge of protection', 'being led', 'i feel led',
                'doing life together', 'on fire for god', 'being called', 'baby christian',
                'mature christian', 'servant leadership', 'missional living', 'the church',
                'accountability partner', 'small group', 'community group', 'life group',
                'spiritual disciplines', 'worship time', 'church home', 'church family',
                'church plant', 'doing ministry', 'sin nature', 'spiritual gifts',
                'spiritual warfare', 'holy spirit', 'the spirit', 'born again', 'new birth',
                'altar call', "the lord's supper", 'passing the plate', 'worship leader',
                'sermon series', 'asking jesus into your heart', 'personal relationship with jesus',
                'lost people', 'the lost', 'reaching the unreached', 'the great commission',
                'spiritual attack', 'prayer covering', 'kingdom work', 'called to ministry',
                'faith step', 'prosperity gospel', 'fruit of the spirit', 'armor of god',
                'kingdom of heaven', 'kingdom of god', 'lamb of god', 'ministry team',
                'global partners', 'pastoral care', 'shepherding team', 'church polity',
                'praise and worship', 'praise & worship', 'worship experience', 'spirit moving',
                'worship night', 'vacation bible school', 'vbs', 'testimony', 'purity culture',
                'accountability group', 'contemporary christian music', 'ccm', 'we as christians']
    };
    const colors = ['#6366f1', '#818cf8', '#a5b4fc'];
    const termCounts: { [key: string]: number } = {};
    sentences.forEach(sentence => {
      const text = sentence.sentenceText.toLowerCase();
      insiderTerms.phrases.forEach(term => {
        const regex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+').replace(/'/g, "\\'")}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) termCounts[term] = (termCounts[term] || 0) + matches.length;
      });
      insiderTerms.single.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) termCounts[term] = (termCounts[term] || 0) + matches.length;
      });
    });
    return Object.entries(termCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry, idx) => ({ word: entry[0], count: entry[1], color: colors[idx] }));
  };

  const getAllInsiderTerms = (): { word: string; count: number }[] => {
    const insiderTerms = {
      single: ['sanctification', 'justification', 'redemption', 'atonement', 'repentance',
               'trinity', 'gospel', 'salvation', 'saved', 'resurrection', 'discipleship',
               'covenant', 'righteousness', 'idolatry', 'pharisee', 'sadducee', 'propitiation',
               'disciple', 'apostle', 'shepherding', 'iniquity', 'transgression', 'missional',
               'elders', 'deacons', 'liturgy', 'narthex', 'vestibule', 'sanctuary', 'anointed',
               'revival', 'holiness', 'calvinist', 'arminian', 'eucharist', 'apologetics',
               'legalism', 'benediction', 'baptism'],
      phrases: ['quiet time', 'devotional time', 'prayer warrior', 'love offering', 'fellowship',
                'covered by the blood', 'hedge of protection', 'being led', 'i feel led',
                'doing life together', 'on fire for god', 'being called', 'baby christian',
                'mature christian', 'servant leadership', 'missional living', 'the church',
                'accountability partner', 'small group', 'community group', 'life group',
                'spiritual disciplines', 'worship time', 'church home', 'church family',
                'church plant', 'doing ministry', 'sin nature', 'spiritual gifts',
                'spiritual warfare', 'holy spirit', 'the spirit', 'born again', 'new birth',
                'altar call', "the lord's supper", 'passing the plate', 'worship leader',
                'sermon series', 'asking jesus into your heart', 'personal relationship with jesus',
                'lost people', 'the lost', 'reaching the unreached', 'the great commission',
                'spiritual attack', 'prayer covering', 'kingdom work', 'called to ministry',
                'faith step', 'prosperity gospel', 'fruit of the spirit', 'armor of god',
                'kingdom of heaven', 'kingdom of god', 'lamb of god', 'ministry team',
                'global partners', 'pastoral care', 'shepherding team', 'church polity',
                'praise and worship', 'praise & worship', 'worship experience', 'spirit moving',
                'worship night', 'vacation bible school', 'vbs', 'testimony', 'purity culture',
                'accountability group', 'contemporary christian music', 'ccm', 'we as christians']
    };
    const termCounts: { [key: string]: number } = {};
    sentences.forEach(sentence => {
      const text = sentence.sentenceText.toLowerCase();
      insiderTerms.phrases.forEach(term => {
        const regex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+').replace(/'/g, "\\'")}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) termCounts[term] = (termCounts[term] || 0) + matches.length;
      });
      insiderTerms.single.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) termCounts[term] = (termCounts[term] || 0) + matches.length;
      });
    });
    return Object.entries(termCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([word, count]) => ({ word, count }));
  };

  const getInsiderTermTimestamps = (term: string): { start: number; end: number }[] => {
    const timestamps: { start: number; end: number }[] = [];
    sentences.forEach(sentence => {
      const text = sentence.sentenceText.toLowerCase();
      const regex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+').replace(/'/g, "\\'")}\\b`, 'gi');
      if (regex.test(text)) {
        timestamps.push({ start: sentence.startTimeMs, end: sentence.endTimeMs });
      }
    });
    return timestamps;
  };

  const toggleInsiderTerm = (term: string) => {
    const newSet = new Set(visibleInsiderTerms);
    if (newSet.has(term)) newSet.delete(term);
    else newSet.add(term);
    setVisibleInsiderTerms(newSet);
  };

  const getRepeatedPhrases = (minCount: number = 3): { word: string; count: number }[] => {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'is', 'it', 'its', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'shall', 'can', 'need', 'i', 'me', 'my',
      'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
      'their', 'what', 'which', 'who', 'this', 'that', 'these', 'those', 'am',
      'not', 'no', 'as', 'if', 'then', 'than', 'so', 'just',
      't', 's', 'd', 'm', 'll', 've', 're',
    ]);
    const allWords: string[] = [];
    sentences.forEach(sentence => {
      const words = sentence.sentenceText.toLowerCase().replace(/[^a-z'\s-]/g, '').split(/\s+/).filter(w => w.length > 0);
      words.forEach(w => {
        const cleaned = w.replace(/^'+|'+$/g, '');
        if (cleaned.length > 1) allWords.push(cleaned);
      });
    });
    const phraseCounts: Record<string, number> = {};
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i <= allWords.length - n; i++) {
        const phrase = allWords.slice(i, i + n);
        const meaningfulWords = phrase.filter(w => !stopWords.has(w));
        if (meaningfulWords.length < 1) continue;
        if (n === 2 && stopWords.has(phrase[0]) && stopWords.has(phrase[1])) continue;
        const key = phrase.join(' ');
        phraseCounts[key] = (phraseCounts[key] || 0) + 1;
      }
    }
    const entries = Object.entries(phraseCounts)
      .filter(([, count]) => count >= minCount)
      .sort((a, b) => b[1] - a[1]);
    const filtered: [string, number][] = [];
    for (const [phrase, count] of entries) {
      const isRedundant = filtered.some(([longer, longerCount]) =>
        longer.length > phrase.length && longer.includes(phrase) && longerCount >= count
      );
      if (!isRedundant) filtered.push([phrase, count]);
    }
    return filtered.map(([word, count]) => ({ word, count }));
  };

  // ===== ENGAGEMENT SCORING FUNCTIONS =====

  const scaleScore = (value: number, low: number, mid: number, high: number): number => {
    let score: number;
    if (value <= low) return 1;
    if (value >= high) return 10;
    if (value <= mid) score = 1 + ((value - low) / (mid - low)) * 4;
    else score = 5 + ((value - mid) / (high - mid)) * 5;
    return Math.round(Math.min(10, Math.max(1, score)));
  };

  const getPaceDynamicsScore = (): number => {
    if (sentences.length === 0) return 5;
    const avgWpm = getAverageSpeechRate();
    if (avgWpm === 0) return 5;
    const deviations25 = countSustainedDeviations(25);
    const deviations35 = countSustainedDeviations(35);
    const deviations45 = countSustainedDeviations(45);
    const lastSentence = sentences[sentences.length - 1];
    const durationMinutes = lastSentence.endTimeMs / 60000;
    if (durationMinutes <= 0) return 5;
    const targetDeviations = durationMinutes / 5;
    const freqRatio = targetDeviations > 0 ? Math.min(1, deviations25.total / targetDeviations) : 0;
    const frequencyScore = 1 + freqRatio * 9;
    let magnitudeScore = 1;
    if (deviations25.total > 0) {
      const ratio35 = deviations35.total / deviations25.total;
      const ratio45 = deviations45.total / deviations25.total;
      const mag35 = Math.min(1, ratio35 / 0.30);
      const mag45 = Math.min(1, ratio45 / 0.10);
      const magRatio = mag35 * 0.6 + mag45 * 0.4;
      magnitudeScore = 1 + magRatio * 9;
    }
    let varietyScore = 1;
    if (deviations25.total > 0) {
      const fasterFrac = deviations25.faster / deviations25.total;
      const balance = 1 - Math.abs(0.5 - fasterFrac) * 2;
      varietyScore = 1 + balance * 9;
    }
    const combined = frequencyScore * 0.4 + magnitudeScore * 0.3 + varietyScore * 0.3;
    return Math.round(Math.max(1, Math.min(10, combined)));
  };

  const getVolumeDynamicsScore = (): number => {
    if (sentences.length === 0 || waveformData.length === 0) return 5;
    if (!sermon?.durationSeconds) return 5;
    const deviations25 = countSustainedVolumeDeviations(25);
    const deviations35 = countSustainedVolumeDeviations(35);
    const deviations45 = countSustainedVolumeDeviations(45);
    const lastSentence = sentences[sentences.length - 1];
    const durationMinutes = lastSentence.endTimeMs / 60000;
    if (durationMinutes <= 0) return 5;
    const targetDeviations = durationMinutes / 5;
    const freqRatio = targetDeviations > 0 ? Math.min(1, deviations25.total / targetDeviations) : 0;
    const frequencyScore = 1 + freqRatio * 9;
    let magnitudeScore = 1;
    if (deviations25.total > 0) {
      const ratio35 = deviations35.total / deviations25.total;
      const ratio45 = deviations45.total / deviations25.total;
      const mag35 = Math.min(1, ratio35 / 0.30);
      const mag45 = Math.min(1, ratio45 / 0.10);
      const magRatio = mag35 * 0.6 + mag45 * 0.4;
      magnitudeScore = 1 + magRatio * 9;
    }
    let varietyScore = 1;
    if (deviations25.total > 0) {
      const louderFrac = deviations25.louder / deviations25.total;
      const balance = 1 - Math.abs(0.5 - louderFrac) * 2;
      varietyScore = 1 + balance * 9;
    }
    const combined = frequencyScore * 0.4 + magnitudeScore * 0.3 + varietyScore * 0.3;
    return Math.round(Math.max(1, Math.min(10, combined)));
  };

  const getUseOfSilenceScore = (): number => {
    if (sentences.length < 2) return 5;
    const pauseCount = countSilentPauses(3000);
    return Math.max(1, Math.min(10, pauseCount));
  };

  const getSentenceVarietyScore = (): number => {
    if (sentences.length < 3) return 5;
    const lengths = sentences.map(s => s.sentenceText.split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const stdDev = Math.sqrt(lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length);
    const cv = stdDev / avg;
    return scaleScore(cv, 0.45, 0.75, 1.1);
  };

  const getIllustrationScore = (): number => {
    if (!illustrationData) return 0;
    return illustrationData.illustration_score;
  };

  const getEmotionalResonanceScore = (): number => {
    if (!emotionalData) return 0;
    return emotionalData.overall_score;
  };

  const getEngagementScore = (): {
    total: number;
    hasPendingAiMetrics: boolean;
    subscores: { label: string; score: number; icon: string; loaded: boolean }[];
  } => {
    const paceDynamics = getPaceDynamicsScore();
    const volumeDynamics = getVolumeDynamicsScore();
    const useOfSilence = getUseOfSilenceScore();
    const illustrationScore = getIllustrationScore();
    const emotionalScore = getEmotionalResonanceScore();
    const subscores = [
      { label: "Pace Dynamics", score: paceDynamics, icon: "🎯", loaded: true },
      { label: "Volume Dynamics", score: volumeDynamics, icon: "🔊", loaded: true },
      { label: "Use of Silence", score: useOfSilence, icon: "🤫", loaded: true },
      { label: "Illustrations & Stories", score: illustrationScore, icon: "🎭", loaded: illustrationData !== null },
      { label: "Emotional Resonance", score: emotionalScore, icon: "❤️", loaded: emotionalData !== null },
    ];
    const scoresToAvg = subscores.filter((s) => s.loaded);
    const hasPendingAiMetrics = subscores.some(
      (s) => (s.label === "Illustrations & Stories" || s.label === "Emotional Resonance") && !s.loaded,
    );
    const total = scoresToAvg.length > 0
      ? Math.round(scoresToAvg.reduce((sum, s) => sum + s.score, 0) / scoresToAvg.length)
      : 5;
    return { total, hasPendingAiMetrics, subscores };
  };

  const [engagementExpanded, setEngagementExpanded] = useState(false);

  const countSlowSpeechParagraphs = (threshold: number = 0.75): number => {
    if (sentences.length === 0) return 0;
    const paragraphs = groupIntoParagraphs(sentences);
    const averageRate = getAverageSpeechRate();
    return paragraphs.filter(p => {
      const rate = calculateSpeechRate(p);
      return rate < averageRate * threshold;
    }).length;
  };

  const getSlowSpeechParagraphs = (threshold: number = 0.75) => {
    if (sentences.length === 0) return [];
    const paragraphs = groupIntoParagraphs(sentences);
    const averageRate = getAverageSpeechRate();
    return paragraphs.filter(p => {
      const rate = calculateSpeechRate(p);
      return rate < averageRate * threshold;
    });
  };

  const countVolumeChangeParagraphs = (): { [key: number]: number } => {
    if (sentences.length === 0 || !sermon?.durationSeconds || waveformData.length === 0) {
      return { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 };
    }
    const paragraphs = groupIntoParagraphs(sentences);
    const counts: { [key: number]: number } = { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 };
    const baselineAverage = waveformData.reduce((sum, val) => sum + val, 0) / waveformData.length;
    paragraphs.forEach(paragraph => {
      const firstSentence = paragraph[0];
      const lastSentence = paragraph[paragraph.length - 1];
      if (!firstSentence || !lastSentence) return;
      const startIndex = Math.floor((firstSentence.startTimeMs / 1000 / sermon.durationSeconds!) * waveformData.length);
      const endIndex = Math.ceil((lastSentence.endTimeMs / 1000 / sermon.durationSeconds!) * waveformData.length);
      if (startIndex >= waveformData.length || endIndex > waveformData.length) return;
      const paragraphData = waveformData.slice(startIndex, endIndex);
      if (paragraphData.length === 0) return;
      const paragraphAverage = paragraphData.reduce((sum, val) => sum + val, 0) / paragraphData.length;
      const volumeRatio = paragraphAverage / baselineAverage;
      if (volumeRatio >= 1.3) counts[2]++;
      else if (volumeRatio >= 1.15) counts[1]++;
      else if (volumeRatio <= 0.7) counts[-2]++;
      else if (volumeRatio <= 0.85) counts[-1]++;
      else counts[0]++;
    });
    return counts;
  };

  const countSustainedVolumeDeviations = (thresholdPct: number = 25): { louder: number; softer: number; total: number } => {
    if (sentences.length === 0 || !sermon?.durationSeconds || waveformData.length === 0) {
      return { louder: 0, softer: 0, total: 0 };
    }
    const paragraphs = groupIntoParagraphs(sentences);
    const baselineAverage = waveformData.reduce((sum, val) => sum + val, 0) / waveformData.length;
    if (baselineAverage === 0) return { louder: 0, softer: 0, total: 0 };
    let louder = 0;
    let softer = 0;
    paragraphs.forEach(paragraph => {
      const firstSentence = paragraph[0];
      const lastSentence = paragraph[paragraph.length - 1];
      if (!firstSentence || !lastSentence) return;
      const startIndex = Math.floor((firstSentence.startTimeMs / 1000 / sermon.durationSeconds!) * waveformData.length);
      const endIndex = Math.ceil((lastSentence.endTimeMs / 1000 / sermon.durationSeconds!) * waveformData.length);
      if (startIndex >= waveformData.length || endIndex > waveformData.length) return;
      const paragraphData = waveformData.slice(startIndex, endIndex);
      if (paragraphData.length === 0) return;
      const paragraphAverage = paragraphData.reduce((sum, val) => sum + val, 0) / paragraphData.length;
      const pctDev = ((paragraphAverage - baselineAverage) / baselineAverage) * 100;
      if (pctDev >= thresholdPct) louder++;
      else if (pctDev <= -thresholdPct) softer++;
    });
    return { louder, softer, total: louder + softer };
  };

  const getParagraphVolumeLevel = (paragraph: Sentence[]): number => {
    if (!sermon?.durationSeconds || waveformData.length === 0) return 0;
    const firstSentence = paragraph[0];
    const lastSentence = paragraph[paragraph.length - 1];
    const startIndex = Math.floor((firstSentence.startTimeMs / 1000 / sermon.durationSeconds) * waveformData.length);
    const endIndex = Math.ceil((lastSentence.endTimeMs / 1000 / sermon.durationSeconds) * waveformData.length);
    if (startIndex >= waveformData.length || endIndex > waveformData.length) return 0;
    const paragraphData = waveformData.slice(startIndex, endIndex);
    if (paragraphData.length === 0) return 0;
    const baselineAverage = waveformData.reduce((sum, val) => sum + val, 0) / waveformData.length;
    const paragraphAverage = paragraphData.reduce((sum, val) => sum + val, 0) / paragraphData.length;
    const volumeRatio = paragraphAverage / baselineAverage;
    if (volumeRatio >= 1.3) return 2;
    if (volumeRatio >= 1.15) return 1;
    if (volumeRatio <= 0.7) return -2;
    if (volumeRatio <= 0.85) return -1;
    return 0;
  };

  const getVolumeChangeParagraphs = () => {
    if (sentences.length === 0) return [];
    const paragraphs = groupIntoParagraphs(sentences);
    return paragraphs.filter(p => getParagraphVolumeLevel(p) !== 0);
  };

  // Build an expanded Set of scripture sentence indices that fills gaps
  const scriptureSentenceIndices = useMemo(() => {
    if (!scriptureRefs || scriptureRefs.length === 0) return new Set<number>();
    const raw = [...scriptureRefs.map(r => r.sentenceIndex)].sort((a, b) => a - b);
    const expanded = new Set(raw);
    for (let i = 0; i < raw.length - 1; i++) {
      const gap = raw[i + 1] - raw[i];
      if (gap <= 4) {
        for (let j = raw[i] + 1; j < raw[i + 1]; j++) expanded.add(j);
      }
    }
    return expanded;
  }, [scriptureRefs]);

  const scriptureTextFingerprints = useMemo(() => {
    if (scriptureSentenceIndices.size === 0 || sentences.length === 0) return new Set<string>();
    const fingerprints = new Set<string>();
    sentences.forEach((s, idx) => {
      if (scriptureSentenceIndices.has(idx)) {
        const fp = s.sentenceText.toLowerCase().replace(/[?.,!;:'"]/g, '').trim();
        if (fp.length > 20) fingerprints.add(fp);
      }
    });
    return fingerprints;
  }, [scriptureSentenceIndices, sentences]);

  const isSentenceInScripture = (sentenceText: string, sentenceIndex?: number): boolean => {
    if (!scriptureRefs || scriptureRefs.length === 0) return false;
    if (sentenceIndex !== undefined && scriptureSentenceIndices.size > 0) {
      if (scriptureSentenceIndices.has(sentenceIndex)) return true;
    }
    if (scriptureTextFingerprints.size > 0) {
      const fp = sentenceText.toLowerCase().replace(/[?.,!;:'"]/g, '').trim();
      if (fp.length > 20) {
        if (scriptureTextFingerprints.has(fp)) return true;
        for (const sfp of scriptureTextFingerprints) {
          if (fp.includes(sfp) || sfp.includes(fp)) return true;
          const fpWords = fp.split(/\s+/);
          const sfpWords = sfp.split(/\s+/);
          if (fpWords.length >= 5 && sfpWords.length >= 5) {
            const sfpSet = new Set(sfpWords);
            const overlap = fpWords.filter(w => sfpSet.has(w)).length;
            if (overlap / Math.min(fpWords.length, sfpWords.length) > 0.7) return true;
          }
        }
      }
    }
    const text = sentenceText.toLowerCase().trim();
    if (scriptureRefs.some(ref => text.includes(ref.reference.toLowerCase()))) return true;
    return false;
  };

  const paragraphContainsScripture = (paragraph: Sentence[]): boolean => {
    if (!scriptureRefs || !showScriptureRefs) return false;
    const paragraphText = paragraph.map(s => s.sentenceText).join(" ");
    return scriptureRefs.some(ref => {
      const contextWords = ref.context.split(' ').slice(0, 10).join(' ');
      return paragraphText.includes(contextWords) || paragraphText.includes(ref.reference);
    });
  };

  const groupIntoParagraphs = (sentences: Sentence[]) => {
    const paragraphs: Sentence[][] = [];
    let current: Sentence[] = [];
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
  };

  const isCurrentSentence = (sentence: Sentence) => {
    return currentTime >= sentence.startTimeMs && currentTime < sentence.endTimeMs;
  };

  const isCurrentParagraph = (paragraph: Sentence[]) => {
    const firstSentence = paragraph[0];
    const lastSentence = paragraph[paragraph.length - 1];
    return currentTime >= firstSentence.startTimeMs && currentTime < lastSentence.endTimeMs;
  };

  const seekTo = (timeMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timeMs / 1000;
      setCurrentTime(timeMs);
    }
  };

  const togglePlayPause = async () => {
    const commentAudio = commentAudioRef.current;
    if (commentAudio && playingCommentId) {
      if (commentAudio.paused) commentAudio.play().catch(() => {});
      else commentAudio.pause();
      return;
    }
    if (audioRef.current) {
      if (playing) audioRef.current.pause();
      else await playSermonAudio();
      if (playing) setPlaying(false);
    }
  };

  const handleTimeUpdate = async () => {
    if (audioRef.current) {
      const currentMs = audioRef.current.currentTime * 1000;
      const previousMs = lastTimeRef.current;
      lastTimeRef.current = currentMs;
      setCurrentTime(currentMs);
      if (previewWithComments && !audioRef.current.paused && !isPlayingCommentRef.current) {
        const audioComments = comments.filter(c => c.audioUrl);
        for (const comment of audioComments) {
          if (playedCommentIds.has(comment._id)) continue;
          const crossedOver = previousMs < comment.startTimeMs && currentMs >= comment.startTimeMs;
          const withinRange = currentMs >= comment.startTimeMs && currentMs < comment.startTimeMs + 500;
          if (crossedOver || withinRange) {
            setPlayedCommentIds(prev => new Set([...prev, comment._id]));
            audioRef.current!.pause();
            setPlayingCommentId(comment._id);
            const url = await resolveCommentAudioUrl(comment);
            if (url) {
              if (commentAudioRef.current) {
                try {
                  commentAudioRef.current.onended = null;
                  commentAudioRef.current.onerror = null;
                  commentAudioRef.current.pause();
                  commentAudioRef.current.removeAttribute('src');
                  commentAudioRef.current.load();
                } catch (e) {}
                commentAudioRef.current = null;
              }
              const audio = new Audio(url);
              audio.volume = commentVolume;
              audio.playbackRate = playbackRate;
              fixWebmDuration(audio);
              commentAudioRef.current = audio;
              let handled = false;
              const cleanup = () => {
                if (handled) return;
                handled = true;
                setPlayingCommentId(null);
                commentAudioRef.current = null;
                if (audioRef.current) void playSermonAudio();
              };
              audio.onended = cleanup;
              audio.onerror = (e) => {
                const mediaError = (audio as HTMLAudioElement).error;
                if (mediaError && mediaError.code !== MediaError.MEDIA_ERR_ABORTED) {
                  console.error('Error playing comment audio:', mediaError.message);
                  cleanup();
                }
              };
              try {
                await audio.play();
              } catch (err: unknown) {
                const error = err as Error;
                if (error.name !== 'AbortError') {
                  console.error('Failed to play comment:', err);
                  cleanup();
                }
              }
            } else {
              setPlayingCommentId(null);
              if (audioRef.current) await playSermonAudio();
            }
            break;
          }
        }
      }
    }
  };

  const stopCommentAudio = () => {
    if (commentAudioRef.current) {
      commentAudioRef.current.onended = null;
      commentAudioRef.current.onerror = null;
      commentAudioRef.current.pause();
      commentAudioRef.current.removeAttribute('src');
      commentAudioRef.current.load();
      commentAudioRef.current = null;
    }
    setPlayingCommentId(null);
  };

  const fixWebmDuration = (audio: HTMLAudioElement) => {
    const onLoaded = () => {
      if (!isFinite(audio.duration)) {
        const onTimeUpdate = () => {
          audio.removeEventListener('timeupdate', onTimeUpdate);
          try { audio.currentTime = 0; } catch { /* noop */ }
        };
        audio.addEventListener('timeupdate', onTimeUpdate);
        try { audio.currentTime = 1e101; } catch { /* noop */ }
      }
    };
    audio.addEventListener('loadedmetadata', onLoaded, { once: true });
  };

  const handleSeeked = () => {
    stopCommentAudio();
    if (audioRef.current) {
      const currentMs = audioRef.current.currentTime * 1000;
      setPlayedCommentIds(prev => {
        const newSet = new Set<string>();
        prev.forEach(id => {
          const comment = comments.find(c => c._id === id);
          if (comment && comment.startTimeMs < currentMs) newSet.add(id);
        });
        return newSet;
      });
      lastTimeRef.current = currentMs;
    }
  };

  const preAcquireStream = () => {
    if (preAcquiredStream && preAcquiredStream.active) return;
    const audioConstraints: MediaTrackConstraints = {
      ...(selectedDeviceId ? { deviceId: { ideal: selectedDeviceId } } : {}),
      sampleRate: 44100,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
    };
    navigator.mediaDevices.getUserMedia({ audio: audioConstraints }).then(stream => {
      setPreAcquiredStream(stream);
    }).catch(e => {
      console.error('Failed to pre-acquire mic stream:', e);
      setPreAcquiredStream(undefined);
    });
  };

  const handleAudioPause = () => {
    setPlaying(false);
    stopCommentAudio();
  };

  const openCommentDialog = (start: number, end: number) => {
    setSelectedTimeRange({ start, end });
    if (!preAcquiredStream || !preAcquiredStream.active) {
      setPreAcquiredStream(null);
      preAcquireStream();
    }
    setCommentDialogOpen(true);
  };

  // Resolve comment audio URL (stored as audioUrl in Convex)
  const resolveCommentAudioUrl = async (comment: Comment): Promise<string | null> => {
    if (!comment.audioUrl) return null;
    const cachedUrl = commentSignedUrls[comment._id];
    if (cachedUrl) return cachedUrl;
    // audioUrl is a direct URL in Convex (stored in Convex storage or external)
    const resolvedUrl = comment.audioUrl;
    if (resolvedUrl) {
      setCommentSignedUrls((prev) => ({ ...prev, [comment._id]: resolvedUrl }));
    }
    return resolvedUrl;
  };

  const handleAutoSaveAudioComment = async (blob: Blob) => {
    if (!selectedTimeRange) return;
    try {
      if (!user?.id) throw new Error("Not authenticated");
      setTranscribing(true);
      // TODO: transcribe-audio-comment edge function stub
      const commentText = "Audio comment";
      // TODO: upload audio to Convex storage
      await addCommentMutation({
        sermonId,
        commentText,
        startTimeMs: selectedTimeRange.start,
        endTimeMs: selectedTimeRange.end,
      });
      toast.success("Audio comment saved");
      setCommentDialogOpen(false);
      setAudioBlob(null);
      if (preAcquiredStream) {
        preAcquiredStream.getTracks().forEach(t => t.stop());
        setPreAcquiredStream(undefined);
      }
      const nextSentence = sentences.find(s => s.startTimeMs > selectedTimeRange.start);
      if (nextSentence && audioRef.current) {
        audioRef.current.currentTime = nextSentence.startTimeMs / 1000;
        lastTimeRef.current = nextSentence.startTimeMs;
      }
    } catch (error: unknown) {
      toast.error("Error saving audio comment", { description: (error as Error).message });
    } finally {
      setTranscribing(false);
    }
  };

  const handleAddComment = async () => {
    if ((!newComment.trim() && !audioBlob) || !selectedTimeRange) return;
    try {
      if (!user?.id) throw new Error("Not authenticated");
      let commentText = newComment;
      if (audioBlob) {
        setTranscribing(true);
        // TODO: transcribe-audio-comment stub
        commentText = "Audio comment";
        setTranscribing(false);
      }
      await addCommentMutation({
        sermonId,
        commentText,
        startTimeMs: selectedTimeRange.start,
        endTimeMs: selectedTimeRange.end,
      });
      toast.success("Comment added successfully");
      setCommentDialogOpen(false);
      setNewComment("");
      setAudioBlob(null);
      if (audioBlob) {
        const nextSentence = sentences.find(s => s.startTimeMs > selectedTimeRange.start);
        if (nextSentence && audioRef.current) {
          audioRef.current.currentTime = nextSentence.startTimeMs / 1000;
          lastTimeRef.current = nextSentence.startTimeMs;
        }
      }
    } catch (error: unknown) {
      setTranscribing(false);
      toast.error("Error adding comment", { description: (error as Error).message });
    }
  };

  const handlePreviewParagraph = async (paragraphIndex: number) => {
    const paragraph = groupIntoParagraphs(sentences)[paragraphIndex];
    if (!paragraph || !audioRef.current) return;
    const firstSentence = paragraph[0];
    const lastSentence = paragraph[paragraph.length - 1];
    setPreviewingParagraph(paragraphIndex);
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
    const paragraphComments = comments.filter(
      c => c.audioUrl && c.startTimeMs >= firstSentence.startTimeMs && c.endTimeMs <= lastSentence.endTimeMs
    ).sort((a, b) => a.startTimeMs - b.startTimeMs);
    if (paragraphComments.length === 0) {
      audioRef.current.currentTime = firstSentence.startTimeMs / 1000;
      audioRef.current.play();
      setPlaying(true);
      const checkEnd = setInterval(() => {
        if (audioRef.current && audioRef.current.currentTime * 1000 >= lastSentence.endTimeMs) {
          audioRef.current.pause();
          setPlaying(false);
          setPreviewingParagraph(null);
          clearInterval(checkEnd);
        }
      }, 100);
      return;
    }
    try {
      const paragraphStart = firstSentence.startTimeMs / 1000;
      const paragraphEnd = lastSentence.endTimeMs / 1000;
      const playSermonSegment = (startTime: number, endTime: number): Promise<void> => {
        return new Promise((resolve) => {
          if (!audioRef.current) { resolve(); return; }
          audioRef.current.pause();
          audioRef.current.currentTime = startTime;
          const playPromise = audioRef.current.play();
          setPlaying(true);
          const checkEnd = setInterval(() => {
            if (!audioRef.current || audioRef.current.currentTime >= endTime) {
              if (audioRef.current) audioRef.current.pause();
              setPlaying(false);
              clearInterval(checkEnd);
              resolve();
            }
          }, 50);
          playPromise?.catch(() => { clearInterval(checkEnd); setPlaying(false); resolve(); });
        });
      };
      const playCommentAudio = async (comment: Comment): Promise<void> => {
        if (audioRef.current) { audioRef.current.pause(); setPlaying(false); }
        return new Promise(async (resolve) => {
          const resolvedUrl = await resolveCommentAudioUrl(comment);
          if (!resolvedUrl) { resolve(); return; }
          const audio = new Audio(resolvedUrl);
          audio.playbackRate = playbackRate;
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          try { await audio.play(); } catch (error) { resolve(); }
        });
      };
      let currentTimeLocal = paragraphStart;
      for (const comment of paragraphComments) {
        if (!comment.audioUrl) continue;
        const commentStart = comment.startTimeMs / 1000;
        if (commentStart > currentTimeLocal) {
          await playSermonSegment(currentTimeLocal, commentStart);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        if (audioRef.current) { audioRef.current.pause(); setPlaying(false); }
        await playCommentAudio(comment);
        await new Promise(resolve => setTimeout(resolve, 300));
        currentTimeLocal = Math.max(currentTimeLocal, commentStart + 0.001);
      }
      if (currentTimeLocal < paragraphEnd) await playSermonSegment(currentTimeLocal, paragraphEnd);
      setPreviewingParagraph(null);
    } catch (error: unknown) {
      console.error("Preview error:", error);
      toast.error("Preview failed", { description: (error as Error).message });
      setPreviewingParagraph(null);
    }
  };

  const handleExportAudio = async () => {
    if (!sermon || !audioUrl) {
      toast.error("Error", { description: "Sermon audio not loaded" });
      return;
    }
    setCombiningAudio(true);
    setCombineProgress(0);
    setCombineStatus("Starting...");
    try {
      const audioComments: { url: string; timestamp: number }[] = [];
      for (const comment of comments.filter(c => c.audioUrl)) {
        const resolvedUrl = await resolveCommentAudioUrl(comment);
        if (resolvedUrl) audioComments.push({ url: resolvedUrl, timestamp: comment.startTimeMs });
      }
      if (audioComments.length === 0) throw new Error("No audio comments found");
      const combinedBlob = await combineAudioFiles(
        audioUrl,
        audioComments,
        (progress, status) => { setCombineProgress(progress); setCombineStatus(status); }
      );
      const url = URL.createObjectURL(combinedBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sermon.title || 'sermon'}_combined.mp3`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Success", { description: "Combined audio downloaded successfully" });
    } catch (error: unknown) {
      console.error("Export error:", error);
      toast.error("Export failed", { description: (error as Error).message });
    } finally {
      setCombiningAudio(false);
      setCombineProgress(0);
      setCombineStatus("");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteCommentMutation({ commentId: commentId as Id<"sermonComments"> });
      toast.success("Comment deleted");
    } catch (error: unknown) {
      toast.error("Error deleting comment", { description: (error as Error).message });
    }
  };

  const [transcribingCommentId, setTranscribingCommentId] = useState<string | null>(null);

  const handleTranscribeComment = async (comment: Comment) => {
    if (!comment.audioUrl) return;
    setTranscribingCommentId(comment._id);
    // TODO: transcribe-audio-comment stub
    toast.info("Audio transcription requires edge function configuration (TODO).");
    setTranscribingCommentId(null);
  };

  const getCommentsForRange = (start: number, end: number) => {
    return comments.filter((c) => {
      if (c.startTimeMs === 0 && c.endTimeMs === 0) return false;
      if (hideAIEvalComments && c.ruleId) return false;
      if (c.ruleId && hiddenRuleIds.has(c.ruleId)) return false;
      if (hideMyComments && !c.ruleId && !/^\s*\[AI Coach\]/i.test(c.commentText || "")) return false;
      return c.startTimeMs >= start && c.startTimeMs < end;
    });
  };

  const handleExport = async (format: string) => {
    // TODO: export-sermon stub
    toast.info("Export requires edge function configuration (TODO).");
  };

  const handleExportReport = async () => {
    // TODO: generate-sermon-report stub
    toast.info("Report export requires edge function configuration (TODO).");
  };

  const captureChartElement = async (key: "wpm" | "volume"): Promise<string | null> => {
    const el = document.querySelector<HTMLElement>(`[data-export-chart="${key}"]`);
    if (!el) return null;
    const prevPadding = el.style.paddingBottom;
    try {
      el.style.paddingBottom = "32px";
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--background")
          ? `hsl(${getComputedStyle(document.documentElement).getPropertyValue("--background").trim()})`
          : "#ffffff",
        cacheBust: true,
      });
      return dataUrl;
    } catch (err) {
      console.warn(`Chart capture failed for ${key}`, err);
      return null;
    } finally {
      el.style.paddingBottom = prevPadding;
    }
  };

  const handleExportClientPdf = async () => {
    if (!sermon) return;
    setExporting(true);
    try {
      const totalWords = sentences.reduce(
        (sum: number, s: Sentence) => sum + s.sentenceText.split(/\s+/).filter(Boolean).length,
        0,
      );
      const congQuestions = sentences.filter((s: Sentence, idx: number) => {
        if (!s.sentenceText.trim().endsWith("?")) return false;
        if (congregationQuestionIndices && !congregationQuestionIndices.has(idx)) return false;
        return true;
      }).length;
      const engagement = getEngagementScore();
      const aiComments = comments.filter((c: Comment) => c.ruleId);
      const ruleMap = new Map<string, { ruleName: string; ruleColor?: string | null; items: { startMs: number; text: string }[] }>();
      for (const c of aiComments) {
        const rule = rules.find((r) => r._id === c.ruleId);
        const key = rule?._id || "unknown";
        if (!ruleMap.has(key)) {
          ruleMap.set(key, { ruleName: rule?.name || "Unnamed Rule", ruleColor: rule?.color, items: [] });
        }
        ruleMap.get(key)!.items.push({ startMs: c.startTimeMs, text: c.commentText });
      }
      const grouped = Array.from(ruleMap.values()).map((g) => ({
        ...g,
        items: g.items.sort((a, b) => a.startMs - b.startMs),
      }));
      const data: ClientReportData = {
        sermonTitle: sermon.title || "Untitled Sermon",
        sermonDate: new Date(Date.now()).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
        durationSeconds: sermon.durationSeconds ?? null,
        communicatorName: null,
        engagement: {
          total: engagement.total,
          subscores: engagement.subscores.map((s) => ({ label: s.label, score: s.score })),
        },
        metrics: {
          averageWPM: Math.round(getAverageSpeechRate()),
          wordCount: totalWords,
          fastSpeechCount: countFastSpeechParagraphs(fastSpeechThreshold),
          fastSpeechThreshold,
          slowSpeechCount: countSlowSpeechParagraphs(slowSpeechThreshold),
          slowSpeechThreshold,
          verbalPausesCount: countVerbalPauses(),
          insiderLanguageCount: countInsiderLanguage(),
          congregationQuestions: congQuestions,
          illustrationScore: illustrationData?.illustration_score ?? 0,
          emotionalResonanceScore: emotionalData?.overall_score ?? 0,
        },
        topFillerWords: getTopFillerWords().map((f) => ({ word: f.word, count: f.count })),
        topInsiderTerms: getTopInsiderTerms().map((t) => ({ word: t.word, count: t.count })),
        repeatedPhrases: getRepeatedPhrases(3).slice(0, 8),
        scriptureRefs: scriptureRefs?.map((r: ScriptureRef) => ({
          reference: r.reference,
          context: r.context,
        })) || [],
        wpmSeries: getWpmTimelineData().map((d) => ({ timeMs: d.time, value: d.wpm })),
        volumeSeries: getVolumeTimelineData().map((d) => ({ timeMs: d.time, value: d.volume })),
        averageWPM: Math.round(getAverageSpeechRate()),
        wpmChartImage: await captureChartElement('wpm'),
        volumeChartImage: await captureChartElement('volume'),
        visitorConfusion: (confusingPhrases || []).map((p: ConfusingPhrase) => ({
          severity: (p.severity as "mild" | "moderate" | "severe") || "mild",
          phrase: p.phrase,
          startMs: p.startTimeMs,
          reason: "",
          suggestion: p.suggestion,
        })),
        aiComments: grouped,
      };
      const blob = await generateClientReportPdf(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeTitle = (sermon.title || "sermon").replace(/[^\w\d-]+/g, "-").slice(0, 60);
      a.href = url;
      a.download = `${safeTitle}-client-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Client report downloaded");
    } catch (error: unknown) {
      console.error("Client PDF export error:", error);
      toast.error("Export failed", { description: (error as Error).message });
    } finally {
      setExporting(false);
    }
  };

  // Keep ref in sync with playingCommentId state
  useEffect(() => {
    isPlayingCommentRef.current = playingCommentId !== null;
    if (playingCommentId && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [playingCommentId]);

  const handleSummarizeComments = async () => {
    if (comments.length === 0) {
      toast.error("No comments to summarize", { description: "Add some comments first before generating a summary" });
      return;
    }
    // TODO: summarize-comments stub
    toast.info("Comment summary requires edge function configuration (TODO).");
  };

  const AI_COACH_TAG = "[AI Coach]";

  const handleGenerateCoachComments = async () => {
    if (!sermonId) return;
    if (!sentences || sentences.length === 0) {
      toast.error("Transcript not ready", { description: "The sermon must finish transcription before AI Coach can review it." });
      return;
    }
    setCoachLoading(true);
    setCoachOpen(true);
    // TODO: ai-coach-comments stub
    toast.info("AI Coach requires edge function configuration (TODO).");
    setCoachLoading(false);
  };

  const handleApplyCoachComments = async () => {
    if (!sermonId || !coachNotes || coachNotes.length === 0) return;
    setCoachApplying(true);
    try {
      if (!user?.id) throw new Error("Not signed in");
      for (const n of coachNotes) {
        await addCommentMutation({
          sermonId,
          commentText: `${AI_COACH_TAG}${n.category ? ` (${n.category})` : ""} ${n.comment_text}`,
          startTimeMs: n.start_time_ms,
          endTimeMs: n.end_time_ms,
        });
      }
      toast.success("Applied to timeline", { description: `Inserted ${coachNotes.length} comment${coachNotes.length === 1 ? "" : "s"}.` });
      setCoachNotes(null);
    } catch (err: unknown) {
      toast.error("Could not apply", { description: (err as Error)?.message || "Insertion failed." });
    } finally {
      setCoachApplying(false);
    }
  };

  const handleRegenerateCoachAudio = async () => {
    // TODO: tts-clone-comment stub
    toast.info("Voice regeneration requires ElevenLabs configuration (TODO).");
  };

  const handleDeleteAllCoachComments = async () => {
    if (!sermonId) return;
    setCoachDeleting(true);
    try {
      const coachComments = comments.filter(c => /^\s*\[AI Coach\]/i.test(c.commentText || ""));
      for (const c of coachComments) {
        await deleteCommentMutation({ commentId: c._id });
      }
      toast.success("AI Coach comments removed", { description: "All AI-generated comments on this sermon were deleted." });
    } catch (err: unknown) {
      toast.error("Delete failed", { description: (err as Error)?.message || "Could not delete AI Coach comments." });
    } finally {
      setCoachDeleting(false);
    }
  };

  if (loading || sermon === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!sermon) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Sermon not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container py-8 animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                  />
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>
          {/* Part 2, 3, 4 will fill in the rest */}
        </div>
      </div>
    </div>
  );
}
