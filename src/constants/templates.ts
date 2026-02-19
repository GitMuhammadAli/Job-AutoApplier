export const STARTER_TEMPLATES = [
  {
    name: "Professional Standard",
    subject: "{{position}} — {{name}}",
    body: `Hi {{company}} team,

I came across your {{position}} opening and believe my background makes me a strong fit.

[AI will fill in 2-3 specific qualifications from resume]

I'd welcome the opportunity to discuss how I can contribute to {{company}}. I'm available for a call at your convenience.

Best regards,
{{name}}`,
    isDefault: true,
  },
  {
    name: "Confident & Direct",
    subject: "{{position}} Application — {{name}}",
    body: `Hi {{company}} team,

Your {{position}} role caught my attention. Here's why I'm the right person:

[AI will fill in specific qualifications]

Let's set up a time to talk. I'm confident I can make an immediate impact.

{{name}}`,
    isDefault: false,
  },
  {
    name: "Referral / Connection",
    subject: "{{position}} — Referred by [Connection Name]",
    body: `Hi {{company}} team,

[Connection Name] suggested I reach out about your {{position}} opening.

[AI will fill in qualifications]

I'd love to learn more about the role and how I can contribute. Happy to chat whenever works best.

Warm regards,
{{name}}`,
    isDefault: false,
  },
  {
    name: "Short & Sweet",
    subject: "Re: {{position}} at {{company}}",
    body: `Hi,

Applying for your {{position}} role. Quick background:

[AI will fill in 2-3 bullet points]

Resume attached. Happy to jump on a quick call.

{{name}}`,
    isDefault: false,
  },
] as const;

export const APPLY_PLATFORMS = [
  "LinkedIn",
  "Indeed",
  "Company Website",
  "Rozee.pk",
  "Email",
  "Referral",
  "Other",
] as const;
