/**
 * Pipeline Orchestrator
 * Runs all 4 agents sequentially and passes results forward through the chain.
 * researcher → resume-tailor → email-writer → qa-checker
 */

import { researchCompany, type CompanyResearch } from "./researcher";
import { tailorResume, type TailoredResume } from "./resume-tailor";
import { writeApplicationEmail, type ApplicationEmail } from "./email-writer";
import { checkApplicationQuality, type QAResult } from "./qa-checker";

export interface PipelineInput {
  companyName: string;
  jobDescription: string;
  jobTitle: string;
  userSkills: string[];
  userName: string;
  userEmail: string;
}

export interface PipelineResult {
  companyResearch: CompanyResearch;
  tailoredResume: TailoredResume;
  email: ApplicationEmail;
  qa: QAResult;
}

export async function runApplicationPipeline(
  input: PipelineInput
): Promise<PipelineResult> {
  const { companyName, jobDescription, jobTitle, userSkills, userName, userEmail } = input;

  // Agent 1: Research the company
  console.log(`[Pipeline] Step 1/4: Researching ${companyName}...`);
  const companyResearch = await researchCompany(companyName);

  // Agent 2: Tailor resume to job description
  console.log(`[Pipeline] Step 2/4: Tailoring resume for ${jobTitle}...`);
  const tailoredResume = await tailorResume({
    userSkills,
    jobDescription,
    jobTitle,
  });

  // Agent 3: Write personalized application email using agent 1+2 results
  console.log(`[Pipeline] Step 3/4: Writing application email...`);
  const email = await writeApplicationEmail({
    companyResearch,
    tailoredResume,
    jobTitle,
    companyName,
    jobDescription,
    userName,
    userEmail,
  });

  // Agent 4: QA check the email
  console.log(`[Pipeline] Step 4/4: Running quality check...`);
  const qa = await checkApplicationQuality({
    subject: email.subject,
    body: email.body,
    jobDescription,
    companyName,
  });

  console.log(`[Pipeline] Complete. QA score: ${qa.score}/10, Spam score: ${qa.spamScore}/10`);

  return {
    companyResearch,
    tailoredResume,
    email,
    qa,
  };
}
