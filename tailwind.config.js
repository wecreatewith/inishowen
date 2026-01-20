/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,njk,md}"],
  theme: {
    extend: {
      colors: {
        // Primary palette - Wild Atlantic Way teal/blue
        'atlantic': {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Keep ocean for backwards compatibility in templates
        'ocean': {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Warm paper tones
        'paper': {
          50: '#fefdfb',
          100: '#fdf9f3',
          200: '#f9f1e4',
          300: '#f0e4d0',
        },
        // Category colors
        'category': {
          'news': '#134e4a',        // Deep teal
          'council': '#1e3a5f',     // Navy
          'community': '#b45309',   // Amber
          'nature': '#166534',      // Forest green
          'business': '#0f766e',    // Teal
          'events': '#7c3aed',      // Purple
          'tourism': '#0d9488',     // Atlantic teal
        }
      },
      fontFamily: {
        'display': ['"DM Serif Display"', 'Georgia', 'serif'],
        'body': ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '5xl': ['3rem', { lineHeight: '1.1' }],
        '6xl': ['3.75rem', { lineHeight: '1.05' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
          },
        },
      },
    },
  },
  plugins: [],
}
