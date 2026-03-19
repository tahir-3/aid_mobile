/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#FF6F20',
        background: '#090E14',
        surface: '#12181F',
        card: '#161B22',
        success: '#10B981',
        warning: '#D97706',
        error: '#991B1B',
      },
    },
  },
  plugins: [],
};
