"use client"

import { useEffect, useRef, type RefObject } from "react"

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap<T extends HTMLElement>(active: boolean): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  const prevFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active || !ref.current) return
    prevFocus.current = document.activeElement as HTMLElement
    const container = ref.current
    const els = container.querySelectorAll<HTMLElement>(FOCUSABLE)
    els[0]?.focus()

    const handle = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const items = container.querySelectorAll<HTMLElement>(FOCUSABLE)
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    container.addEventListener("keydown", handle)
    return () => { container.removeEventListener("keydown", handle); prevFocus.current?.focus() }
  }, [active])

  return ref
}
