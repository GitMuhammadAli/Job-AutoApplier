"use client";

export function FlowingBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} style={{ zIndex: 0 }}>
      {/* Flowing gradient curves — organic, not mechanical */}
      <div
        className="absolute w-[130%] h-[600px] -top-[200px] -left-[15%] opacity-[0.07] dark:opacity-[0.05]"
        style={{
          background: "linear-gradient(135deg, #10b981 0%, #14b8a6 30%, #06b6d4 60%, #10b981 100%)",
          borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%",
          animation: "morph-blob 20s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute w-[100%] h-[500px] -bottom-[150px] -right-[10%] opacity-[0.05] dark:opacity-[0.04]"
        style={{
          background: "linear-gradient(225deg, #f59e0b 0%, #f97316 40%, #ef4444 70%, #f59e0b 100%)",
          borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
          animation: "morph-blob 25s ease-in-out infinite alternate-reverse",
        }}
      />

      {/* Flowing SVG curves that drift across the section */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none">
        <path
          d="M-100,600 C200,500 400,700 700,550 C1000,400 1200,650 1540,500"
          stroke="url(#curve-grad-1)"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="animate-curve-drift-1"
          opacity="0.15"
        />
        <path
          d="M-100,350 C300,250 500,450 800,300 C1100,150 1300,400 1540,280"
          stroke="url(#curve-grad-2)"
          strokeWidth="1"
          strokeLinecap="round"
          className="animate-curve-drift-2"
          opacity="0.1"
        />
        <path
          d="M-100,750 C250,650 450,800 750,700 C1050,600 1250,750 1540,680"
          stroke="url(#curve-grad-1)"
          strokeWidth="0.8"
          strokeLinecap="round"
          className="animate-curve-drift-3"
          opacity="0.08"
        />
        <defs>
          <linearGradient id="curve-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="30%" stopColor="#10b981" stopOpacity="1" />
            <stop offset="70%" stopColor="#14b8a6" stopOpacity="1" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="curve-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
            <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Keep the named export GlowingOrbs pointing to the new component for backward compat
export { FlowingBackground as GlowingOrbs };
