import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0f766e', dark: '#134e4a' }
      }
    }
  },
  plugins: []
};

export default config;
