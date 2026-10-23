/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      colors: {
        brand: {
          50: '#EEF4FC', 100: '#D8E5F7', 200: '#B0CBEF', 300: '#84AEEF', 400: '#4F89D6',
          500: '#2F66B0', 600: '#1F4E79', 700: '#173C5E', 800: '#0F2940', 900: '#081A2B'
        },
        neon: {
          cyan: '#22D3EE', purple: '#A855F7', green: '#10B981', amber: '#F59E0B',
          red: '#EF4444', wechat: '#07C160'
        },
        bg: { 0: '#0A0E1A', 1: '#111827', 2: '#1A2233', 3: '#222B3D' }
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(34,211,238,.35)',
        'glow-purple': '0 0 20px rgba(168,85,247,.35)',
        'glow-blue': '0 0 24px rgba(47,102,176,.45)',
        'card': '0 10px 30px -10px rgba(0,0,0,.5)'
      },
      animation: {
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        'scan': 'scan 2.4s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'neural-dot': 'neuralPulse 1.8s ease-in-out infinite'
      },
      keyframes: {
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(34,211,238,.6)' },
          '100%': { boxShadow: '0 0 0 18px rgba(34,211,238,0)' }
        },
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' }
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        },
        neuralPulse: {
          '0%,100%': { opacity: .3, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.4)' }
        }
      }
    }
  },
  plugins: []
};
