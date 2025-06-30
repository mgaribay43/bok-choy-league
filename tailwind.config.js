/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',    // Include all files inside app/
    './components/**/*.{js,ts,jsx,tsx}',  // Optional if you have components folder
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
