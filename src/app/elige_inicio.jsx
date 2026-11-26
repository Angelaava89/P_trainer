import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import '../global.css';
import LogoMarca from '../components/LogoMarca';
import FondoThomas from '../components/FondoThomas';

// Cada tarjeta conserva el identificador que se usa para continuar el onboarding.
const opcionesInicio = [
  {
    id: 'rutinas',
    icono: 'barbell-outline',
    colorBorde: colors.verde,
    colorAcento: colors.verde, // ícono, línea y flecha en verde
    titulo: 'Comprar rutinas',
    descripcion: 'Elige rutinas individuales y empieza a entrenar a tu ritmo.',
  },
  {
    id: 'basico',
    icono: 'fitness-outline',
    colorBorde: colors.azul,
    titulo: 'Plan básico de entrenamiento',
    descripcion: 'Rutinas personalizadas a tus necesidades. Plan trimestral.',
  },
  {
    id: 'avanzado',
    icono: 'dna', // hélice de ADN (MaterialCommunityIcons; Ionicons no tiene este ícono)
    familiaIcono: 'material',
    colorBorde: colors.rojo,
    colorAcento: colors.rojo, // ícono, línea y flecha en rojo (el plan básico sigue en azul)
    titulo: 'Plan avanzado de entrenamiento',
    descripcion: 'Planificación completa con seguimiento personalizado y nutrición. Plan trimestral.',
  },
];

// Presenta las opciones de inicio cuando la persona ya terminó el registro de sus métricas.
export default function EligeInicio() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Cada opción abre su destino usando las rutas que ya existen en la aplicación.
  const continuarConOpcion = (opcion) => {
    if (opcion.id === 'rutinas') return router.push('/comprar_rutinas');
    if (opcion.id === 'basico') {
      return router.push({ pathname: '/metodo_pago', params: { id: 'inicial' } });
    }
    if (opcion.id === 'avanzado') {
      return router.push({ pathname: '/metodo_pago', params: { id: 'avanzado' } });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_login.jpg')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 28,
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
        }}
      >
        {/* El botón volver y el logo comparten la primera fila del encabezado. */}
        <View className="px-6 pt-2">
          <View className="flex-row items-center justify-between mb-5">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Volver al registro"
              onPress={() => router.back()}
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={27} color={colors.blanco} />
            </TouchableOpacity>
            <LogoMarca />
          </View>

          <Text className="text-blanco text-2xl font-masthead">Elige cómo quieres empezar</Text>
          <Text className="text-blanco/70 text-base mt-2">
            Selecciona la opción que mejor se adapte a tus objetivos.
          </Text>
        </View>

        {/* Las tarjetas completas son botones para que la flecha y el texto hagan lo mismo. */}
        <View className="px-5 mt-7" style={{ gap: 16 }}>
          {opcionesInicio.map((opcion) => (
            <TouchableOpacity
              key={opcion.id}
              accessibilityRole="button"
              accessibilityLabel={`${opcion.titulo}. ${opcion.descripcion}`}
              onPress={() => continuarConOpcion(opcion)}
              activeOpacity={0.82}
              className="flex-row items-center rounded-3xl bg-grafito px-4 py-5"
              style={{
                minHeight: Math.max(146, Math.min(190, width * 0.39)),
                borderWidth: 1.5,
                borderColor: opcion.colorBorde,
              }}
            >
              {/* El icono tiene una zona fija para alinear títulos y descripciones. */}
              <View className="items-center justify-center" style={{ width: 72, minHeight: 72 }}>
                {opcion.familiaIcono === 'material' ? (
                  <MaterialCommunityIcons name={opcion.icono} size={45} color={opcion.colorAcento || colors.azulClaro} />
                ) : (
                  <Ionicons name={opcion.icono} size={45} color={opcion.colorAcento || colors.azulClaro} />
                )}
              </View>

              <View className="self-stretch mx-4" style={{ width: 1, backgroundColor: opcion.colorAcento || colors.azulOscuro }} />

              {/* El texto usa el espacio flexible para ajustarse a móviles angostos. */}
              <View className="flex-1" style={{ minWidth: 0 }}>
                <Text className="text-blanco text-lg font-bold" style={{ lineHeight: 26 }}>
                  {opcion.titulo}
                </Text>
                <Text className="text-blanco/75 text-sm mt-1" style={{ lineHeight: 21 }}>
                  {opcion.descripcion}
                </Text>
              </View>

              {/* La flecha indica que cada fila lleva directamente a la siguiente parte. */}
              <Ionicons name="chevron-forward" size={28} color={opcion.colorAcento || colors.azulClaro} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ))}
        </View>

        {/* La selección solo guía la navegación y no crea campos nuevos en la base de datos. */}
        <Text className="text-blanco/65 text-sm text-center mt-auto px-7 pt-8">
          Puedes cambiar tu elección más adelante.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
