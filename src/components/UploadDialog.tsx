"use client";

import { useState, useCallback } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  communicatorId?: Id<"communicators">;
}

export const UploadDialog = ({
  open,
  onOpenChange,
  onUploadComplete,
  communicatorId,
}: UploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"file" | "url">("file");
  const [isDragging, setIsDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);


  const generateUploadUrl = useMutation(api.sermons.generateUploadUrl);
  const createSermon = useMutation(api.sermons.create);
  const extractAndCreate = useAction(api.youtube.extractAndCreate);

  const isVideoFile = (f: File): boolean => {
    const videoExts = /\.(mp4|webm|mkv|m4v)$/i;
    const videoTypes = ["video/mp4", "video/webm", "video/x-matroska", "video/x-m4v"];
    return videoExts.test(f.name) || videoTypes.includes(f.type) || f.type.startsWith("video/");
  };

  const validateFile = useCallback((selectedFile: File): boolean => {
    const maxSize = 300 * 1024 * 1024; // 300MB
    const validAudioExt = /\.(mp3|wav|m4a)$/i.test(selectedFile.name);
    const validAudioType = ["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4"].includes(selectedFile.type);
    const validVideo = isVideoFile(selectedFile);

    if (!validAudioExt && !validAudioType && !validVideo) {
      toast.error("Please upload an audio file (MP3, WAV, M4A) or video file (MP4, MOV, WebM)");
      return false;
    }
    if (selectedFile.size > maxSize) {
      toast.error("Maximum file size is 300MB");
      return false;
    }
    return true;
  }, []);

  const extractAudioFromVideo = useCallback(async (videoFile: File): Promise<Blob> => {
    const arrayBuffer = await videoFile.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Render to offline context as WAV
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const rendered = await offlineCtx.startRendering();
    await audioCtx.close();

    // Encode to WAV
    const numChannels = rendered.numberOfChannels;
    const sampleRate = rendered.sampleRate;
    const length = rendered.length;
    const buffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * numChannels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * numChannels * 2, true);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, rendered.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([buffer], { type: "audio/wav" });
  }, []);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
        setActiveTab("file");
      }
    },
    [title, validateFile]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) handleFileSelect(dropped);
    },
    [handleFileSelect]
  );

  const handleFileUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      // If video, extract audio first
      let uploadFile: Blob = file;
      let uploadContentType = file.type || "audio/mpeg";
      if (isVideoFile(file)) {
        setExtracting(true);
        toast.info("Extracting audio from video...");
        try {
          uploadFile = await extractAudioFromVideo(file);
          uploadContentType = "audio/wav";
        } finally {
          setExtracting(false);
        }
      }

      // 1. Get upload URL from Convex storage
      const uploadUrl = await generateUploadUrl();

      // 2. Upload file directly to Convex storage
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": uploadContentType },
        body: uploadFile,
      });
      if (!res.ok) throw new Error(`Storage upload failed: ${res.statusText}`);
      const { storageId } = await res.json();

      // 3. Create sermon record + schedule transcription
      await createSermon({
        title: title.trim() || file.name.replace(/\.[^/.]+$/, ""),
        fileId: storageId,
        fileType: "audio",
        communicatorId: communicatorId,
      });

      toast.success("Uploaded — transcription starting");
      onUploadComplete();
      onOpenChange(false);
      setFile(null);
      setTitle("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlUpload = async () => {
    if (!url.trim()) return;
    setUploading(true);
    try {
      // Download via API route, then create sermon record
      const res = await fetch("/api/upload-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), title: title.trim(), communicatorId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");

      toast.success("Downloaded — transcription starting");
      onUploadComplete();
      onOpenChange(false);
      setUrl("");
      setTitle("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "URL upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleYoutubeUpload = async (ytUrl?: string) => {
    const target = (ytUrl ?? url).trim();
    if (!target) return;
    setUploading(true);
    try {
      toast.info("Extracting audio from YouTube — this may take a minute...");
      await extractAndCreate({
        youtubeUrl: target,
        title: title.trim() || undefined,
        communicatorId,
      });
      toast.success("Extracted — transcription starting");
      onUploadComplete();
      onOpenChange(false);
      setUrl("");
      setTitle("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "YouTube extraction failed");
    } finally {
      setUploading(false);
    }
  };

  const isYoutubeUrl = (u: string) =>
    /(?:youtube\.com\/watch|youtu\.be\/)/i.test(u);

  const isSubsplashUrl = (u: string) =>
    /(?:subspla\.sh\/[a-z0-9]+|\/media\/[a-z0-9]{5,10}(?:\/|$)|subsplash\.com\/)/i.test(u);

  const handleUpload = () => {
    if (activeTab === "file") handleFileUpload();
    else if (isYoutubeUrl(url) || isSubsplashUrl(url)) handleYoutubeUpload();
    else handleUrlUpload();
  };

  const canUpload = activeTab === "file" ? !!file : !!url.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(v: boolean) => {
        if (!uploading) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Sermon</DialogTitle>
          <DialogDescription>
            Upload an audio file or provide a URL to transcribe
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Sermon Title (optional)</Label>
            <Input
              id="title"
              placeholder="Sunday Service - John 3:16"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as "file" | "url")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">
                <Upload className="mr-2 h-4 w-4" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="url">
                <Link className="mr-2 h-4 w-4" />
                From URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-2">
              <Label htmlFor="file">Audio or Video File</Label>
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50",
                  file && "border-primary/50 bg-primary/5"
                )}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".mp3,.wav,.m4a,.mp4,.webm,.mkv,.m4v,audio/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center text-center">
                  <Upload
                    className={cn(
                      "h-8 w-8 mb-2",
                      isDragging ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {file ? (
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">
                        {isDragging ? "Drop your file here" : "Drag & drop or click to upload"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        MP3, WAV, M4A or video (MP4, WebM, MKV) — max 300MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-2">
              <Label htmlFor="audio-url">URL</Label>
              <Input
                id="audio-url"
                type="url"
                placeholder="YouTube link or direct audio URL (MP3, WAV, M4A)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                {url && /(?:youtube\.com\/watch|youtu\.be\/)/i.test(url)
                  ? "✓ YouTube detected — audio will be extracted automatically"
                  : url && /(?:subspla\.sh\/[a-z0-9]+|\/media\/[a-z0-9]{5,10}(?:\/|$)|subsplash\.com\/)/i.test(url)
                  ? "✓ Subsplash detected — audio will be extracted automatically"
                  : "Paste a YouTube link, Subsplash link, or direct audio URL"}
              </p>
            </TabsContent>
          </Tabs>

          <Button
            onClick={handleUpload}
            disabled={!canUpload || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {activeTab === "url" && (/(?:youtube\.com\/watch|youtu\.be\/)/i.test(url) || /(?:subspla\.sh\/[a-z0-9]+|\/media\/[a-z0-9]{5,10}(?:\/|$)|subsplash\.com\/)/i.test(url)) ? "Extracting audio..." : activeTab === "url" ? "Downloading..." : extracting ? "Extracting audio..." : "Uploading..."}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload and Transcribe
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
