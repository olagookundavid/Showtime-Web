/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Enable dark mode with class strategy
    theme: {
        extend: {
            colors: {
                'sffl-navy': '#001f3f',
                'sffl-red': '#dc2626',
            },
        },
    },
    plugins: [],
}
