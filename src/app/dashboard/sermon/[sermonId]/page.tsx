"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Play, Pause, MessageSquare, Trash2, Highlighter,
  Loader2, Clock, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const HIGHLIGHT_COLOR = "#fef08a"; // yellow

export default function SermonViewerPage() {
  const params = useParams();
  const router = useRouter();
  const sermonId = params.sermonId as Id<"sermons">;

  const sermon = useQuery(api.sermons.get, { sermonId });
  const sentences = useQuery(api.sermons.getSentences, { sermonId }) ?? [];
  const comments = useQuery(api.sermons.getComments, { sermonId }) ?? [];
  const highlights = useQuery(api.sermons.getHighlights, { sermonId }) ?? [];
  const rules = useQuery(api.evaluationRules.list) ?? [];

  const addComment = useMutation(api.sermons.addComment);
  const deleteComment = useMutation(api.sermons.deleteComment);
  const toggleHighlight = useMutation(api.sermons.toggleHighlight);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const activeSentenceRef = useRef<HTMLDivElement>(null);

  // Comment state
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; sentenceIdx: number } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);

  // Audio URL — handle both Convex storage (fileId) and migrated Supabase URLs (fileUrl)
  const storageUrl = useQuery(
    api.sermons.getStorageUrl,
    sermon?.fileId ? { storageId: sermon.fileId } : "skip"
  );
  const audioUrl = sermon?.fileId ? storageUrl : sermon?.fileUrl;

  // Sort sentences
  const sortedSentences = [...sentences].sort((a, b) => a.orderIndex - b.orderIndex);

  // Build highlight index
  const highlightSet = new Set(highlights.map((h) => h.sentenceIndex));

  // Build comment index (sentence -> comments)
  const commentsBySentence: Record<number, typeof comments> = {};
  for (const c of comments) {
    const sent = sortedSentences.findIndex(
      (s) => s.startTimeMs <= c.startTimeMs && s.endTimeMs >= c.endTimeMs
    );
    if (sent >= 0) {
      if (!commentsBySentence[sent]) commentsBySentence[sent] = [];
      commentsBySentence[sent].push(c);
    }
  }

  // Current sentence index based on audio time
  const currentMs = currentTime * 1000;
  const activeSentenceIdx = sortedSentences.findIndex(
    (s) => s.startTimeMs <= currentMs && s.endTimeMs > currentMs
  );

  // Auto-scroll to active sentence
  useEffect(() => {
    if (activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSentenceIdx]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  }, []);

  const seekTo = (ms: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = ms / 1000;
      setCurrentTime(ms / 1000);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSentenceClick = (sentence: typeof sortedSentences[0], idx: number) => {
    if (highlightMode) {
      toggleHighlight({ sermonId, sentenceIndex: idx, color: HIGHLIGHT_COLOR });
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{sermon.title || "Untitled Sermon"}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            {sermon.durationSeconds ? formatTime(sermon.durationSeconds) : "—"}
            <span>·</span>
            <span>{sortedSentences.length} sentences</span>
            <span>·</span>
            <span>{comments.length} comments</span>
          </div>
        </div>
        <Button
          variant={highlightMode ? "default" : "outline"}
          size="sm"
          onClick={() => setHighlightMode(!highlightMode)}
        >
          <Highlighter className="h-4 w-4 mr-2" />
          {highlightMode ? "Highlighting" : "Highlight"}
        </Button>
      </div>

      {/* Audio player */}
      {audioUrl && (
        <div className="bg-card border rounded-xl p-4 mb-6 flex items-center gap-4">
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <Button size="icon" onClick={togglePlay} className="h-10 w-10 shrink-0">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <div className="flex-1 flex items-center gap-3">
            <span className="text-sm tabular-nums text-muted-foreground w-12">{formatTime(currentTime)}</span>
            <div
              className="flex-1 h-2 bg-muted rounded-full cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                if (audioRef.current) {
                  audioRef.current.currentTime = pct * duration;
                }
              }}
            >
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
              />
              {/* Comment markers */}
              {comments.map((c, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500 rounded-full -ml-1 cursor-pointer"
                  style={{ left: duration ? `${(c.startTimeMs / 1000 / duration) * 100}%` : "0%" }}
                  onClick={(e) => { e.stopPropagation(); seekTo(c.startTimeMs); }}
                  title={c.commentText}
                />
              ))}
            </div>
            <span className="text-sm tabular-nums text-muted-foreground w-12 text-right">{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Comment box */}
      {showCommentBox && selectedRange && (
        <div className="bg-card border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                Comment at {formatTime(selectedRange.start / 1000)}
              </span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setShowCommentBox(false); setSelectedRange(null); setCommentText(""); }}>
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
            <Button variant="outline" size="sm" onClick={() => { setShowCommentBox(false); setCommentText(""); }}>Cancel</Button>
            <Button size="sm" onClick={handleSaveComment} disabled={!commentText.trim() || savingComment}>
              {savingComment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Comment
            </Button>
          </div>
        </div>
      )}

      {/* Transcript */}
      {sortedSentences.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {sermon.transcriptionStatus === "processing" ? (
            <><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" /><p>Transcribing...</p></>
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
            const isHighlighted = highlightSet.has(idx);
            const sentComments = commentsBySentence[idx] ?? [];
            const isSelected = selectedRange?.sentenceIdx === idx;

            return (
              <div
                key={sentence._id}
                ref={isActive ? activeSentenceRef : null}
              >
                <div
                  className={cn(
                    "px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-base leading-relaxed group",
                    isActive && "bg-primary/15 font-medium",
                    isHighlighted && !isActive && "bg-yellow-100 dark:bg-yellow-900/30",
                    isSelected && "ring-2 ring-primary",
                    !isActive && !isHighlighted && "hover:bg-muted/60",
                    highlightMode && "hover:bg-yellow-100/70 dark:hover:bg-yellow-900/20",
                  )}
                  onClick={() => handleSentenceClick(sentence, idx)}
                >
                  <span className="text-xs text-muted-foreground mr-2 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(sentence.startTimeMs / 1000)}
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
                      <div key={c._id} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 group">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm leading-relaxed">{c.commentText}</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); handleDeleteComment(c._id); }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        {c.audioUrl && (
                          <audio controls src={c.audioUrl} className="mt-2 h-8 w-full" />
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(c.startTimeMs / 1000)} – {formatTime(c.endTimeMs / 1000)}
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
    </div>
  );
}
