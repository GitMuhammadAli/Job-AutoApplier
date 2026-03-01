"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Variant = "fade-up" | "fade-left" | "fade-right" | "zoom" | "flip-up" | "blur-in" | "rotate-in";

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: Variant;
}

const VARIANTS: Record<Variant, { hidden: string; visible: string }> = {
  "fade-up": {
    hidden: "opacity-0 translate-y-10",
    visible: "opacity-100 translate-y-0",
  },
  "fade-left": {
    hidden: "opacity-0 -translate-x-10",
    visible: "opacity-100 translate-x-0",
  },
  "fade-right": {
    hidden: "opacity-0 translate-x-10",
    visible: "opacity-100 translate-x-0",
  },
  zoom: {
    hidden: "opacity-0 scale-90",
    visible: "opacity-100 scale-100",
  },
  "flip-up": {
    hidden: "opacity-0 [transform:perspective(600px)_rotateX(15deg)_translateY(20px)]",
    visible: "opacity-100 [transform:perspective(600px)_rotateX(0deg)_translateY(0)]",
  },
  "blur-in": {
    hidden: "opacity-0 blur-sm scale-95",
    visible: "opacity-100 blur-0 scale-100",
  },
  "rotate-in": {
    hidden: "opacity-0 rotate-3 scale-95",
    visible: "opacity-100 rotate-0 scale-100",
  },
};

export function AnimateOnScroll({ children, className = "", delay = 0, variant = "fade-up" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const v = VARIANTS[variant];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out will-change-transform ${
        visible ? v.visible : v.hidden
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
