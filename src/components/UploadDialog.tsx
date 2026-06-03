"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
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

  const generateUploadUrl = useMutation(api.sermons.generateUploadUrl);
  const createSermon = useMutation(api.sermons.create);

  const validateFile = useCallback((selectedFile: File): boolean => {
    const maxSize = 300 * 1024 * 1024; // 300MB
    const validExt = /\.(mp3|wav|m4a)$/i.test(selectedFile.name);
    const validType = ["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4"].includes(
      selectedFile.type
    );

    if (!validExt && !validType) {
      toast.error("Please upload an MP3, WAV, or M4A file");
      return false;
    }
    if (selectedFile.size > maxSize) {
      toast.error("Maximum file size is 300MB");
      return false;
    }
    return true;
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
      // 1. Get upload URL from Convex storage
      const uploadUrl = await generateUploadUrl();

      // 2. Upload file directly to Convex storage
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "audio/mpeg" },
        body: file,
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

  const handleUpload = () => {
    if (activeTab === "file") handleFileUpload();
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
              <Label htmlFor="file">Audio File</Label>
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
                  accept=".mp3,.wav,.m4a,audio/*"
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
                        MP3, WAV, or M4A (max 300MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-2">
              <Label htmlFor="audio-url">Audio URL</Label>
              <Input
                id="audio-url"
                type="url"
                placeholder="https://example.com/sermon.mp3"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Paste a direct audio link (MP3, WAV, M4A)
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
                {activeTab === "url" ? "Downloading..." : "Uploading..."}
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
