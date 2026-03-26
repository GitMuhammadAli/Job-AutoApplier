"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useFocusTrap } from "@/hooks/use-focus-trap"

interface SpringModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl"
}

const sizes = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl" }

export function SpringModal({ isOpen, onClose, title, children, size = "md" }: SpringModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              className={`${sizes[size]} relative mx-auto w-full rounded-xl border border-border bg-background p-4 text-foreground shadow-xl sm:p-6`}
              initial={prefersReducedMotion ? false : { scale: 0.96, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 8, opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                {title && <h3 className="text-xl font-medium">{title}</h3>}
                <motion.button
                  className="ml-auto rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none"
                  onClick={onClose}
                  whileHover={prefersReducedMotion ? {} : { rotate: 90 }}
                  transition={{ duration: 0.2 }}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
              <div className="relative">{children}</div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
