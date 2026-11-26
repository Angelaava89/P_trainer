const { colors } = require('./src/constants/theme');

module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
  ],

  presets: [require("nativewind/preset")],

  // En web, NativeWind falla con el modo "media" (el predeterminado):
  // "Cannot manually set color scheme, as dark mode is type 'media'".
  // La app usa colores oscuros fijos y ninguna clase dark:, así que esto no cambia el diseño.
  darkMode: 'class',

  theme: {
    extend: {
      // Tamaños compartidos para que el texto normal se lea bien sin ampliar los iconos.
      fontSize: {
        xs: ['14px', { lineHeight: '20px' }],
        sm: ['16px', { lineHeight: '24px' }],
        base: ['18px', { lineHeight: '26px' }],
        lg: ['20px', { lineHeight: '28px' }],
        xl: ['22px', { lineHeight: '30px' }],
        '2xl': ['26px', { lineHeight: '34px' }],
        '3xl': ['32px', { lineHeight: '38px' }],
        '4xl': ['38px', { lineHeight: '42px' }],
        '5xl': ['48px', { lineHeight: '54px' }],
      },
      colors: {
        azulOscuro: colors.azulOscuro,
        azul:colors.azul,
        carbon:colors.carbon,
        grafito: colors.grafito,
        verde:colors.verde,
        rojo:colors.rojo,
        blanco:colors.blanco,
        azulClaro: colors.azulClaro
      },
      fontFamily: {
      display: ['Bevan_400Regular'],
      serif: ['Vollkorn_400Regular'],
      'serif-bold': ['Vollkorn_700Bold'],
      masthead: ['SundayMasthead-Regular'],   // NUEVO — títulos
      },
    },
  },

  plugins: [],
};
