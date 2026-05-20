import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";
import { PageIntro } from "@/components/landing/PageIntro";

const ModulesShowcase = dynamic(() =>
  import("@/components/landing/ModulesShowcase").then((m) => ({ default: m.ModulesShowcase })),
);
const CTA = dynamic(() =>
  import("@/components/landing/CTA").then((m) => ({ default: m.CTA })),
);
const Footer = dynamic(() =>
  import("@/components/landing/Footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Features — JobPilot",
  description:
    "Seven modules — Find Jobs, My Jobs, Resumes, Templates, Applications, Analytics, System Status. Each one runs live below.",
};

export default function FeaturesPage() {
  return (
    <div className="scroll-smooth">
      <Navbar />
      <main>
        <PageIntro
          eyebrow="Features"
          title={
            <>
              Seven modules.
              <br />
              <span className="text-zinc-400 dark:text-zinc-600">Each one runs live.</span>
            </>
          }
          body="Most job-search tools give you one surface. JobPilot owns the whole loop — from scraping a fresh role to landing the reply in your inbox. Scroll to watch every module work."
        />
        <ModulesShowcase />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
