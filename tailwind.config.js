/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        amazon: {
          black: '#131921',
          navy: '#232f3e',
          yellow: '#febd69',
          orange: '#ff9900',
          teal: '#007185',
          gray: '#37475a',
        }
      }
    },
  },
  plugins: [],
}
