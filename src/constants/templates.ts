export const STARTER_TEMPLATES = [
  {
    name: "General Application",
    subject: "Application for {{position}} — {{name}}",
    body: "Hi,\n\nI'm reaching out about the {{position}} opening at {{company}}. My background aligns well with what you're looking for, and I'd love to bring that experience to your team.\n\nI've attached my resume for your review. Would love to chat if you think there's a fit.\n\nBest,\n{{name}}",
  },
  {
    name: "Technical Role",
    subject: "{{position}} — {{name}}",
    body: "Hi there,\n\nI came across the {{position}} role at {{company}} and it caught my attention. I've been working with relevant technologies and have hands-on experience with the skills you're looking for.\n\nMy resume is attached. I'd welcome the chance to discuss how I can contribute to your team.\n\n{{name}}",
  },
  {
    name: "Startup / Casual",
    subject: "Excited about {{position}} at {{company}}",
    body: "Hey team,\n\nThe {{position}} role at {{company}} looks like exactly the kind of challenge I'm looking for. I love what you're building.\n\nI thrive in fast-paced environments where I can wear multiple hats. Resume attached — would love to connect.\n\nCheers,\n{{name}}",
  },
  {
    name: "Referral Mention",
    subject: "{{position}} at {{company}} — Referred by [Referrer]",
    body: "Hi,\n\n[Referrer Name] suggested I reach out regarding the {{position}} position at {{company}}. After learning more about the role, I believe my experience would be a strong fit.\n\nI've attached my resume. Looking forward to the possibility of joining your team.\n\nBest,\n{{name}}",
  },
] as const;

export const TEMPLATE_PLACEHOLDERS = [
  { key: "{{company}}", label: "Company Name" },
  { key: "{{position}}", label: "Position Title" },
  { key: "{{name}}", label: "Your Name" },
  { key: "{{location}}", label: "Job Location" },
  { key: "{{salary}}", label: "Salary" },
] as const;
