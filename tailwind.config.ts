import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./src/pages/**/*.{ts,tsx}",
		"./src/components/**/*.{ts,tsx}",
		"./src/components1/**/*.{ts,tsx}",
		"./src/components/ui/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				brand: {
					bg: 'var(--bg)',
					surface: 'var(--surface)',
					'surface-alt': 'var(--surface-alt)',
					primary: 'var(--primary)',
					'primary-hover': 'var(--primary-hover)',
					'primary-soft': 'var(--primary-soft)',
					accent: 'var(--accent)',
					'accent-strong': 'var(--accent-strong)',
					text: 'var(--text)',
					'text-muted': 'var(--text-muted)',
					border: 'var(--border)',
					success: 'var(--success)',
					warning: 'var(--warning)',
					danger: 'var(--danger)',
				},
				border: 'var(--border)',
				input: 'var(--border)',
				ring: 'var(--primary-soft)',
				background: 'var(--bg)',
				foreground: 'var(--text)',
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: '#FFFFFF'
				},
				secondary: {
					DEFAULT: 'var(--surface-alt)',
					foreground: 'var(--text)'
				},
				destructive: {
					DEFAULT: 'var(--danger)',
					foreground: '#FFFFFF'
				},
				muted: {
					DEFAULT: 'var(--surface-alt)',
					foreground: 'var(--text-muted)'
				},
				accent: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--text)'
				},
				popover: {
					DEFAULT: 'var(--surface)',
					foreground: 'var(--text)'
				},
				card: {
					DEFAULT: 'var(--surface)',
					foreground: 'var(--text)'
				},
				sidebar: {
					DEFAULT: 'var(--surface-alt)',
					foreground: 'var(--text)',
					primary: 'var(--primary)',
					'primary-foreground': '#FFFFFF',
					accent: 'var(--primary-soft)',
					'accent-foreground': 'var(--text)',
					border: 'var(--border)',
					ring: 'var(--primary-soft)'
				}
			},
			boxShadow: {
				'soft-sm': '0 2px 8px -1px rgba(47, 111, 191, 0.06), 0 1px 3px -1px rgba(47, 111, 191, 0.04)',
				'soft': '0 4px 20px -2px rgba(47, 111, 191, 0.08), 0 2px 6px -1px rgba(47, 111, 191, 0.04)',
				'soft-lg': '0 12px 32px -4px rgba(47, 111, 191, 0.12), 0 4px 12px -2px rgba(47, 111, 191, 0.06)',
				'glow-peach': '0 16px 48px -8px rgba(245, 182, 158, 0.35)',
				'glow-blue': '0 16px 48px -8px rgba(141, 185, 240, 0.30)',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fade-out': {
					'0%': {
						opacity: '1',
						transform: 'translateY(0)'
					},
					'100%': {
						opacity: '0',
						transform: 'translateY(10px)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'fade-out': 'fade-out 0.3s ease-out'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
