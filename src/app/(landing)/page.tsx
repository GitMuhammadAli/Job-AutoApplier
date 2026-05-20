import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import dynamic from "next/dynamic";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import { Navbar } from "@/components/landing/Navbar";

const Hero = dynamic(() => import("@/components/landing/Hero").then(m => ({ default: m.Hero })), { ssr: true });
const ProblemSolution = dynamic(() => import("@/components/landing/ProblemSolution").then(m => ({ default: m.ProblemSolution })));
const ModulesShowcase = dynamic(() => import("@/components/landing/ModulesShowcase").then(m => ({ default: m.ModulesShowcase })));
const Modes = dynamic(() => import("@/components/landing/Modes").then(m => ({ default: m.Modes })));
const Safety = dynamic(() => import("@/components/landing/Safety").then(m => ({ default: m.Safety })));
const FAQSection = dynamic(() => import("@/components/landing/FAQ").then(m => ({ default: m.FAQSection })));
const CTA = dynamic(() => import("@/components/landing/CTA").then(m => ({ default: m.CTA })));
const Footer = dynamic(() => import("@/components/landing/Footer").then(m => ({ default: m.Footer })));

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

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
    <div
      className={`${instrumentSerif.variable} ${dmSans.variable} ${dmSans.className} scroll-smooth`}
    >
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
