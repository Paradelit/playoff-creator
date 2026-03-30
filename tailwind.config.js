export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50:  '#F0FEFF',
          100: '#C8FCFF',
          200: '#90F8FF',
          300: '#48F5FF',
          400: '#00F0FF',  // color principal — neon cyan
          500: '#0AC4E8',
          600: '#1A6FD4',  // botones primarios sobre blanco (contraste WCAG AA)
          700: '#1535A8',  // hover
          800: '#0F1E6B',  // electric indigo-blue
          900: '#0C1440',  // deep electric navy
          950: '#0A0E27',  // midnight electric (nav bar, cabeceras)
        },
        amber: {
          50:  '#FFFCE8',
          100: '#FFF5C0',
          200: '#FFEA80',
          300: '#F7D530',
          400: '#EFBF04',  // amarillo intenso (nav activo, trofeo, final)
          500: '#CC9F00',
          600: '#A67F00',
          700: '#7A5E00',
          800: '#4D3A00',
          900: '#2A2000',
        },
        orange: {
          50:  '#FFF4E8',
          100: '#FFE4C0',
          200: '#FFC980',
          300: '#FFAD40',
          400: '#FF9520',
          500: '#FF8300',  // naranja del club
          600: '#E06A00',
          700: '#B85300',
          800: '#7A3700',
          900: '#3D1C00',
        },
        indigo: {
          50:  '#F0FEFF',
          100: '#C8FCFF',
          200: '#90F8FF',
          300: '#48F5FF',
          400: '#00F0FF',
          500: '#0AC4E8',
          600: '#1A6FD4',
          700: '#1535A8',
          800: '#0F1E6B',
          900: '#0C1440',
        },
      },
    },
  },
  plugins: [],
}