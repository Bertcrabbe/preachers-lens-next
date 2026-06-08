"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload, FileText, Clock, Loader2, ListChecks, Pencil, Check, X,
  FolderOpen, ArrowLeft, Plus, Trash2, ChevronDown,
} from "lucide-react";
import { UploadDialog } from "@/components/UploadDialog";
import { toast } from "sonner";
import Link from "next/link";

type Communicator = {
  _id: Id<"communicators">;
  name: string;
  userId: string;
};

type Sermon = {
  _id: Id<"sermons">;
  userId: string;
  title?: string;
  fileType: string;
  transcriptionStatus: string;
  errorMessage?: string;
  durationSeconds?: number;
  communicatorId?: Id<"communicators">;
  createdAt?: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const sermons = useQuery(api.sermons.list) ?? [];
  const communicators = useQuery(api.communicators.list) ?? [];

  const updateTitle = useMutation(api.sermons.updateTitle);
  const assignCommunicator = useMutation(api.sermons.assignCommunicator);
  const deleteSermon = useMutation(api.sermons.remove);
  const createCommunicator = useMutation(api.communicators.create);
  const updateCommunicatorName = useMutation(api.communicators.updateName);
  const deleteCommunicator = useMutation(api.communicators.remove);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedCommunicator, setSelectedCommunicator] = useState<Communicator | { _id: "unassigned"; name: string } | null>(null);

  const [editingSermonId, setEditingSermonId] = useState<Id<"sermons"> | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const [editingCommId, setEditingCommId] = useState<Id<"communicators"> | null>(null);
  const [editingCommName, setEditingCommName] = useState("");

  const [newCommOpen, setNewCommOpen] = useState(false);
  const [newCommName, setNewCommName] = useState("");

  const [deleteSermonTarget, setDeleteSermonTarget] = useState<Sermon | null>(null);
  const [deleteCommTarget, setDeleteCommTarget] = useState<Communicator | null>(null);
  const [deleting, setDeleting] = useState(false);

  const unassignedSermons = sermons.filter((s) => !s.communicatorId);

  const getStatusBadge = (status: string, sermonId?: string) => {
    if (status === "completed") return <Badge variant="default" className="cursor-pointer hover:opacity-80" onClick={() => router.push(`/dashboard/sermon/${sermonId}`)}>Transcript <Check className="ml-1 h-3 w-3" /></Badge>;
    if (status === "processing") return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Processing</Badge>;
    if (status === "error") return <Badge variant="destructive">Error</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSaveTitle = async (sermonId: Id<"sermons">) => {
    try {
      await updateTitle({ sermonId, title: editingTitle.trim() });
      toast.success("Title saved");
    } catch {
      toast.error("Failed to update title");
    }
    setEditingSermonId(null);
  };

  const handleSaveCommName = async (id: Id<"communicators">) => {
    try {
      await updateCommunicatorName({ communicatorId: id, name: editingCommName });
      if (selectedCommunicator && selectedCommunicator._id === id) {
        setSelectedCommunicator({ ...selectedCommunicator, name: editingCommName });
      }
      toast.success("Name saved");
    } catch {
      toast.error("Failed to update name");
    }
    setEditingCommId(null);
  };

  const handleCreateCommunicator = async () => {
    if (!newCommName.trim()) return;
    try {
      await createCommunicator({ name: newCommName });
      setNewCommName("");
      setNewCommOpen(false);
      toast.success("Communicator created");
    } catch {
      toast.error("Failed to create communicator");
    }
  };

  const handleDeleteSermon = async () => {
    if (!deleteSermonTarget) return;
    setDeleting(true);
    try {
      await deleteSermon({ sermonId: deleteSermonTarget._id });
      toast.success("Sermon deleted");
    } catch {
      toast.error("Failed to delete sermon");
    } finally {
      setDeleting(false);
      setDeleteSermonTarget(null);
    }
  };

  const handleDeleteCommunicator = async () => {
    if (!deleteCommTarget) return;
    setDeleting(true);
    try {
      await deleteCommunicator({ communicatorId: deleteCommTarget._id });
      if (selectedCommunicator?._id === deleteCommTarget._id) setSelectedCommunicator(null);
      toast.success("Communicator deleted");
    } catch {
      toast.error("Failed to delete communicator");
    } finally {
      setDeleting(false);
      setDeleteCommTarget(null);
    }
  };

  const sermonCard = (sermon: Sermon) => {
    const currentComm = communicators.find((c) => c._id === sermon.communicatorId);
    return (
      <Card key={sermon._id} className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            {editingSermonId === sermon._id ? (
              <div className="flex items-center gap-1 flex-1 mr-2">
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle(sermon._id);
                    if (e.key === "Escape") setEditingSermonId(null);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSaveTitle(sermon._id)}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingSermonId(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group">
                <CardTitle className="text-lg cursor-pointer hover:underline" onClick={() => router.push(`/dashboard/sermon/${sermon._id}`)}>{sermon.title || "Untitled Sermon"}</CardTitle>
                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={() => { setEditingSermonId(sermon._id); setEditingTitle(sermon.title || ""); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
            {getStatusBadge(sermon.transcriptionStatus, sermon._id)}
          </div>
          <CardDescription>
            <span className="flex items-center gap-1 text-sm">
              <Clock className="h-3 w-3" />
              {formatDuration(sermon.durationSeconds)}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {sermon.createdAt ? new Date(sermon.createdAt).toLocaleDateString() : ""}
              </p>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteSermonTarget(sermon)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {currentComm?.name || "Unassigned"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {communicators.map((c) => (
                  <DropdownMenuItem key={c._id}
                    className={sermon.communicatorId === c._id ? "bg-accent" : ""}
                    onClick={() => assignCommunicator({ sermonId: sermon._id, communicatorId: c._id })}>
                    {c.name}
                  </DropdownMenuItem>
                ))}
                {communicators.length > 0 && sermon.communicatorId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => assignCommunicator({ sermonId: sermon._id, communicatorId: undefined })}>
                      Remove from folder
                    </DropdownMenuItem>
                  </>
                )}
                {communicators.length === 0 && <DropdownMenuItem disabled>No folders yet</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  const folderView = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {unassignedSermons.length > 0 && (
        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-dashed md:col-span-2 lg:col-span-3"
          onClick={() => setSelectedCommunicator({ _id: "unassigned", name: "Unassigned" })}>
          <CardHeader className="py-10">
            <div className="flex items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">Recently Uploaded and Unassigned Sermons</CardTitle>
                <CardDescription className="text-base mt-1">
                  {unassignedSermons.length} {unassignedSermons.length === 1 ? "sermon" : "sermons"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {communicators.map((c) => {
        const count = sermons.filter((s) => s.communicatorId === c._id).length;
        return (
          <Card key={c._id} className="cursor-pointer hover:shadow-lg transition-shadow group"
            onClick={() => setSelectedCommunicator(c)}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    {editingCommId === c._id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input value={editingCommName} onChange={(e) => setEditingCommName(e.target.value)}
                          className="h-8 text-sm w-40" autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveCommName(c._id);
                            if (e.key === "Escape") setEditingCommId(null);
                          }} />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleSaveCommName(c._id); }}><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingCommId(null); }}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <CardTitle className="text-lg">{c.name}</CardTitle>
                    )}
                    <CardDescription>{count} {count === 1 ? "sermon" : "sermons"}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setEditingCommId(c._id); setEditingCommName(c.name); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setDeleteCommTarget(c); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        );
      })}

      <Card className="cursor-pointer hover:shadow-lg transition-shadow border-dashed"
        onClick={() => setNewCommOpen(true)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg text-muted-foreground">Add Communicator</CardTitle>
              <CardDescription>Create a new folder</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );

  const communicatorSermons = () => {
    const isUnassigned = selectedCommunicator?._id === "unassigned";
    const sermonsToShow = isUnassigned
      ? unassignedSermons
      : sermons.filter((s) => s.communicatorId === selectedCommunicator?._id);

    return (
      <>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedCommunicator(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
            <div>
              {!isUnassigned && editingCommId === selectedCommunicator?._id ? (
                <div className="flex items-center gap-1">
                  <Input value={editingCommName} onChange={(e) => setEditingCommName(e.target.value)}
                    className="h-9 text-lg font-bold w-48" autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveCommName(selectedCommunicator!._id as Id<"communicators">);
                      if (e.key === "Escape") setEditingCommId(null);
                    }} />
                  <Button size="icon" variant="ghost" onClick={() => handleSaveCommName(selectedCommunicator!._id as Id<"communicators">)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingCommId(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h2 className="text-2xl font-bold">{selectedCommunicator?.name}</h2>
                  {!isUnassigned && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => { setEditingCommId(selectedCommunicator!._id as Id<"communicators">); setEditingCommName(selectedCommunicator!.name); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              <p className="text-muted-foreground">{sermonsToShow.length} {sermonsToShow.length === 1 ? "sermon" : "sermons"}</p>
            </div>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />Upload Sermon
          </Button>
        </div>

        {sermonsToShow.length === 0 ? (
          <Card>
            <CardContent className="pt-8 pb-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No sermons yet</h3>
              <p className="text-muted-foreground mb-4">Upload a sermon for {selectedCommunicator?.name}</p>
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />Upload Sermon
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sermonsToShow.map(sermonCard)}
          </div>
        )}
      </>
    );
  };

  return (
    <div>
      <main className="container mx-auto px-4 pt-8 pb-8">
        {selectedCommunicator ? (
          communicatorSermons()
        ) : (
          <>
            <div className="flex justify-center mb-10">
              <Button size="lg" onClick={() => setUploadOpen(true)}
                className="h-20 px-14 text-2xl rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                <Upload className="h-8 w-8 mr-3" />Upload a Sermon
              </Button>
            </div>

            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Communicators</h2>
                <p className="text-muted-foreground">Organize sermons by speaker</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href="/dashboard/rules">
                    <ListChecks className="mr-2 h-4 w-4" />Evaluation Rules
                  </Link>
                </Button>
              </div>
            </div>

            {sermons === undefined ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : communicators.length === 0 && unassignedSermons.length === 0 ? (
              <Card>
                <CardContent className="pt-8 pb-12 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No communicators yet</h3>
                  <p className="text-muted-foreground mb-4">Create a folder for each speaker</p>
                  <Button onClick={() => setNewCommOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />Add Communicator
                  </Button>
                </CardContent>
              </Card>
            ) : folderView()}
          </>
        )}
      </main>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={() => {}}
        communicatorId={
          selectedCommunicator && selectedCommunicator._id !== "unassigned"
            ? (selectedCommunicator._id as Id<"communicators">)
            : undefined
        }
      />

      {/* New communicator dialog */}
      <Dialog open={newCommOpen} onOpenChange={setNewCommOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Communicator</DialogTitle>
            <DialogDescription>Create a folder to organize sermons by speaker</DialogDescription>
          </DialogHeader>
          <Input placeholder="Communicator name" value={newCommName}
            onChange={(e) => setNewCommName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateCommunicator(); }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCommOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCommunicator} disabled={!newCommName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete sermon */}
      <AlertDialog open={!!deleteSermonTarget} onOpenChange={(v: boolean) => { if (!v) setDeleteSermonTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sermon?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteSermonTarget?.title || "Untitled Sermon"}&quot; and all its data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSermon} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete communicator */}
      <AlertDialog open={!!deleteCommTarget} onOpenChange={(v: boolean) => { if (!v) setDeleteCommTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteCommTarget?.name}&quot; will be deleted. Sermons will be moved to Unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCommunicator} disabled={deleting}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
