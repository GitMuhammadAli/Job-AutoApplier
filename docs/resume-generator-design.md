# Resume Generator — Design (Phase 0)

> **Status**: Design only. No schema migration, no UI, no commits yet.
> **Drafted**: 2026-05-21
> **Hard rule**: We MANAGE resumes, we do not REWRITE them per JD. AI's role is parse-on-onboarding, rank-on-tailoring. Never generates final-output prose.

---

## 1. Why this exists

Current state: 8 PDFs uploaded by user as static `Resume` rows. Selected per application by category match. No generation. No customization. No project library.

Gap: Other applicants ship JD-tailored ATS-clean PDFs in seconds. We can either:
- (A) Keep uploads only — user maintains 8 PDFs forever.
- (B) Generate from a structured profile, customize ordering/selection per JD, never touch the words. ← **this doc.**
- (C) Full AI rewrite per JD — rejected. Fabrication risk, calibration hell, and the user has explicitly said "manage not rewrite."

---

## 2. Hard constraints (the "manage not rewrite" rule)

| Operation | Allowed | Forbidden |
|---|---|---|
| Experience bullets | Reorder within a job | Rewrite words. Add metrics. Inject JD keywords. |
| Job titles / companies / dates | Display verbatim | Any modification ever |
| Skills section | Reorder, group, highlight | Add a skill not in user's master `skills[]` |
| Summary | Pick from 1–3 user-written variants | Generate new prose |
| Projects | Select N from library by JD relevance | Rewrite descriptions / bullets |
| Section order | Swap Projects ↔ Experience | n/a |
| Page count | Auto-trim project list / bullets-per-job to hit 1pg or 2pg | Truncate mid-sentence; drop required sections |
| Template | User picks 1 of 3 per generation | n/a |

AI is allowed to:
1. Parse uploaded master resume PDF → structured profile (user **must confirm every item** before save).
2. Rank skills/projects by JD relevance (returns ordering, not text).
3. Suggest which of the user's pre-written summaries fits best (returns choice, not text).

AI is never allowed to:
- Write experience bullet content.
- Change company names, job titles, employment dates, education entries, certifications.
- Add a skill the user hasn't already entered in their master profile.
- Invent metrics, projects, or accomplishments.

These rules are enforced by:
- Schema: experience bullets stored as `String[]` with no per-generation overrides field.
- Render contract: render pipeline takes a `ResumeRenderInput` that only contains `{ profileId, variantId, ordering, selection, templateId, pageTarget }` — no place to inject substitute text.
- Code review: any PR that adds a "rewriteBullets" or similar field is rejected.

---

## 3. Data model

### 3.1 New Prisma models

