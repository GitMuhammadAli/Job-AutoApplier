"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { motion, useReducedMotion } from "framer-motion"

interface AnimatedAlertProps {
  type?: "success" | "error" | "warning" | "info"
  message?: string
  className?: string
}

const typeStyles = {
  success: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
}

export function AnimatedAlert({ type = "info", message = "Alert message.", className }: AnimatedAlertProps) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.div
      className={cn("border px-4 py-3 flex gap-x-2 items-center rounded-xl text-sm", typeStyles[type], className)}
      role="alert"
      initial={prefersReducedMotion ? false : { opacity: 0, filter: "blur(10px)", y: 10 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      <span className="font-semibold capitalize">{type}:</span>
      <span>{message}</span>
    </motion.div>
  )
}
