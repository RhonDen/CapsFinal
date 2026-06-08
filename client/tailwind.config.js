/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        maastricht: '#0C243D',
        police: '#27496A',
        'silver-lake': '#5C8EB4',
        'wild-blue': '#9AB7CD',
        periwinkle: '#C1D1DB',
        pearl: '#F7FAFC',
        seafoam: '#D7EEE9',
        mist: '#E6EFF6',
        apricot: '#F4E0C8',
        glacier: '#6FAEC7',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Cormorant Garamond', 'serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'panel-in': {
          '0%': { opacity: '0', transform: 'translateY(22px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'float-soft': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.55s ease-out',
        'panel-in': 'panel-in 0.4s ease-out',
        'float-soft': 'float-soft 4.5s ease-in-out infinite',
        shimmer: 'shimmer 8s linear infinite',
      },
    },
  },
  plugins: [],
};
