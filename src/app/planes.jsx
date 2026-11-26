import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Boton_barra from '../components/Boton_barra';
import { formatearPrecio, plans } from '../constants/index';
import { colors } from '../constants/theme';
import '../global.css';
import LogoMarca from '../components/LogoMarca';

// Solo los planes básico y avanzado se ofrecen como opciones de contratación al cliente.
const planesDisponibles = plans.filter((plan) => ['inicial', 'avanzado'].includes(plan.id));

// Presenta los planes trimestrales disponibles para la cuenta del cliente.
export default function Planes() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      {/* El encabezado identifica la sección de planes del cliente. */}
      <View className="px-5 pt-2 pb-3">
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={colors.blanco} />
          </TouchableOpacity>
          <LogoMarca />
        </View>
        <Text className="text-blanco text-xl font-masthead">Planes disponibles</Text>
        <Text className="text-blanco/50 text-sm mt-1">Elige entre el Plan Básico y el Plan Avanzado</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="px-5" style={{ gap: 16 }}>
          {planesDisponibles.map((plan) => (
            <View
              key={plan.id}
              className="rounded-2xl overflow-hidden"
              style={{ borderWidth: 1.5, borderColor: plan.color }}
            >
              {/* La imagen y el degradado distinguen visualmente cada plan disponible. */}
              <View style={{ height: 130 }}>
                <Image source={plan.imagen} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(26,31,41,0.4)', colors.carbon]}
                  style={{ width: '100%', height: '100%', justifyContent: 'flex-end', padding: 14 }}
                >
                  <Text className="text-blanco text-lg font-masthead">{plan.title}</Text>
                </LinearGradient>
              </View>

              <View className="bg-carbon px-4 pt-3 pb-4">
                {/* Las características se cargan del mismo objeto que usa el pago del plan. */}
                {plan.checklist.map((item) => (
                  <View key={item} className="flex-row items-center mb-1.5">
                    <Ionicons name="checkmark" size={14} color={plan.color} />
                    <Text className="text-blanco/70 text-xs ml-2">{item}</Text>
                  </View>
                ))}

                <View className="flex-row items-baseline mt-2">
                  <Text className="text-blanco text-2xl font-bold">{formatearPrecio(plan.precio)}</Text>
                  <Text className="text-blanco/40 text-xs ml-1">/ trimestre</Text>
                </View>
                <Text className="text-blanco/50 text-xs mt-0.5 mb-3">Plan trimestral</Text>

                {/* El identificador mantiene el plan seleccionado al abrir el pago. */}
                <TouchableOpacity
                  className="bg-azulClaro rounded-full py-3 items-center"
                  onPress={() => router.push({ pathname: '/metodo_pago', params: { id: plan.id } })}
                >
                  <Text className="text-blanco text-sm font-bold">Ver plan</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Boton_barra active="planes" />
    </SafeAreaView>
  );
}
