import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";
import { PageIntro } from "@/components/landing/PageIntro";

const HowItWorks = dynamic(() =>
  import("@/components/landing/HowItWorks").then((m) => ({ default: m.HowItWorks })),
);
const CTA = dynamic(() =>
  import("@/components/landing/CTA").then((m) => ({ default: m.CTA })),
);
const Footer = dynamic(() =>
  import("@/components/landing/Footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "How it works — JobPilot",
  description:
    "Sign up · upload resume · let JobPilot find, score, draft, and send. Four steps from zero to sent applications.",
};

export default function HowItWorksPage() {
  return (
    <div className="scroll-smooth">
      <Navbar />
      <main>
        <PageIntro
          eyebrow="How it works"
          title={
            <>
              Four steps.
              <br />
              <span className="text-zinc-400 dark:text-zinc-600">Zero spreadsheets.</span>
            </>
          }
          body="Sign in with Google, upload a resume, set your preferences. JobPilot does the rest — scoring jobs against your skills, drafting emails in your voice, sending from your Gmail."
        />
        <HowItWorks />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
