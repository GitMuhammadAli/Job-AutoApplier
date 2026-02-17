"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
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
import { FileText, Plus, Pencil, Trash2, ExternalLink, Loader2, TrendingUp } from "lucide-react";

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
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Resume
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Resume Variant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Full-Stack" />
              </div>
              <div className="space-y-2">
                <Label>File URL (Google Drive / Dropbox)</Label>
                <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
              </div>
              <Button onClick={handleCreate} disabled={isPending || !name.trim()} className="w-full">
                {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Add Resume
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resume grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {resumes.map((r) => (
          <Card key={r.id} className="p-4 rounded-xl border-0 shadow-sm space-y-3">
            {editingId === r.id ? (
              <div className="space-y-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
                <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="File URL" />
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
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-indigo-50 p-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{r.name}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500">
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
                          <AlertDialogAction onClick={() => handleDelete(r.id)} className="bg-red-600">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    {r.jobCount} jobs
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <TrendingUp className="h-3 w-3" />
                    {r.responseRate}% response
                  </div>
                </div>
                {r.fileUrl && (
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View file
                  </a>
                )}
              </>
            )}
          </Card>
        ))}
      </div>

      {resumes.length === 0 && (
        <Card className="p-8 rounded-xl border-0 shadow-sm text-center">
          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No resumes yet. Add your first resume variant.</p>
        </Card>
      )}
    </div>
  );
}
