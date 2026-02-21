"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  createResume,
  updateResume,
  deleteResume,
  updateResumeCategories,
  setDefaultResume,
} from "@/app/actions/resume";
import { JOB_CATEGORIES } from "@/constants/categories";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  Upload,
  ClipboardPaste,
  CheckCircle2,
  Brain,
  Tags,
  Star,
} from "lucide-react";

interface ResumeWithStats {
  id: string;
  name: string;
  fileName: string | null;
  fileUrl: string | null;
  fileType: string | null;
  content: string | null;
  isDefault: boolean;
  userId: string;
  createdAt: string;
  applicationCount: number;
  targetCategories?: string[];
}

interface ResumeListProps {
  resumes: ResumeWithStats[];
}

export function ResumeList({ resumes }: ResumeListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contentDialogId, setContentDialogId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [categoryDialogId, setCategoryDialogId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handlePdfUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name || file.name.replace(/\.pdf$/i, ""));
      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Resume uploaded. Extracted ${data.resume.detectedSkills?.length || 0} skills.`,
        );
        setDialogOpen(false);
        setName("");
        setFileUrl("");
        setContent("");
        router.refresh();
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    }
    setUploading(false);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const result = await createResume(name, fileUrl, content);
        if (!result.success) { toast.error(result.error || "Failed to create"); return; }
        toast.success("Resume added");
        setDialogOpen(false);
        setName("");
        setFileUrl("");
        setContent("");
        router.refresh();
      } catch {
        toast.error("Failed to create resume");
      }
    });
  };

  const handleUpdate = (id: string) => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const result = await updateResume(id, { name, fileUrl });
        if (!result.success) { toast.error(result.error || "Failed to update"); return; }
        toast.success("Resume updated");
        setEditingId(null);
        setName("");
        setFileUrl("");
        router.refresh();
      } catch {
        toast.error("Failed to update resume");
      }
    });
  };

  const handleSaveContent = (id: string) => {
    startTransition(async () => {
      try {
        const result = await updateResume(id, { content });
        if (!result.success) { toast.error(result.error || "Failed to save content"); return; }
        toast.success(
          "Resume content saved -- scraper will use this for matching",
        );
        setContentDialogId(null);
        setContent("");
        router.refresh();
      } catch {
        toast.error("Failed to save content");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const result = await deleteResume(id);
        if (!result.success) { toast.error(result.error || "Failed to delete"); return; }
        toast.success("Resume deleted");
        router.refresh();
      } catch {
        toast.error("Failed to delete resume");
      }
    });
  };

  const openCategoryDialog = (r: ResumeWithStats) => {
    setCategoryDialogId(r.id);
    setSelectedCategories(r.targetCategories ?? []);
  };

  const handleSaveCategories = () => {
    if (!categoryDialogId) return;
    startTransition(async () => {
      try {
        const result = await updateResumeCategories(categoryDialogId, selectedCategories);
        if (!result.success) { toast.error(result.error || "Failed to update categories"); return; }
        toast.success("Categories updated");
        setCategoryDialogId(null);
        router.refresh();
      } catch {
        toast.error("Failed to update categories");
      }
    });
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      try {
        const result = await setDefaultResume(id);
        if (!result.success) { toast.error(result.error || "Failed to set default"); return; }
        toast.success("Default resume updated");
        router.refresh();
      } catch {
        toast.error("Failed to set default resume");
      }
    });
  };

  const openEdit = (r: ResumeWithStats) => {
    setEditingId(r.id);
    setName(r.name);
    setFileUrl(r.fileUrl ?? "");
  };

  const openContentDialog = (r: ResumeWithStats) => {
    setContentDialogId(r.id);
    setContent(r.content ?? "");
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-3 ring-1 ring-indigo-100/50 dark:ring-indigo-800/30">
        <div className="flex items-start gap-2">
          <Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              Smart Resume Matching
            </p>
            <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5 leading-relaxed">
              Paste your resume text into each variant. The scraper reads it to
              match jobs and recommend the best resume per job. Without content,
              matching falls back to resume name keywords only.
            </p>
          </div>
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shadow-md">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Resume
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Resume Variant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Full-Stack"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  File URL (Google Drive / Dropbox)
                </Label>
                <Input
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Upload PDF (auto-extracts text for matching)
                </Label>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 px-3 py-3 cursor-pointer transition-colors">
                    <Upload className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      Choose PDF file...
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePdfUpload(f);
                      }}
                    />
                  </label>
                </div>
                {uploading && (
                  <p
                    className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    aria-live="polite"
                  >
                    <Loader2 className="h-3 w-3 animate-spin" /> Parsing
                    PDF&hellip;
                  </p>
                )}
              </div>
              <div className="relative flex items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-zinc-700" />
                <span className="flex-shrink mx-3 text-[10px] text-slate-400 dark:text-zinc-500">
                  OR paste text
                </span>
                <div className="flex-grow border-t border-slate-200 dark:border-zinc-700" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Resume Content (paste your resume text)
                </Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your full resume text here... The system uses this to intelligently match jobs and recommend this resume when relevant skills are found in job descriptions."
                  rows={6}
                  className="resize-none text-xs"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={isPending || uploading || !name.trim()}
                className="w-full"
              >
                {isPending && (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                )}
                Add Resume
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content paste dialog */}
      <Dialog
        open={contentDialogId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setContentDialogId(null);
            setContent("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Paste Resume Content
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Paste your full resume text below. The automation reads this to
              match your skills against job descriptions and recommend this
              resume for relevant positions.
            </p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                "MUHAMMAD ALI SHAHID\nFull-Stack Developer\n\nSKILLS\nReact, Node.js, TypeScript, Next.js, NestJS, PostgreSQL, MongoDB, Docker, AWS, Git\n\nEXPERIENCE\nFull-Stack Developer at XYZ Corp (2023-Present)\n- Built REST APIs with NestJS and PostgreSQL\n- Developed frontend with Next.js and Tailwind CSS\n...\n\nEDUCATION\nBS Computer Science - University of Punjab (2019-2023)"
              }
              rows={12}
              className="resize-none text-xs font-mono"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setContentDialogId(null);
                  setContent("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  contentDialogId && handleSaveContent(contentDialogId)
                }
                disabled={isPending}
              >
                {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Save Content
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category mapper dialog */}
      <Dialog
        open={categoryDialogId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCategoryDialogId(null);
            setSelectedCategories([]);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Assign Job Categories
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Select which job categories this resume targets. The matcher will
            prefer this resume for jobs in these categories.
          </p>
          <div className="grid grid-cols-1 gap-1.5 pt-2">
            {JOB_CATEGORIES.map((cat) => (
              <label
                key={cat}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer text-xs transition-colors ${
                  selectedCategories.includes(cat)
                    ? "bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-200 dark:ring-indigo-700 text-indigo-700 dark:text-indigo-300 font-medium"
                    : "hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-400"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {cat}
              </label>
            ))}
          </div>
          <div className="flex justify-between items-center pt-3">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
              {selectedCategories.length} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCategoryDialogId(null);
                  setSelectedCategories([]);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveCategories}
                disabled={isPending}
              >
                {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Save Categories
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resume grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {resumes.map((r) => (
          <div
            key={r.id}
            className="relative overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-200/60 dark:ring-zinc-700/50 space-y-3 transition-all hover:shadow-md dark:hover:shadow-zinc-900/50 hover:-translate-y-0.5"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 to-blue-500" />

            {editingId === r.id ? (
              <div className="space-y-3">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  className="h-9"
                />
                <Input
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="File URL"
                  className="h-9"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleUpdate(r.id)}
                    disabled={isPending}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30 ring-1 ring-indigo-200/50 dark:ring-indigo-700/50">
                      <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                        {r.name}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                        Added {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => openEdit(r)}
                      aria-label="Edit resume categories"
                    >
                      <Pencil className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                          aria-label="Delete resume"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete &quot;{r.name}&quot;?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will unlink this resume from all associated
                            jobs.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(r.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold rounded-md"
                  >
                    {r.applicationCount} applications
                  </Badge>
                  {r.isDefault && (
                    <Badge className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0">
                      Default
                    </Badge>
                  )}
                  {r.content ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Content added
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      No content
                    </span>
                  )}
                </div>

                {(r.targetCategories ?? []).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {(r.targetCategories ?? []).slice(0, 3).map((cat) => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                      >
                        {cat}
                      </Badge>
                    ))}
                    {(r.targetCategories ?? []).length > 3 && (
                      <span className="text-[9px] text-slate-400 dark:text-zinc-500">
                        +{(r.targetCategories ?? []).length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() => openContentDialog(r)}
                  >
                    <ClipboardPaste className="h-3 w-3 mr-1" />
                    {r.content ? "Edit Content" : "Paste Resume"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() => openCategoryDialog(r)}
                  >
                    <Tags className="h-3 w-3 mr-1" />
                    Categories
                  </Button>
                  {!r.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] px-2"
                      onClick={() => handleSetDefault(r.id)}
                      disabled={isPending}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Set Default
                    </Button>
                  )}
                  {r.fileUrl && (
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View file
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {resumes.length === 0 && (
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-10 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-200/60 dark:ring-zinc-700/50 text-center">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 to-blue-500" />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-700 mx-auto mb-3">
            <FileText className="h-6 w-6 text-slate-300 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
            No resumes yet
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
            Add your first resume variant to enable smart matching.
          </p>
        </div>
      )}
    </div>
  );
}
