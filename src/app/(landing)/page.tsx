import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";

// Fonts come from src/app/layout.tsx via next/font/local:
//   --font-display  = Clash Display
//   --font-body     = General Sans (default body, applied at <body>)
//   --font-mono     = JetBrains Mono
// Read tokens via @/styles/tokens. No raw font names in components.

const Hero = dynamic(() => import("@/components/landing/Hero").then(m => ({ default: m.Hero })), { ssr: true });
const ProblemSolution = dynamic(() => import("@/components/landing/ProblemSolution").then(m => ({ default: m.ProblemSolution })));
const ModulesShowcase = dynamic(() => import("@/components/landing/ModulesShowcase").then(m => ({ default: m.ModulesShowcase })));
const Modes = dynamic(() => import("@/components/landing/Modes").then(m => ({ default: m.Modes })));
const Safety = dynamic(() => import("@/components/landing/Safety").then(m => ({ default: m.Safety })));
const FAQSection = dynamic(() => import("@/components/landing/FAQ").then(m => ({ default: m.FAQSection })));
const CTA = dynamic(() => import("@/components/landing/CTA").then(m => ({ default: m.CTA })));
const Footer = dynamic(() => import("@/components/landing/Footer").then(m => ({ default: m.Footer })));

export default async function LandingPage() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // Not authenticated - show landing
  }

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="scroll-smooth">
      <Navbar />
      <main>
        <Hero />
        <ProblemSolution />
        <ModulesShowcase />
        <Modes />
        <Safety />
        <FAQSection />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