```prisma
// User's single master profile (1:1 with User)
model ResumeProfile {
  id          String  @id @default(cuid())
  userId      String  @unique
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Header
  fullName    String
  headline    String   // e.g. "Software Engineer • LLM Evaluation"
  location    String?
  email       String
  phone       String?
  websiteUrl  String?
  githubUrl   String?
  linkedinUrl String?

  // Master skills — ordering is the DEFAULT order (used when no JD)
  skills      String[]

  // Once onboarding is confirmed, JD tailoring HARD-REJECTS any skill not in
  // `skills[]` rather than silently dropping. Flipped to true at end of wizard.
  skillsLocked Boolean @default(false)

  // Pre-written summaries — user authors 1–3, picker chooses one per generation
  summaries   ResumeSummary[]

  experiences ResumeExperience[]
  projects    ResumeProject[]
  education   ResumeEducation[]
  certifications ResumeCertification[]
  variants    ResumeVariant[]
  generations ResumeGeneration[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ResumeSummary {
  id          String  @id @default(cuid())
  profileId   String
  profile     ResumeProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  label       String   // user-chosen, e.g. "MERN-leaning", "AI-eval-leaning"
  content     String   @db.Text
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([profileId])
}

model ResumeExperience {
  id          String  @id @default(cuid())
  profileId   String
  profile     ResumeProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  company     String
  title       String
  location    String?
  startDate   String   // "August 2025" — display verbatim, not Date
  endDate     String?  // "Present" or "August 2025"
  bullets     String[] // 2–6 bullets per job. ORDER matters, AI may reorder.

  order       Int      // user's authored order; default render order
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([profileId, order])
}

model ResumeProject {
  id          String  @id @default(cuid())
  profileId   String
  profile     ResumeProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  title       String
  role        String?  // "Solo", "Lead", etc.
  oneLiner    String   // 1-line description shown when collapsed
  bullets     String[] // 2–4 bullets, immutable from AI
  stack       String[] // tech stack tags — used for JD ranking
  liveUrl     String?
  repoUrl     String?

  isFeatured  Boolean  @default(false)  // "always include if room"
  order       Int

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([profileId, order])
  @@index([profileId, isFeatured])
}

model ResumeEducation {
  id          String  @id @default(cuid())
  profileId   String
  profile     ResumeProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  institution String
  degree      String
  startDate   String?
  endDate     String?
  details     String?  @db.Text
  order       Int
  createdAt   DateTime @default(now())

  @@index([profileId, order])
}

model ResumeCertification {
  id          String  @id @default(cuid())
  profileId   String
  profile     ResumeProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  name        String
  issuer      String?
  issuedDate  String?
  credentialUrl String?
  order       Int
  createdAt   DateTime @default(now())

  @@index([profileId, order])
}

// A named saved tailoring (e.g. "AI-eval-leaning", "Backend-leaning").
// User can save the result of a JD-tailoring as a reusable Variant.
model ResumeVariant {
  id              String  @id @default(cuid())
  profileId       String
  profile         ResumeProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  name            String   // "AI-eval-leaning"
  templateId      String   // "T1" | "T2" | "T3"
  templateVersion String   // e.g. "T1@1.0.0" — pinned so future CSS tweaks don't silently rewrite history
  pageTarget      Int      @default(1)  // 1 or 2

  // Ordering / selection — these are the only knobs.
  skillsOrder     String[] // ordered subset of profile.skills
  projectIds      String[] // ordered subset of profile.projects
  experienceIds   String[] // ordered subset of profile.experiences
  summaryId       String?  // which ResumeSummary
  sectionOrder    String[] // ["summary","skills","experience","projects","education"]

  isDefault       Boolean  @default(false)
  generatedFromJd Boolean  @default(false)
  jdSnippet       String?  @db.Text  // for "where did this come from"

  generations     ResumeGeneration[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([profileId])
}

// A single PDF rendering. Persists for audit + re-download.
model ResumeGeneration {
  id          String  @id @default(cuid())
  profileId   String
  profile     ResumeProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  variantId   String?
  variant     ResumeVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  templateId      String
  templateVersion String  // pinned at generation time; stream-on-demand replays this exact version
  pageTarget      Int
  pdfUrl          String?  // unused in v1 (stream-on-demand). Kept for future "saved PDF" path.
  htmlSnapshot    String?  @db.Text  // canonical artifact — regen reads this
  jdSnippet   String?  @db.Text
  matchedKeywords String[]  // for the diff-preview

  createdAt   DateTime @default(now())

  @@index([profileId, createdAt])
}
```

### 3.2 Existing `Resume` model — what happens

The existing `Resume` model (uploaded PDFs) **stays.** It is the "raw upload" archive. The new `ResumeProfile` is "structured editable profile." The `JobApplication` model continues to reference `Resume` (uploaded) — we'll add a nullable `ResumeGeneration` reference in a later phase.

Migration plan:
- Phase 1: add new models, no touching of `Resume`.
- Phase 5: build "Convert this PDF to a ResumeProfile" wizard. User uploads `MERN-Ali-Shahid.pdf`, we parse → user confirms → ResumeProfile created. They can then delete the PDF if they want.

---

## 4. Generation pipeline

