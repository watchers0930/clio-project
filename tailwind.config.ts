import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1B1F2B',
          light: '#252A38',
          lighter: '#2F3545',
        },
        accent: {
          DEFAULT: '#2E6FF2',
          hover: '#1A5AD9',
        },
        clio: {
          bg: '#F7F8FA',
          border: '#E2E5EA',
          text: '#1B1F2B',
          'text-secondary': '#7C8494',
        },
      },
      fontFamily: {
        sans: ['Paperlogy', 'Verdana', 'system-ui', '-apple-system', 'sans-serif'],
        num: ['Verdana', 'Geneva', 'sans-serif'],
        en: ['Verdana', 'Geneva', 'sans-serif'],
      },
      letterSpacing: {
        wordmark: '0.22em',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
    },
  },
  plugins: [],
};

export default config;
