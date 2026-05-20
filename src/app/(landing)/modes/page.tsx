import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";
import { PageIntro } from "@/components/landing/PageIntro";

const Modes = dynamic(() =>
  import("@/components/landing/Modes").then((m) => ({ default: m.Modes })),
);
const Safety = dynamic(() =>
  import("@/components/landing/Safety").then((m) => ({ default: m.Safety })),
);
const CTA = dynamic(() =>
  import("@/components/landing/CTA").then((m) => ({ default: m.CTA })),
);
const Footer = dynamic(() =>
  import("@/components/landing/Footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Modes — Manual · Semi-Auto · Full-Auto",
  description:
    "Three apply modes. Manual: you write everything. Semi-Auto: review every email. Full-Auto: JobPilot sends on your behalf. You pick the level of control.",
};

export default function ModesPage() {
  return (
    <div className="scroll-smooth">
      <Navbar />
      <main>
        <PageIntro
          eyebrow="Modes"
          title={
            <>
              Three apply modes.
              <br />
              <span className="text-zinc-400 dark:text-zinc-600">Pick your control.</span>
            </>
          }
          body="Manual writes nothing for you. Semi-Auto drafts and waits for your click. Full-Auto sends in your voice while you sleep. Switch any time, pause any time, the queue is yours."
        />
        <Modes />
        <Safety />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
