import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";
import { PageIntro } from "@/components/landing/PageIntro";

const FAQSection = dynamic(() =>
  import("@/components/landing/FAQ").then((m) => ({ default: m.FAQSection })),
);
const CTA = dynamic(() =>
  import("@/components/landing/CTA").then((m) => ({ default: m.CTA })),
);
const Footer = dynamic(() =>
  import("@/components/landing/Footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "FAQ — JobPilot",
  description:
    "Common questions about JobPilot. Is it really free? Will my emails go to spam? Can I use it from Pakistan? Read the answers before signing up.",
};

export default function FAQPage() {
  return (
    <div className="scroll-smooth">
      <Navbar />
      <main>
        <PageIntro
          eyebrow="FAQ"
          title={
            <>
              Answers first.
              <br />
              <span className="text-zinc-400 dark:text-zinc-600">Then sign up.</span>
            </>
          }
          body="The honest answers to the questions you'd ask before trusting a tool with your Gmail and your job hunt. Still missing something? Open an issue on GitHub — we read them."
        />
        <FAQSection />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
