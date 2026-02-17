"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createResume, updateResume, deleteResume } from "@/app/actions/resume";
import { FileText, Plus, Pencil, Trash2, ExternalLink, Loader2, TrendingUp, Sparkles } from "lucide-react";

interface ResumeWithStats {
  id: string;
  name: string;
  fileUrl: string | null;
  userId: string;
  createdAt: string;
  jobCount: number;
  responseRate: number;
}

interface ResumeListProps {
  resumes: ResumeWithStats[];
}

export function ResumeList({ resumes }: ResumeListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createResume(name, fileUrl);
        toast.success("Resume added");
        setDialogOpen(false);
        setName("");
        setFileUrl("");
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Failed to create");
      }
    });
  };

  const handleUpdate = (id: string) => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await updateResume(id, { name, fileUrl });
        toast.success("Resume updated");
        setEditingId(null);
        setName("");
        setFileUrl("");
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Failed to update");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteResume(id);
        toast.success("Resume deleted");
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete");
      }
    });
  };

  const openEdit = (r: ResumeWithStats) => {
    setEditingId(r.id);
    setName(r.name);
    setFileUrl(r.fileUrl ?? "");
  };

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shadow-md">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Resume
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Resume Variant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Full-Stack" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">File URL (Google Drive / Dropbox)</Label>
                <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." className="h-9" />
              </div>
              <Button onClick={handleCreate} disabled={isPending || !name.trim()} className="w-full">
                {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Add Resume
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resume grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {resumes.map((r, idx) => (
          <div
            key={r.id}
            className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 space-y-3 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            {/* Top accent */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 to-blue-500" />

            {editingId === r.id ? (
              <div className="space-y-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-9" />
                <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="File URL" className="h-9" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUpdate(r.id)} disabled={isPending}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 ring-1 ring-indigo-200/50">
                      <FileText className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{r.name}</p>
                      <p className="text-[10px] text-slate-400">
                        Added {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEdit(r)}>
                      <Pencil className="h-3 w-3 text-slate-400" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete &quot;{r.name}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will unlink this resume from all associated jobs.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(r.id)} className="bg-red-600 hover:bg-red-700">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-[10px] font-semibold rounded-md">
                    {r.jobCount} jobs
                  </Badge>
                  <div className="flex items-center gap-1 text-[11px] font-medium">
                    <TrendingUp className={`h-3 w-3 ${r.responseRate > 0 ? "text-emerald-500" : "text-slate-400"}`} />
                    <span className={r.responseRate > 0 ? "text-emerald-600" : "text-slate-500"}>
                      {r.responseRate}% response
                    </span>
                  </div>
                </div>

                {r.fileUrl && (
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View file
                  </a>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {resumes.length === 0 && (
        <div className="relative overflow-hidden rounded-xl bg-white p-10 shadow-sm ring-1 ring-slate-200/60 text-center">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 to-blue-500" />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 mx-auto mb-3">
            <FileText className="h-6 w-6 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-600">No resumes yet</p>
          <p className="text-xs text-slate-400 mt-1">Add your first resume variant to enable smart recommendations.</p>
        </div>
      )}
    </div>
  );
}
