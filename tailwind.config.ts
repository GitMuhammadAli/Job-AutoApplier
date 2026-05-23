import type { Config } from "tailwindcss";
const config: Config = { darkMode: "class", content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: {
	extend: {
		borderRadius: {
			lg: 'var(--radius)',
			md: 'calc(var(--radius) - 2px)',
			sm: 'calc(var(--radius) - 4px)'
		},
		colors: {
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
