/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./App.web.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
    extend: {
      colors: {
        // Grumo Brand Colors
        grumo: {
          pink: '#FF4F6F',
          magenta: '#C13BFF',
          purple: '#6A34FF',
          violet: '#4A34FF',
          light: '#EDEDED',
          dark: '#0D0D12',
          // Gradients helpers
          50: '#fdf2f4',
          100: '#fce7eb',
          200: '#f9d0d9',
          300: '#f4a8ba',
          400: '#ed7494',
          500: '#FF4F6F',
          600: '#C13BFF',
          700: '#6A34FF',
          800: '#4A34FF',
          900: '#0D0D12',
        }
      },
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
      },
      backgroundImage: {
        'grumo-gradient': 'linear-gradient(135deg, #FF4F6F 0%, #C13BFF 50%, #6A34FF 100%)',
        'grumo-gradient-reverse': 'linear-gradient(135deg, #6A34FF 0%, #C13BFF 50%, #FF4F6F 100%)',
        'grumo-gradient-vertical': 'linear-gradient(180deg, #FF4F6F 0%, #4A34FF 100%)',
      }
    },
  },
  plugins: [],
}
