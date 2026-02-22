/**
 * Sends a test application email to your own address so you can see
 * exactly what the recipient (company) receives.
 *
 * Usage: npx tsx src/scripts/test-send-to-self.ts <your-email>
 * Example: npx tsx src/scripts/test-send-to-self.ts ali@alishahid.dev
 */
import { prisma } from "../lib/prisma";
import { getTransporterForUser } from "../lib/email";
import { decryptSettingsFields } from "../lib/encryption";
import { generateApplicationEmail, type GenerateEmailInput } from "../lib/ai-email-generator";

const TEST_USER_ID = "cmlwe8if30000nrkk3ldmjjni";

async function main() {
  const targetEmail = process.argv[2];
  if (!targetEmail || !targetEmail.includes("@")) {
    console.error("Usage: npx tsx src/scripts/test-send-to-self.ts <your-email>");
    process.exit(1);
  }

  console.log(`\nSending test email to: ${targetEmail}\n`);

  const rawSettings = await prisma.userSettings.findUnique({ where: { userId: TEST_USER_ID } });
  if (!rawSettings) throw new Error("Settings not found");
  const settings = decryptSettingsFields(rawSettings);

  const resume = await prisma.resume.findFirst({
    where: { userId: TEST_USER_ID, isDeleted: false, isDefault: true },
    select: { id: true, name: true, content: true, detectedSkills: true, fileUrl: true, fileName: true },
  });
  if (!resume) throw new Error("No default resume found");

  console.log("Resume:", resume.name);
  console.log("Skills:", ((resume.detectedSkills ?? []) as string[]).slice(0, 15).join(", "));

  // Use a real job from the DB as test data
  const userJob = await prisma.userJob.findFirst({
    where: { userId: TEST_USER_ID, isDismissed: false },
    include: { globalJob: true },
    orderBy: { matchScore: "desc" },
  });

  const job = userJob?.globalJob ?? {
    title: "Full Stack Developer (Node.js / React)",
    company: "Test Company Inc.",
    location: "Lahore, Pakistan",
    salary: null,
    skills: ["Node.js", "React", "TypeScript", "PostgreSQL", "Docker"],
    description: "We are looking for a Full Stack Developer with experience in Node.js and React.",
    source: "linkedin",
  };

  console.log("Job:", job.title, "at", job.company);

  const input: GenerateEmailInput = {
    job: {
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      skills: job.skills,
      description: job.description,
      source: job.source,
    },
    profile: {
      fullName: settings.fullName || "Ali Shahid",
      phone: settings.phone,
      experienceLevel: settings.experienceLevel,
      linkedinUrl: settings.linkedinUrl,
      githubUrl: settings.githubUrl,
      portfolioUrl: settings.portfolioUrl,
      includeLinkedin: settings.includeLinkedin,
      includeGithub: settings.includeGithub,
      includePortfolio: settings.includePortfolio,
    },
    resume: {
      name: resume.name,
      content: resume.content,
      detectedSkills: (resume.detectedSkills ?? []) as string[],
    },
    settings: {
      preferredTone: settings.preferredTone,
      emailLanguage: settings.emailLanguage,
      customClosing: settings.customClosing,
      customSystemPrompt: settings.customSystemPrompt,
      defaultSignature: settings.defaultSignature,
    },
    template: null,
  };

  console.log("\nGenerating email...");
  const generated = await generateApplicationEmail(input);

  console.log("\n── SUBJECT ──");
  console.log(generated.subject);
  console.log("\n── BODY ──");
  console.log(generated.body);
  console.log("\n── WORD COUNT ──");
  console.log(generated.body.split(/\s+/).filter(Boolean).length, "words");

  // Check for JSON corruption
  if (generated.body.includes('{"') || generated.body.includes('"}')) {
    console.error("\n!!! WARNING: Body contains JSON braces !!!");
  }

  // Check for LinkedIn/GitHub
  if (settings.linkedinUrl && generated.body.includes(settings.linkedinUrl)) {
    console.log("LinkedIn URL: PRESENT");
  } else if (settings.linkedinUrl) {
    console.log("LinkedIn URL: MISSING (should have been appended)");
  }
  if (settings.githubUrl && generated.body.includes(settings.githubUrl)) {
    console.log("GitHub URL: PRESENT");
  } else if (settings.githubUrl) {
    console.log("GitHub URL: MISSING");
  }

  // Prepare resume attachment
  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  if (resume.fileUrl) {
    try {
      const res = await fetch(resume.fileUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        attachments.push({
          filename: resume.fileName || `${resume.name}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        });
        console.log(`Resume attached: ${resume.fileName || resume.name}.pdf (${buffer.length} bytes)`);
      }
    } catch (err) {
      console.error("Failed to download resume for attachment:", err);
    }
  }

  // Send
  console.log("\nSending...");
  const transporter = getTransporterForUser(settings);
  const fromAddr = `${settings.fullName || "Ali Shahid"} <${settings.applicationEmail || settings.smtpUser}>`;

  const htmlBody = generated.body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb;">$1</a>');

  const result = await transporter.sendMail({
    from: fromAddr,
    to: targetEmail,
    subject: `[TEST] ${generated.subject}`,
    text: generated.body,
    html: htmlBody,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  console.log(`\nSent! MessageId: ${result.messageId}`);
  console.log(`Check your inbox at ${targetEmail}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Failed:", e.message || e);
  process.exit(1);
});