```
POST /api/resumes/generate
  body: { profileId, variantId?, jdText?, templateId?, pageTarget? }
    │
    ▼
┌─────────────────────────────────────────────┐
│ 1. Resolve profile + (variant OR JD-tailor) │
│    - If variantId: use saved ordering       │
│    - If jdText: rank skills/projects/summary│
│      (LLM ranks ONLY; never writes text)    │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
       ResumeRenderInput (typed JSON)
                      │
                      ▼
        Server-side HTML render via React
                      │
                      ▼
          Playwright (puppeteer-core)
                      │
                      ▼
                  PDF (Blob)
                      │
                      ▼
        Upload + ResumeGeneration row
                      │
                      ▼
      Return { pdfUrl, generationId, diff }
```

### 4.1 `ResumeRenderInput` contract

```typescript
interface ResumeRenderInput {
  templateId: "T1" | "T2" | "T3";
  pageTarget: 1 | 2;

  header: {
    fullName: string;
    headline: string;
    location?: string;
    email: string;
    phone?: string;
    links: Array<{ label: string; url: string }>;
  };

  summary?: {
    content: string;  // verbatim from ResumeSummary.content
    sourceId: string; // ResumeSummary.id (for audit)
  };

  skills: string[];   // ordered subset of master skills

  experiences: Array<{
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    bullets: string[];   // verbatim, possibly reordered within job
    sourceId: string;    // ResumeExperience.id
  }>;

  projects: Array<{
    title: string;
    role?: string;
    oneLiner: string;
    bullets: string[];   // verbatim
    stack: string[];
    liveUrl?: string;
    repoUrl?: string;
    sourceId: string;    // ResumeProject.id
  }>;

  education: Array<{
    institution: string;
    degree: string;
    startDate?: string;
    endDate?: string;
    details?: string;
    sourceId: string;
  }>;

  certifications: Array<{
    name: string;
    issuer?: string;
    issuedDate?: string;
    credentialUrl?: string;
    sourceId: string;
  }>;

  sectionOrder: Array<"summary" | "skills" | "experience" | "projects" | "education" | "certifications">;
}
```

**Note:** there is no `bulletOverride`, no `customSummary`, no `injectKeywords`. The contract is intentionally narrow so the render pipeline literally *cannot* inject AI-written content.

### 4.2 JD tailoring algorithm

```typescript
function rankForJd(profile: ResumeProfile, jdText: string): {
  skillsOrder: string[];
  projectIds: string[];
  summaryId: string;
  sectionOrder: string[];
  matchedKeywords: string[];
}
```

Steps:
1. **Extract JD signal** (LLM call, 1× per generation):
   - Required skills, nice-to-have skills, role family (frontend/backend/full-stack/AI/data).
   - Returns: `{ requiredSkills: string[], niceSkills: string[], roleFamily: string }`.
   - Prompt is locked-down: returns JSON only, no other behavior allowed.

2. **Skill reorder**:
   - `score(s) = required.includes(s) ? 2 : nice.includes(s) ? 1 : 0`
   - Sort `profile.skills` by score DESC, then by original order.
   - **No skill is added.** If user doesn't have "Kubernetes" listed, it doesn't appear no matter what JD says.

3. **Project ranking**:
   - `score(p) = |intersect(p.stack, required+nice)|  + (p.isFeatured ? 0.5 : 0)`
   - Sort projects by score DESC. Cap at K projects (K depends on page target).

4. **Summary pick**:
   - If user has multiple summaries, LLM picks the best label given the JD's role family.
   - Returns `summaryId`, not new text.

5. **Section order**:
   - Default: `[summary, skills, experience, projects, education]`
   - If `projects[top-3].avgScore > experiences[avgScore]`: swap to projects-first.
   - User can override in UI.

6. **Page-fit trim**:
   - Render with all selected items.
   - If overflow on 1pg target: drop lowest-scoring projects first, then lowest-scoring projects' bullets, never touch experience.
   - Hard floor: at least 1 project + all experiences + summary + skills must remain.

### 4.3 Anti-fabrication guards in render pipeline

