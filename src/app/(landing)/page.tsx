import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import { Navbar } from "@/components/landing/Navbar";

const Hero = dynamic(() => import("@/components/landing/Hero").then(m => ({ default: m.Hero })), { ssr: true });
const LogoBar = dynamic(() => import("@/components/landing/LogoBar").then(m => ({ default: m.LogoBar })), { ssr: true });
const ProblemSolution = dynamic(() => import("@/components/landing/ProblemSolution").then(m => ({ default: m.ProblemSolution })));
const Features = dynamic(() => import("@/components/landing/Features").then(m => ({ default: m.Features })));
const HowItWorks = dynamic(() => import("@/components/landing/HowItWorks").then(m => ({ default: m.HowItWorks })));
const Modes = dynamic(() => import("@/components/landing/Modes").then(m => ({ default: m.Modes })));
const Safety = dynamic(() => import("@/components/landing/Safety").then(m => ({ default: m.Safety })));
const Pakistan = dynamic(() => import("@/components/landing/Pakistan").then(m => ({ default: m.Pakistan })));
const Stats = dynamic(() => import("@/components/landing/Stats").then(m => ({ default: m.Stats })));
const Testimonials = dynamic(() => import("@/components/landing/Testimonials").then(m => ({ default: m.Testimonials })));
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
    session = await getServerSession();
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
        <LogoBar />
        <ProblemSolution />
        <Features />
        <HowItWorks />
        <Modes />
        <Safety />
        <Pakistan />
        <Stats />
        <Testimonials />
        <FAQSection />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
