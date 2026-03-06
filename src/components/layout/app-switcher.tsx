'use client'

import { useState, useRef, useEffect } from 'react'
import { Grid2X2, Rocket, Radar, ExternalLink, Check, X } from 'lucide-react'

const DEVRADAR_URL = 'https://dev-radar-web-j2jq.vercel.app'

export function AppSwitcher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                   text-sm font-medium border border-slate-200/60 dark:border-zinc-700/60
                   bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800
                   transition-colors duration-150"
        title="Switch app"
      >
        <Grid2X2 className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
        <span className="hidden sm:inline text-xs text-slate-500 dark:text-zinc-400">
          Apps
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 z-50
                        rounded-xl border border-slate-200/60 dark:border-zinc-700/60
                        bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold
                          text-slate-400 dark:text-zinc-500 uppercase tracking-wider
                          border-b border-slate-100 dark:border-zinc-800">
            Switch to
          </div>

          {/* JobPilot — ACTIVE */}
          <div className="flex items-center gap-3 px-3 py-3
                          bg-blue-50/50 dark:bg-blue-950/20 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10
                            flex items-center justify-center flex-shrink-0">
              <Rocket className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                JobPilot
              </div>
              <div className="text-xs text-slate-400 dark:text-zinc-500">
                Auto job applications
              </div>
            </div>
            <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          </div>

          {/* DevRadar — SWITCH TO */}
          <a
            href={DEVRADAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-3
                       hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors duration-150
                       cursor-pointer group"
            onClick={() => setOpen(false)}
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10
                            flex items-center justify-center flex-shrink-0">
              <Radar className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-700 dark:text-zinc-200
                              group-hover:text-purple-500 transition-colors">
                DevRadar
              </div>
              <div className="text-xs text-slate-400 dark:text-zinc-500">
                Market intel & prep
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500
                                     opacity-0 group-hover:opacity-100
                                     transition-opacity flex-shrink-0" />
          </a>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-slate-100 dark:border-zinc-800
                          bg-slate-50/50 dark:bg-zinc-800/30 text-xs text-slate-400 dark:text-zinc-500">
            💡 Same account works on both
          </div>
        </div>
      )}
    </div>
  )
}