- Render takes `ResumeRenderInput` only — typed schema, no `additionalProperties: true`.
- React templates receive exact strings, render them as text. No string interpolation that mixes content + AI output.
- `htmlSnapshot` saved to DB for every generation — auditable.
- Unit test: feed render pipeline a `ResumeRenderInput`, snapshot the HTML, assert no string in the output appears that wasn't in the input.

---

## 5. Templates (3 to start)

| ID | Name | Layout | Use case |
|---|---|---|---|
| **T1** | ATS Clean | Single-column, Space Grotesk + DM Sans (career-ops style) | Default. Maximum ATS compatibility. |
| **T2** | Modern Two-Column | Sidebar (contact + skills + education), main (summary + experience + projects) | Visual scanners, agency / startup |
| **T3** | Engineering Dense | Project-forward, code-stack badges, tight leading | FAANG, technical roles where projects matter |

All three:
- Black text on white (printable, ATS-safe).
- Same HTML structure, different CSS.
- One file per template under `apps/web/src/lib/resume-templates/{t1,t2,t3}.tsx`.
- Templates are pure functions: `(input: ResumeRenderInput) => React.ReactElement`.

---

## 6. Onboarding wizard (Phase 1)

Path: `/dashboard/resumes/setup`

**Step 1 — Bootstrap source:**
- Option A: "I have a master resume PDF" → upload → AI extracts → user confirms each item.
- Option B: "Start from scratch" → empty profile, user fills sections manually.
- Option C: "Copy from existing JobPilot upload" → pick from current `Resume` rows.

**Step 2 — Confirm header + summary:**
- Pre-filled from User row + AI extraction.
- User writes 1 summary (required). Can add up to 2 more (optional).

**Step 3 — Confirm experiences:**
- AI extracted entries shown side-by-side with PDF preview (if PDF source).
- User edits/deletes/adds. Each entry is independently saveable.
- **Bullets:** user can edit until saved. Once saved as part of an experience, marked locked.

**Step 4 — Confirm projects:**
- AI-extracted projects + "Add another" button.
- Mark up to 5 as **Featured.**
- Schema-required: title, oneLiner, ≥1 bullet, ≥1 stack tag.

**Step 5 — Confirm skills:**
- AI suggests skills from all bullets + stack tags. User accepts/rejects/edits.
- This list is the **closed set** — JD tailoring can never go beyond it. User must add new skills here first.

**Step 6 — Education + Certs.**

**Step 7 — Save → "Generate first PDF" CTA.**

---

## 7. UI changes to existing Resumes page

Current `/dashboard/resumes` shows 8 PDF cards. New UI:

- **Tab: "My Profile"** — single source of truth, edit-in-place sections.
- **Tab: "Variants"** — saved tailorings (e.g. "AI-eval-leaning", "Backend-leaning"). Each variant is a `ResumeVariant` row.
- **Tab: "Uploads (legacy)"** — current PDF list. Stays for backward compat. Banner: "Convert to structured profile."
- **Tab: "History"** — list of `ResumeGeneration` rows with PDF download + JD snippet.

**Generate flow:**
- Top of profile page: "Generate Resume" button.
- Modal: paste JD (optional) → pick template → pick page target → preview → download.
- If JD pasted: preview shows diff vs default order. ("Promoted: Python, FastAPI. Demoted: Tailwind. Featured projects: Rate-Guard, JobPilot.")

---

## 8. Auto-apply integration (later phase, not v1)

The auto-apply pipeline currently picks a `Resume` (PDF) per job by category match. Future:
- Per-job: if user has a `ResumeProfile`, generate a fresh PDF using the job's `globalJob.description` as JD.
- Falls back to picking a `ResumeVariant` (faster, cached) if `globalJob.description` is empty.
- Each `JobApplication` references the `ResumeGeneration` so we know exactly which PDF was sent.
- **Critical**: the generated PDF is identical to what the user sees in preview — never silently regenerated.

