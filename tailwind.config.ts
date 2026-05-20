import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      fontFamily: {
        sans: ['Paperlogy', 'Verdana', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Times New Roman"', 'Times', 'serif'],
        num: ['Verdana', 'Geneva', 'sans-serif'],
        en: ['Verdana', 'Geneva', 'sans-serif'],
      },
      letterSpacing: {
        wordmark: '0.22em',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        'xs':  ['12px', '16px'],
        'sm':  ['14px', '20px'],
        'base': ['16px', '24px'],
        'lg':  ['20px', '28px'],
        'xl':  ['24px', '32px'],
        '2xl': ['30px', '36px'],
      },
    },
  },
  plugins: [],
};

export default config;
