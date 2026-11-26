import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import FondoThomas from '../components/FondoThomas';
import { useMetricas } from '../context/MetricasContext';
import '../global.css';
import LogoMarca from '../components/LogoMarca';

export default function RegistrarPeso() {
  const router = useRouter();
  const { agregarPeso } = useMetricas();
  const [peso, setPeso] = useState('');
  const [guardando, setGuardando] = useState(false);

  const registrarPeso = async () => {
    if (guardando) return; // evita doble toque
    const valor = Number(peso.replace(',', '.'));

    if (!Number.isFinite(valor) || valor <= 0) {
      Alert.alert('Peso inválido', 'Ingresa un peso numérico mayor que cero.');
      return;
    }

    setGuardando(true);

    // Guarda el peso en Mongo, en datos.pesoActual (PATCH /api/datos/).
    // Para que quede en el historial con fecha junto a las medidas, se usa "Registrar medidas".
    let aviso = null;
    try {
      await agregarPeso(valor);
    } catch (error) {
      aviso = error?.status === 400
        ? 'Completa primero "Tus métricas" (altura, objetivo y experiencia) para que tu peso se guarde en el servidor.'
        : error?.message ?? 'No se pudo conectar con el servidor.';
    }

    setGuardando(false);
    volverAProgreso();
    if (aviso) Alert.alert('No se pudo actualizar el perfil', aviso);
  };

  // Vuelve a Progreso; si no hay pantalla anterior (por ejemplo, tras recargar la app) la abre
  const volverAProgreso = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/progreso');
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_clientes.jpg')} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          <View className="flex-row items-center px-5 pt-2 pb-5">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={26} color={colors.blanco} />
            </TouchableOpacity>
            <Text numberOfLines={1} className="text-blanco text-lg font-masthead ml-4 flex-1">
              Registrar peso
            </Text>
            <LogoMarca />
          </View>

          <View className="px-5">
            <View className="bg-grafito rounded-2xl p-5">
              <Text className="text-blanco text-xl font-bold">
                Nuevo peso
              </Text>
              <Text className="text-blanco/50 text-sm mt-2 mb-5">
                Ingresa tu peso corporal actual.
              </Text>

              <Text className="text-blanco/60 text-sm mb-2">
                Peso
              </Text>

              <View className="flex-row items-center">
                <TextInput
                  value={peso}
                  onChangeText={setPeso}
                  placeholder="Ej: 77.2"
                  placeholderTextColor="#FFFFFF66"
                  keyboardType="decimal-pad"
                  className="flex-1 bg-carbon rounded-xl px-4 py-4 text-blanco text-lg"
                />
                <Text className="text-blanco/50 ml-3">kg</Text>
              </View>

              <TouchableOpacity
                onPress={registrarPeso}
                className="bg-azulClaro rounded-xl py-4 mt-5 items-center"
              >
                <Text className="text-blanco font-bold">
                  {guardando ? 'Guardando...' : 'Guardar peso'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
