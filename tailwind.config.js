/** @type {import('tailwindcss').Config} */
export default {
  important: true, // needed due to tailwind injection order when importing reactive
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  plugins: [require('@tailwindcss/typography') ],
  presets: [require("@adriansteffan/reactive/tailwind.config.js")],
};
