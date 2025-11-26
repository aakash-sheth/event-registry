import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'eco-beige': '#F5F5DC',
        'eco-green': '#4CAF50',
        'eco-green-light': '#A5D6A7',
        // Pastel & Bright Sustainability Colors from reference
        'pastel-green': '#A8D5BA',
        'bright-teal': '#218085',
        'pastel-cream': '#FFF8E7',
        'bright-coral': '#FF6B6B',
        'pastel-blue': '#C7E9F5',
        'forest-green': '#2D5F3F',
        'sunshine-yellow': '#FFD93D',
        'earth-brown': '#8B6F47',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-reverse': 'float 8s ease-in-out infinite reverse',
        'fade-in-up': 'fadeInUp 1s ease',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'scroll': 'scroll 30s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        fadeInUp: {
          from: {
            opacity: '0',
            transform: 'translateY(30px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
  safelist: [
    'bg-eco-beige',
    'bg-eco-green',
    'bg-eco-green-light',
    'text-eco-green',
    'border-eco-green',
    'border-eco-green-light',
  ],
}
export default config

