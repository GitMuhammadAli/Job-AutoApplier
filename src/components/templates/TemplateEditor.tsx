"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@/app/actions/email-template";
import { Star, Plus, Save, Trash2, Pencil } from "lucide-react";

const PLACEHOLDER_CHIPS = [
  "{{company}}",
  "{{position}}",
  "{{name}}",
  "{{location}}",
  "{{salary}}",
] as const;

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
};

interface TemplateEditorProps {
  templates: EmailTemplate[];
}

export function TemplateEditor({ templates: initialTemplates }: TemplateEditorProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  useEffect(() => {
    setTemplates(initialTemplates);
  }, [initialTemplates]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<"name" | "subject" | "body" | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const editing = editingId ? templates.find((t) => t.id === editingId) : null;

  const insertPlaceholder = useCallback(
    (placeholder: string) => {
      const el =
        focusedField === "name"
          ? nameRef.current
          : focusedField === "subject"
            ? subjectRef.current
            : focusedField === "body"
              ? bodyRef.current
              : null;
      if (el) {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const val = el.value;
        const newVal = val.slice(0, start) + placeholder + val.slice(end);
        if ("value" in el) (el as HTMLInputElement | HTMLTextAreaElement).value = newVal;
        el.setSelectionRange(start + placeholder.length, start + placeholder.length);
        el.focus();
      }
    },
    [focusedField]
  );

  const handleSave = async () => {
    if (!editing) return;
    const name = nameRef.current?.value?.trim();
    const subject = subjectRef.current?.value?.trim();
    const body = bodyRef.current?.value?.trim();
    if (!name || !subject || !body) {
      toast.error("Name, subject, and body are required");
      return;
    }
    setSaving(true);
    try {
      await updateEmailTemplate(editing.id, { name, subject, body });
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editing.id ? { ...t, name, subject, body } : t
        )
      );
      setEditingId(null);
      router.refresh();
      toast.success("Template updated");
    } catch {
      toast.error("Failed to update template");
    }
    setSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t || t.isDefault) return;
    setSaving(true);
    try {
      await updateEmailTemplate(id, { isDefault: true });
      setTemplates((prev) =>
        prev.map((x) => ({
          ...x,
          isDefault: x.id === id,
        }))
      );
      router.refresh();
      toast.success("Default template updated");
    } catch {
      toast.error("Failed to set default");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteEmailTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (editingId === id) setEditingId(null);
      router.refresh();
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    }
    setDeleting(null);
  };

  const handleCreate = async (data: { name: string; subject: string; body: string }) => {
    setSaving(true);
    try {
      await createEmailTemplate(data);
      router.refresh();
      setCreateOpen(false);
      toast.success("Template created");
    } catch {
      toast.error("Failed to create template");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create New
        </Button>
      </div>

      <div className="grid gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 shadow-sm dark:shadow-zinc-900/50 transition-all hover:shadow-md dark:hover:shadow-zinc-900/50"
          >
            {editingId === t.id ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 block">Name</label>
                  <Input
                    ref={nameRef}
                    data-field="name"
                    defaultValue={t.name}
                    onFocus={() => setFocusedField("name")}
                    placeholder="Template name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 block">Subject</label>
                  <Input
                    ref={subjectRef}
                    data-field="subject"
                    defaultValue={t.subject}
                    onFocus={() => setFocusedField("subject")}
                    placeholder="Email subject"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 block">Body</label>
                  <Textarea
                    ref={bodyRef}
                    data-field="body"
                    defaultValue={t.body}
                    onFocus={() => setFocusedField("body")}
                    placeholder="Email body..."
                    rows={6}
                    className="resize-y"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 mr-1">Insert:</span>
                  {PLACEHOLDER_CHIPS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => insertPlaceholder(p)}
                      className="rounded-md bg-slate-100 dark:bg-zinc-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save
                  </Button>
                  {!t.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetDefault(t.id)}
                      disabled={saving}
                    >
                      <Star className="h-3.5 w-3.5 mr-1.5" />
                      Set as Default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(t.id)}
                    disabled={deleting === t.id}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setEditingId(t.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-zinc-100 truncate">{t.name}</h3>
                    {t.isDefault && (
                      <Badge variant="secondary" className="shrink-0">
                        <Star className="h-3 w-3 mr-0.5 fill-amber-400 text-amber-600" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <Pencil className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400 truncate">{t.subject}</p>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreate}
        saving={saving}
        placeholderChips={PLACEHOLDER_CHIPS}
      />
    </div>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onSave,
  saving,
  placeholderChips,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; subject: string; body: string }) => void;
  saving: boolean;
  placeholderChips: readonly string[];
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [focusedField, setFocusedField] = useState<"name" | "subject" | "body" | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertPlaceholder = (placeholder: string) => {
    const el =
      focusedField === "name"
        ? nameRef.current
        : focusedField === "subject"
          ? subjectRef.current
          : focusedField === "body"
            ? bodyRef.current
            : null;
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const setter =
        focusedField === "name" ? setName : focusedField === "subject" ? setSubject : setBody;
      const val = focusedField === "name" ? name : focusedField === "subject" ? subject : body;
      const newVal = val.slice(0, start) + placeholder + val.slice(end);
      setter(newVal);
      setTimeout(() => el.setSelectionRange(start + placeholder.length, start + placeholder.length), 0);
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error("Name, subject, and body are required");
      return;
    }
    onSave({ name, subject, body });
    setName("");
    setSubject("");
    setBody("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName("");
      setSubject("");
      setBody("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 block">Name</label>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocusedField("name")}
              placeholder="Template name"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Subject</label>
            <Input
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setFocusedField("subject")}
              placeholder="Email subject"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5 block">Body</label>
            <Textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setFocusedField("body")}
              placeholder="Email body..."
              rows={6}
              className="resize-y"
            />
          </div>
          <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 mr-1">Insert:</span>
            {placeholderChips.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => insertPlaceholder(p)}
                className="rounded-md bg-slate-100 dark:bg-zinc-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
