import type { Config } from "tailwindcss";
const config: Config = { darkMode: "class", content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: {
	extend: {
		fontFamily: {
			display: ['var(--font-display)', 'Fraunces', 'Georgia', 'serif'],
			body: ['var(--font-body)', 'Geist', 'system-ui', 'sans-serif'],
			mono: ['var(--font-mono)', 'JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
			sans: ['var(--font-body)', 'Geist', 'system-ui', 'sans-serif'],
			serif: ['var(--font-display)', 'Fraunces', 'Georgia', 'serif'],
		},
		borderRadius: {
			lg: 'var(--radius)',
			md: 'calc(var(--radius) - 2px)',
			sm: 'calc(var(--radius) - 4px)',
			// Soft warm radii — bias up for breathing
			xl: '20px',
			'2xl': '28px',
			'3xl': '36px',
		},
		boxShadow: {
			// Warm multi-layer shadows — use these instead of default Tailwind shadows
			'soft-sm': '0 1px 2px rgba(68, 64, 60, 0.04), 0 1px 1px rgba(68, 64, 60, 0.03)',
			'soft-md': '0 1px 3px rgba(68, 64, 60, 0.05), 0 4px 12px rgba(68, 64, 60, 0.06), 0 0 0 1px rgba(68, 64, 60, 0.03)',
			'soft-lg': '0 1px 4px rgba(68, 64, 60, 0.04), 0 8px 24px rgba(68, 64, 60, 0.08), 0 16px 48px rgba(68, 64, 60, 0.06)',
			'soft-xl': '0 2px 6px rgba(68, 64, 60, 0.06), 0 16px 40px rgba(68, 64, 60, 0.10), 0 32px 64px rgba(68, 64, 60, 0.08)',
			'focus-emerald': '0 0 0 4px rgba(16, 185, 129, 0.12)',
			'focus-red': '0 0 0 4px rgba(225, 29, 72, 0.12)',
		},
		transitionDuration: {
			fast: '250ms',  // overrides default 250ms; semantic alias
			base: '400ms',  // semantic alias
			slow: '600ms',
		},
		transitionTimingFunction: {
			'soft-out': 'cubic-bezier(0.16, 1, 0.3, 1)',     // expo-out — organic
			'soft-inout': 'cubic-bezier(0.65, 0, 0.35, 1)',  // smooth sine
		},
		keyframes: {
			'pulse-soft': {
				'0%, 100%': { opacity: '1' },
				'50%': { opacity: '0.65' },
			},
			'scale-fade-in': {
				from: { opacity: '0', transform: 'scale(0.98)' },
				to: { opacity: '1', transform: 'scale(1)' },
			},
			'stagger-fade-in': {
				from: { opacity: '0', transform: 'translateY(8px)' },
				to: { opacity: '1', transform: 'translateY(0)' },
			},
			'slide-up': {
				from: { opacity: '0', transform: 'translateY(16px)' },
				to: { opacity: '1', transform: 'translateY(0)' },
			},
			'slide-in-right': {
				from: { opacity: '0', transform: 'translateX(16px)' },
				to: { opacity: '1', transform: 'translateX(0)' },
			},
		},
		animation: {
			'pulse-soft': 'pulse-soft 1800ms cubic-bezier(0.65, 0, 0.35, 1) infinite',
			'scale-fade-in': 'scale-fade-in 400ms cubic-bezier(0.16, 1, 0.3, 1)',
			'stagger-fade-in': 'stagger-fade-in 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
			'slide-up': 'slide-up 400ms cubic-bezier(0.16, 1, 0.3, 1)',
			'slide-in-right': 'slide-in-right 400ms cubic-bezier(0.16, 1, 0.3, 1)',
		},
		colors: {
			// ── WARM neutrals — overrides default zinc with stone-warm palette
			// All `bg-zinc-*`, `text-zinc-*`, `border-zinc-*` classes now render warm.
			zinc: {
				50:  '#fafaf7',   // warm off-white — page bg
				100: '#f5f3ef',   // subtle surface
				200: '#e7e3dc',   // borders
				300: '#d4cdc0',   // dividers
				400: '#a8a094',   // metadata text
				500: '#78716c',   // secondary
				600: '#57534e',   // body secondary
				700: '#44403c',   // body primary (not max-contrast)
				800: '#292524',   // emphasized
				900: '#1c1917',   // deepest — sparing use
				950: '#0c0a09',
			},
			// Stone alias — same as zinc for explicit semantic use
			stone: {
				50:  '#fafaf7',
				100: '#f5f3ef',
				200: '#e7e3dc',
				300: '#d4cdc0',
				400: '#a8a094',
				500: '#78716c',
				600: '#57534e',
				700: '#44403c',
				800: '#292524',
				900: '#1c1917',
				950: '#0c0a09',
			},
			// ── Organic emerald (desaturated, healthier)
			emerald: {
				50:  '#ecfdf5',
				100: '#d1fae5',
				200: '#a7f3d0',
				300: '#6ee7b7',
				400: '#34d399',
				500: '#10b981',  // primary CTA — desaturated
				600: '#059669',  // hover
				700: '#047857',
				800: '#065f46',
				900: '#064e3b',
				950: '#022c22',
			},
			// ── Rose-tinted red (softer destructive)
			rose: {
				500: '#f43f5e',
				600: '#e11d48',
				700: '#be123c',
			},
			background: 'hsl(var(--background))',
			foreground: 'hsl(var(--foreground))',
			card: {
				DEFAULT: 'hsl(var(--card))',
				foreground: 'hsl(var(--card-foreground))'
			},
			popover: {
				DEFAULT: 'hsl(var(--popover))',
				foreground: 'hsl(var(--popover-foreground))'
			},
			primary: {
				DEFAULT: 'hsl(var(--primary))',
				foreground: 'hsl(var(--primary-foreground))'
			},
			secondary: {
				DEFAULT: 'hsl(var(--secondary))',
				foreground: 'hsl(var(--secondary-foreground))'
			},
			muted: {
				DEFAULT: 'hsl(var(--muted))',
				foreground: 'hsl(var(--muted-foreground))'
			},
			accent: {
				DEFAULT: 'hsl(var(--accent))',
				foreground: 'hsl(var(--accent-foreground))'
			},
			destructive: {
				DEFAULT: 'hsl(var(--destructive))',
				foreground: 'hsl(var(--destructive-foreground))'
			},
			border: 'hsl(var(--border))',
			input: 'hsl(var(--input))',
			ring: 'hsl(var(--ring))',
			chart: {
				'1': 'hsl(var(--chart-1))',
				'2': 'hsl(var(--chart-2))',
				'3': 'hsl(var(--chart-3))',
				'4': 'hsl(var(--chart-4))',
				'5': 'hsl(var(--chart-5))'
			},
			// Semantic brand tokens — use these (`bg-brand-500` / `text-success-600`)
			// instead of raw `emerald-X` / `amber-X` so future theme swaps touch
			// one file. Maps directly to the existing Tailwind palette so existing
			// classes keep working.
			brand: {
				50:  '#ecfdf5', // emerald-50
				100: '#d1fae5',
				200: '#a7f3d0',
				300: '#6ee7b7',
				400: '#34d399',
				500: '#10b981',
				600: '#059669',
				700: '#047857',
				800: '#065f46',
				900: '#064e3b',
				950: '#022c22',
			},
			// DevRadar attribution accent — reserved for "From DevRadar" badges.
			// Not for general UI; gate behind explicit feature tags.
			devradar: {
				50:  '#faf5ff', // purple-50
				100: '#f3e8ff',
				500: '#a855f7',
				600: '#9333ea',
				700: '#7e22ce',
			},
			// Status colors
			success: { 500: '#10b981', 600: '#059669', 700: '#047857' },     // emerald
			warning: { 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },     // amber
			danger:  { 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },     // red
			info:    { 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },     // blue
		}
	}
}, plugins: [require("tailwindcss-animate")] };
export default config;
