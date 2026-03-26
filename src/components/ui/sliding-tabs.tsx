"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface TabItem {
  key: string | number
  label: React.ReactNode
  panel?: React.ReactNode
}

interface SlidingTabsProps {
  items: TabItem[]
  defaultIndex?: number
  onChange?: (index: number) => void
  className?: string
}

export function SlidingTabs({ items, defaultIndex = 0, onChange, className }: SlidingTabsProps) {
  const prefersReducedMotion = useReducedMotion()
  const [active, setActive] = React.useState(defaultIndex)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const [indicator, setIndicator] = React.useState<{ left: number; width: number } | null>(null)

  const measure = React.useCallback(() => {
    const container = containerRef.current
    const activeBtn = tabRefs.current[active]
    if (!container || !activeBtn) return setIndicator(null)
    const cRect = container.getBoundingClientRect()
    const tRect = activeBtn.getBoundingClientRect()
    setIndicator({ left: tRect.left - cRect.left, width: tRect.width })
  }, [active])

  React.useEffect(() => {
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure])

  React.useEffect(() => {
    onChange?.(active)
  }, [active, onChange])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((v) => Math.min(v + 1, items.length - 1))
    else if (e.key === "ArrowLeft") setActive((v) => Math.max(v - 1, 0))
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={containerRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="relative inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 backdrop-blur-sm border border-border"
      >
        {indicator && !prefersReducedMotion && (
          <>
            <motion.div
              layout
              initial={false}
              animate={{ left: indicator.left, width: indicator.width }}
              transition={{ type: "spring", stiffness: 250, damping: 30 }}
              className="absolute pointer-events-none rounded-lg"
              style={{ top: 6, height: "calc(100% - 12px)" }}
            >
              <div
                className="absolute inset-0 rounded-lg blur-2xl opacity-30"
                style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
              />
            </motion.div>
            <motion.div
              layout
              initial={false}
              animate={{ left: indicator.left, width: indicator.width }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="absolute pointer-events-none rounded-md bg-primary/90"
              style={{ top: 8, height: "calc(100% - 16px)", mixBlendMode: "screen" }}
            />
          </>
        )}
        {items.map((item, i) => (
          <button
            key={item.key}
            ref={(el) => { tabRefs.current[i] = el }}
            role="tab"
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              "relative z-10 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              i === active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {items.map((item, i) => (
          <div key={item.key} role="tabpanel" hidden={i !== active} className="p-2">
            {item.panel}
          </div>
        ))}
      </div>
    </div>
  )
}
