import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { LogoBar } from "@/components/landing/LogoBar";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Modes } from "@/components/landing/Modes";
import { Safety } from "@/components/landing/Safety";
import { Pakistan } from "@/components/landing/Pakistan";
import { Stats } from "@/components/landing/Stats";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQSection } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

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
