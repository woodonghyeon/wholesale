import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'SF Mono', 'Monaco', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        accent: {
          DEFAULT: '#007aff',
          hover: '#0066d6',
          light: '#e8f1ff',
        },
        success: '#34c759',
        warning: '#ff9f0a',
        danger: '#ff3b30',
      },
      boxShadow: {
        glass: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        modal: '0 20px 60px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.08)',
        card: '0 1px 4px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}

export default config
