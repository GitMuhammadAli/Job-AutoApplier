import { Search, Sparkles, Columns3, FileText, Send, BarChart3 } from "lucide-react";
import { AnimateOnScroll } from "./AnimateOnScroll";

function MatchBars() {
  const items = [
    { label: "Senior React Dev", score: 95 },
    { label: "Full Stack Eng", score: 72 },
    { label: "Python Backend", score: 45 },
  ];
  return (
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 w-24 truncate">{item.label}</span>
          <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${item.score >= 70 ? "bg-emerald-500" : item.score >= 50 ? "bg-amber-400" : "bg-zinc-300 dark:bg-zinc-600"}`}
              style={{ width: `${item.score}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-zinc-400 tabular-nums w-8 text-right">{item.score}%</span>
        </div>
      ))}
    </div>
  );
}

function EmailPreview() {
  return (
    <div className="mt-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 ring-1 ring-zinc-100 dark:ring-zinc-700/50">
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
        <span className="text-zinc-700 dark:text-zinc-300 font-medium">Dear Hiring Team at Vercel,</span>
        <br />
        I noticed your Senior React Developer role and was excited to see it aligns with my experience building production apps...
      </p>
      <div className="mt-2 flex gap-1">
        {["React", "TypeScript", "Next.js"].map((s) => (
          <span key={s} className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium">{s}</span>
        ))}
      </div>
    </div>
  );
}

function MiniKanban() {
  const cols = [
    { label: "Saved", count: 3, color: "bg-blue-500" },
    { label: "Applied", count: 2, color: "bg-amber-500" },
    { label: "Interview", count: 1, color: "bg-emerald-500" },
  ];
  return (
    <div className="mt-4 flex gap-1.5">
      {cols.map((col) => (
        <div key={col.label} className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${col.color}`} />
            <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 truncate">{col.label}</span>
          </div>
          {Array.from({ length: col.count }).map((_, j) => (
            <div key={j} className="mb-1 h-4 rounded bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniChart() {
  const heights = [35, 58, 42, 75, 63, 80, 50];
  return (
    <div className="mt-4 flex items-end gap-1 h-10">
      {heights.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm bg-emerald-500/80 dark:bg-emerald-400/80" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

const FEATURES = [
  {
    Icon: Search,
    title: "Smart Job Matching",
    desc: "Set your keywords, skills and preferences. JobPilot scores every job 0-100 and shows only what matters.",
    Visual: MatchBars,
  },
  {
    Icon: Sparkles,
    title: "AI Email Writer",
    desc: "Every application gets a personalized email. The AI reads the job description and picks skills from YOUR resume.",
    Visual: EmailPreview,
  },
  {
    Icon: Columns3,
    title: "Kanban Board",
    desc: "Drag jobs through stages: Saved, Applied, Interview, Offer, Rejected. See your pipeline at a glance.",
    Visual: MiniKanban,
  },
  {
    Icon: FileText,
    title: "Smart Resume Matching",
    desc: "Upload multiple resumes. JobPilot picks the best one for each job based on skill overlap and category match.",
    Visual: () => (
      <div className="mt-4 space-y-1.5">
        {[
          { name: "Frontend_Resume.pdf", fit: true },
          { name: "Backend_Resume.pdf", fit: false },
          { name: "FullStack_Resume.pdf", fit: true },
        ].map((r) => (
          <div key={r.name} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] ${r.fit ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200/50 dark:ring-emerald-800/30" : "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500"}`}>
            <FileText className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{r.name}</span>
            {r.fit && <span className="ml-auto text-[8px] font-bold whitespace-nowrap">BEST FIT</span>}
          </div>
        ))}
      </div>
    ),
  },
  {
    Icon: Send,
    title: "One-Click Apply",
    desc: "Copy everything to clipboard and paste in Gmail. Or connect Gmail and send directly. Your email, your reputation.",
    Visual: () => (
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white px-4 py-2 text-center text-[11px] font-semibold shadow-lg shadow-zinc-900/20">
          Copy All to Clipboard
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Paste in Gmail, Send</span>
      </div>
    ),
  },
  {
    Icon: BarChart3,
    title: "Analytics Dashboard",
    desc: "Track response rate, applications over time, top companies, and match score distribution.",
    Visual: MiniChart,
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-6">
        <AnimateOnScroll>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
            Features
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-zinc-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
            Everything you need to land your next role.
          </h2>
          <p className="mt-4 text-center text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
            From finding the right jobs to sending the perfect email — JobPilot handles the entire pipeline.
          </p>
        </AnimateOnScroll>
        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <AnimateOnScroll key={f.title} delay={i * 80}>
              <div className="group rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-6 ring-1 ring-zinc-100 dark:ring-zinc-800 hover:ring-emerald-200 dark:hover:ring-emerald-800/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg h-full flex flex-col">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-700 mb-4">
                  <f.Icon className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
                </div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed flex-1">{f.desc}</p>
                <f.Visual />
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
