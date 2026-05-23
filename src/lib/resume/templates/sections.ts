/**
 * Shared section renderers for single-column templates.
 *
 * Each template's HTML body is composed of these blocks. Templates differ
 * only in CSS — fonts, spacing, color accent, section-header style. The
 * structural markup stays identical across T01-T16 (single-column variants).
 */

import type { ResumeRenderInput } from "../types";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function link(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * Normalize all-caps user input ("JOHN DOE", "MARÍA O'CONNOR-LEE") to title case
 * so the rendered resume doesn't shout. Leaves mixed-case names alone — a user
 * who intentionally typed "danah boyd" should still get "danah boyd".
 */
export function normalizeDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  // Only normalize if 70%+ of the alpha characters are uppercase (catches all-caps
  // and SCREAMING-with-numbers; leaves "John McDonald" alone)
  const alpha = trimmed.replace(/[^A-Za-z]/g, "");
  if (alpha.length < 3) return trimmed;
  const uppers = alpha.replace(/[^A-Z]/g, "").length;
  if (uppers / alpha.length < 0.7) return trimmed;
  return trimmed.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

export function renderHeader(h: ResumeRenderInput["header"]): string {
  const links: string[] = [];
  if (h.websiteUrl) links.push(link(h.websiteUrl, stripScheme(h.websiteUrl)));
  if (h.githubUrl) links.push(link(h.githubUrl, stripScheme(h.githubUrl)));
  if (h.linkedinUrl) links.push(link(h.linkedinUrl, stripScheme(h.linkedinUrl)));

  const contactBits = [h.location, h.email, h.phone].filter(Boolean).map((v) => escapeHtml(v!));
  const linkLine = links.length ? links.join(' <span class="dot">·</span> ') : "";
  const displayName = normalizeDisplayName(h.fullName);

  return `
  <header class="rs-header">
    <h1 class="rs-name">${escapeHtml(displayName)}</h1>
    <p class="rs-headline">${escapeHtml(h.headline)}</p>
    <p class="rs-contact">${contactBits.join(' <span class="dot">·</span> ')}</p>
    ${linkLine ? `<p class="rs-contact">${linkLine}</p>` : ""}
  </header>`;
}

export function renderSummary(s: ResumeRenderInput["summary"]): string {
  if (!s) return "";
  return `
  <section class="rs-section">
    <h2 class="rs-h2">Summary</h2>
    <p class="rs-summary">${escapeHtml(s.content)}</p>
  </section>`;
}

export function renderSkills(
  skills: ResumeRenderInput["skills"],
  options: { style?: "chip" | "inline" } = {},
): string {
  if (!skills.length) return "";
  const style = options.style ?? "chip";
  const list =
    style === "chip"
      ? skills.map((s) => `<span class="rs-skill">${escapeHtml(s)}</span>`).join("")
      : skills.map(escapeHtml).join(' <span class="dot">·</span> ');
  const containerClass = style === "chip" ? "rs-skills rs-skills-chip" : "rs-skills rs-skills-inline";
  return `
  <section class="rs-section">
    <h2 class="rs-h2">Skills</h2>
    <div class="${containerClass}">${list}</div>
  </section>`;
}

export function renderExperience(items: ResumeRenderInput["experiences"]): string {
  if (!items.length) return "";
  const blocks = items.map((e) => {
    const dates = `${escapeHtml(e.startDate)}${e.endDate ? ` &ndash; ${escapeHtml(e.endDate)}` : ""}`;
    const loc = e.location ? ` <span class="rs-muted">· ${escapeHtml(e.location)}</span>` : "";
    const bullets = e.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("");
    return `
    <article class="rs-entry">
      <div class="rs-entry-head">
        <div class="rs-entry-title">
          <strong>${escapeHtml(e.title)}</strong>, ${escapeHtml(e.company)}${loc}
        </div>
        <div class="rs-entry-dates">${dates}</div>
      </div>
      <ul class="rs-bullets">${bullets}</ul>
    </article>`;
  }).join("");
  return `
  <section class="rs-section">
    <h2 class="rs-h2">Experience</h2>
    ${blocks}
  </section>`;
}

export function renderProjects(items: ResumeRenderInput["projects"]): string {
  if (!items.length) return "";
  const blocks = items.map((p) => {
    const stack = p.stack.length
      ? `<div class="rs-muted rs-stack"><em>${p.stack.map(escapeHtml).join(", ")}</em></div>`
      : "";
    const links: string[] = [];
    if (p.liveUrl) links.push(`<span class="dot">·</span> ${link(p.liveUrl, "Live")}`);
    if (p.repoUrl) links.push(`<span class="dot">·</span> ${link(p.repoUrl, stripScheme(p.repoUrl))}`);
    const bullets = p.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("");
    return `
    <article class="rs-entry">
      <div class="rs-entry-head">
        <div class="rs-entry-title">
          <strong>${escapeHtml(p.title)}</strong> &mdash; ${escapeHtml(p.oneLiner)} ${links.join(" ")}
        </div>
      </div>
      ${stack}
      <ul class="rs-bullets">${bullets}</ul>
    </article>`;
  }).join("");
  return `
  <section class="rs-section">
    <h2 class="rs-h2">Selected Projects</h2>
    ${blocks}
  </section>`;
}

export function renderEducation(items: ResumeRenderInput["education"]): string {
  if (!items.length) return "";
  const blocks = items.map((e) => {
    const dates = [e.startDate, e.endDate]
      .filter(Boolean)
      .map((v) => escapeHtml(v!))
      .join(" &ndash; ");
    return `
    <article class="rs-entry">
      <div class="rs-entry-head">
        <div class="rs-entry-title">
          <strong>${escapeHtml(e.institution)}</strong> <span class="rs-muted">&mdash; ${escapeHtml(e.degree)}</span>
        </div>
        <div class="rs-entry-dates">${dates}</div>
      </div>
      ${e.details ? `<p class="rs-muted">${escapeHtml(e.details)}</p>` : ""}
    </article>`;
  }).join("");
  return `
  <section class="rs-section">
    <h2 class="rs-h2">Education</h2>
    ${blocks}
  </section>`;
}

export function renderCertifications(items: ResumeRenderInput["certifications"]): string {
  if (!items.length) return "";
  const blocks = items.map((c) => {
    const issuer = c.issuer ? ` <span class="rs-muted">&mdash; ${escapeHtml(c.issuer)}</span>` : "";
    const date = c.issuedDate ? ` <span class="rs-entry-dates">${escapeHtml(c.issuedDate)}</span>` : "";
    const url = c.credentialUrl ? ` ${link(c.credentialUrl, "Credential")}` : "";
    return `<li><strong>${escapeHtml(c.name)}</strong>${issuer}${date}${url}</li>`;
  }).join("");
  return `
  <section class="rs-section">
    <h2 class="rs-h2">Certifications</h2>
    <ul class="rs-cert-list">${blocks}</ul>
  </section>`;
}

export function renderBody(
  input: ResumeRenderInput,
  options: { skillStyle?: "chip" | "inline" } = {},
): string {
  const renderers: Record<
    ResumeRenderInput["sectionOrder"][number],
    () => string
  > = {
    summary: () => renderSummary(input.summary),
    skills: () => renderSkills(input.skills, { style: options.skillStyle }),
    experience: () => renderExperience(input.experiences),
    projects: () => renderProjects(input.projects),
    education: () => renderEducation(input.education),
    certifications: () => renderCertifications(input.certifications),
  };
  return input.sectionOrder.map((key) => renderers[key]?.() ?? "").join("\n");
}
