/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E8F5FB',
          100: '#D1ECF7',
          200: '#A3D8EF',
          300: '#75C5E7',
          400: '#47B1DF',
          500: '#229ED9', // Telegram Blue
          600: '#1B85B8',
          700: '#166C97',
          800: '#115476',
          900: '#0C3C55',
        },
        neutral: {
          0: '#FFFFFF',
          50: '#F8F9FA',
          100: '#F1F2F4',
          200: '#E6E8EC',
          300: '#D1D4DC',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          850: '#182234',
          900: '#111827',
          950: '#0B0F19',
        },
        success: {
          100: '#DCFCE7',
          500: '#16A34A', // Approved
          600: '#15803D',
          800: '#166534',
        },
        warning: {
          100: '#FEF3C7',
          500: '#F59E0B', // Pending
          600: '#D97706',
          800: '#92400E',
        },
        error: {
          100: '#FEE2E2',
          500: '#EF4444', // Rejected
          600: '#DC2626',
          800: '#991B1B',
        },
        paid: {
          100: '#E0E7FF',
          500: '#6366F1', // Paid (Indigo)
          600: '#4F46E5',
          800: '#3730A3',
        },
      },
    },
  },
  plugins: [],
}
