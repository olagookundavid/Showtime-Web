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
                'sffl-red': '#C62828',
                red: {
                    50: '#FFEBEE',
                    100: '#FFCDD2',
                    200: '#EF9A9A',
                    300: '#E57373',
                    400: '#EF5350',
                    500: '#C62828',
                    600: '#B71C1C',
                    700: '#A52323',
                    800: '#8B1C1C',
                    900: '#6F1616',
                },
            },
        },
    },
    plugins: [],
}
