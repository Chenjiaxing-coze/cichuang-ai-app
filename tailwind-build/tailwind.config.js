/** @type {import('tailwindcss').Config} */
export default {
  content: ['../词创AI_app.html', '../app-config.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Consolas', 'ui-monospace', 'monospace']
      },
      colors: {
        brand: { 50: '#EEF4FC', 100: '#D8E5F7', 200: '#B0CBEF', 300: '#84AEE6', 400: '#4F89D6', 500: '#2F66B0', 600: '#1F4E79', 700: '#173C5E', 800: '#0F2940', 900: '#081A2B' },
        neon: { cyan: '#22D3EE', purple: '#A855F7', green: '#10B981', amber: '#F59E0B', red: '#EF4444', wechat: '#07C160' }
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(34,211,238,.35)',
        'glow-purple': '0 0 20px rgba(168,85,247,.35)',
        'glow-blue': '0 0 24px rgba(47,102,176,.45)',
        'card': '0 10px 30px -10px rgba(0,0,0,.5)'
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        pulseGlow: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.5' } }
      },
      animation: { float: 'float 4s ease-in-out infinite', pulseGlow: 'pulseGlow 2s ease-in-out infinite' }
    }
  },
  plugins: []
};
