import { Bevan_400Regular } from '@expo-google-fonts/bevan'
import { Vollkorn_400Regular, Vollkorn_700Bold } from '@expo-google-fonts/vollkorn'
import { useFonts } from 'expo-font'
import { DarkTheme, Stack, ThemeProvider } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { View } from 'react-native'
import { AuthProvider } from '../context/AuthContext'
import { MetricasProvider } from '../context/MetricasContext'
import { colors } from '../constants/theme'

// Mantiene el fondo de las transiciones alineado con la paleta oscura de la app.
const temaNavegacion = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.carbon,
    card: colors.carbon,
    border: colors.grafito,
    primary: colors.azulClaro,
    text: colors.blanco,
    notification: colors.azulClaro,
  },
}

export default function _layout() {
  const [fontsLoaded] = useFonts({
    Bevan_400Regular, // estilo de letra para que sea classicPhysique
    Vollkorn_400Regular,
    Vollkorn_700Bold,
    'SundayMasthead-Regular': require('../../assets/fonts/SundayMasthead-Regular.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={temaNavegacion}>
    <AuthProvider>
      <MetricasProvider>
        <View style={{ flex: 1, backgroundColor: colors.carbon }}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'none',
              contentStyle: { backgroundColor: colors.carbon },
            }}
          />
        </View>
      </MetricasProvider>
    </AuthProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  )
}