Out of scope for v1. Add `JobApplication.resumeGenerationId String?` in Phase 1 schema, populate in a later phase.

---

## 9. Open questions (need answer before Phase 1)

1. **Storage**: Vercel Blob, S3, or stream-on-demand (no storage, regenerate from `ResumeGeneration.htmlSnapshot`)? — **Recommend stream-on-demand** to avoid storage costs; user re-downloads regenerate from snapshot.
2. **PDF library**: Playwright vs Puppeteer-core vs `@react-pdf/renderer`? — **Recommend Playwright** (already in deps for scrapers; same approach as career-ops).
3. **LLM provider for JD ranking**: Groq (fast, free, JSON mode) or Gemini? — **Recommend Groq** with Gemini fallback (same pattern as DevRadar's `jsonCompleteWithFallback`, port it).
4. **Page-fit estimation**: Render-then-measure (slow, accurate) or character-count heuristic (fast, approximate)? — **Recommend render-and-measure** with a 200ms cap; fall back to heuristic if timeout.
5. **Existing Resume model**: keep separate forever, or eventually deprecate uploads in favor of structured profile? — **Recommend keep both indefinitely.** Some users will only ever upload.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| User adds a fake skill to their master list, then it appears in tailored resume | Acceptable — user is the source of truth. UX: subtle warning "skills appear verbatim, ensure these are accurate." |
| Playwright cold-start blows Vercel function budget | Pre-warm by keeping a single Chromium instance across requests; fall back to `@react-pdf/renderer` if Playwright fails. |
| User's bullets contain markdown that breaks the template | Sanitize at save (allow only plain text + simple inline emphasis). Reject bullets >280 chars. |
| AI parser hallucinates an experience entry during onboarding | User confirms every item before save. Save is per-item. Reject parsing that returns >user's PDF page count × 5 items. |
| Generated PDF differs from preview | Single render path. Preview = same HTML used for PDF, rendered in iframe. No "preview-only" branches. |
| LLM injects words into rankings by returning altered skill names | Strict schema validation: rankings must be permutation of input set; reject and retry once if not. |

---

## 11. Out of scope (don't build in this feature)

- Cover letter generation (exists in agentic pipeline).
- Real-time WYSIWYG editor.
- Multiple master profiles per user.
- Public sharing URL.
- Resume diff tool ("what changed since last variant").
- Auto-numbering / auto-formatting metrics in bullets.
- AI rewriting bullets for clarity / brevity. **EVER.**

---

## 12. Phase 0 follow-ups before Phase 1 begins

1. User confirms hard rule (Section 2) is the right line.
2. User answers open questions (Section 9) — defaults proposed.
3. User reviews schema (Section 3) — call out anything missing.
4. User reviews UI sketch (Section 7) — agrees with the four-tab layout.
5. POC: render T1 template with a hand-written `ResumeRenderInput` matching Ali's actual data → confirm output is ATS-clean and looks right. (Built in `/tmp/resume-template-poc/` before any commit to JobPilot repo.)

When all five are signed off, Phase 1 begins: Prisma migration + onboarding wizard.

---

## 13. Comparison vs santifer/career-ops (informs design)

| Aspect | career-ops | This design |
|---|---|---|
| Source of truth | Markdown CV + YAML profile + TSV tracker | Postgres ResumeProfile |
| Customization | Mode-driven prompts, AI rewrites per JD | Reorder + select only, never rewrite |
| Templates | 1 HTML template, configurable | 3 templates, user picks per generation |
| PDF engine | Playwright + Puppeteer | Playwright |
| Fonts | Space Grotesk + DM Sans (embedded) | Same (steal verbatim) |
| Negotiation / interview prep | Same repo | Separate app (DevRadar) |
| Auto-apply | Explicitly refuses | Existing JobPilot pipeline does this |
| Audience | "Find 1 dream role" filter | "Send 100 quality apps" funnel |

**What we steal:** PDF pipeline approach, ATS-clean template aesthetic (Space Grotesk + DM Sans single-column).

**What we deliberately diverge on:** No AI rewriting. Manage-not-rewrite is the user's explicit constraint and is enforced at the schema level.

---

## 14. Resolved decisions (2026-05-21)

User signed off; this section locks the contract for Phase 1.

### Confirmed defaults
| # | Decision | Value |
|---|---|---|
| D1 | Hard rule §2 (manage-not-rewrite) | **LOCKED** — enforced at schema + render contract + audit test |
| D2 | PDF storage | **Stream-on-demand from `htmlSnapshot`.** No S3/Blob in v1. |
| D3 | PDF engine | **Playwright primary.** `@react-pdf/renderer` is last-resort fallback only. |
| D4 | LLM for JD ranking | **Groq primary, Gemini fallback.** Port DevRadar's `jsonCompleteWithFallback` verbatim. |
| D5 | Page-fit | **Render-and-measure with 200ms cap + char-count heuristic fallback.** Heuristic ships in v1 (not deferred). |
| D6 | Existing `Resume` upload model | **Keep indefinitely**, parallel path. |

### Schema additions (already inlined above)
- `ResumeProfile.skillsLocked Boolean @default(false)` — flipped true at end of onboarding; JD tailoring then hard-rejects skills not in master set rather than silently dropping.
- `ResumeVariant.templateVersion String` and `ResumeGeneration.templateVersion String` — stream-on-demand without versioning corrupts history on every CSS tweak. Versions are immutable strings like `"T1@1.0.0"`.
- `ResumeGeneration.pdfUrl` reframed as "unused in v1, kept for future saved-PDF path." `htmlSnapshot` is the canonical artifact.

### Non-negotiable audit test
- Snapshot the rendered HTML for a fixture `ResumeRenderInput`.
- Assert: every visible text node in the output exists as a substring of one of the input fields (header, summary.content, skills[], bullets[], etc).
- This — not schema narrowness — is the real enforcement of no-fabrication. Schema can be bypassed by future changes. The snapshot test fails CI loudly.

### Validation moved to Zod-at-save (not UI-only)
- Bullet ≤ 280 chars, enforced in the server action that saves `ResumeExperience` and `ResumeProject`.
- Skill string trimmed, max 64 chars, deduped per profile (case-insensitive).
- Summary content ≤ 600 chars (1-page resume's summary block).
- URLs validated as `https?://…`.

### Bug watch
1. **LLM altered skill names** (returns "Type Script" instead of "TypeScript"): strict permutation check against `skills[]`, retry once, surface error to user. **Do not silently degrade.**
2. **Playwright cold-start on Vercel**: real cost line if scrapers don't already warm Chromium. **See out-of-band check below.**
3. **Stream-on-demand without `templateVersion`**: silent history corruption every time we tweak template CSS. Mitigated by D2 + D7 above.

### Out-of-band follow-ups
1. **Chromium reuse check**: confirm JobPilot's existing scraper Playwright instance is reusable by the resume render path. If they share a Chromium binary on Vercel, cold-start is amortized; if not, quantify the cold-start latency before Phase 1 commits.
2. **90-day fidelity audit** after launch: re-render the oldest 100 `htmlSnapshot` rows, diff against fresh render. If font/CSS drift breaks regen, fall back to PDF storage (D2 reverses).

### Revised sequence
| Step | Deliverable | Commits? |
|---|---|---|
| **S0 — POC** | T1 template HTML in `/tmp/resume-template-poc/` rendered from a hand-written `ResumeRenderInput` matching Ali's real data. **No JobPilot PR.** | NO |
| **S1 — Phase 1** | Prisma migration + onboarding wizard + manual edit UI. **No JD tailoring yet.** | YES (gated on S0 visual approval) |
| **S2 — Phase 2** | JD tailoring + `ResumeVariant` saved-tailoring + diff preview | YES |
| **S3 — Phase 3** | Auto-apply integration via `JobApplication.resumeGenerationId` | YES |

**Gate**: no PR opens against JobPilot until POC output is visually approved by user.

