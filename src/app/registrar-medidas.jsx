import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { colors } from '../constants/theme';
import FondoThomas from '../components/FondoThomas';
import { useMetricas } from '../context/MetricasContext';
import { useAuth } from '../context/AuthContext';
import '../global.css';
import LogoMarca from '../components/LogoMarca';

export default function RegistrarMedidas() {
  const router = useRouter();
  const { agregarMedidas, pesoActual } = useMetricas();
  const { usuario } = useAuth();
  const [guardando, setGuardando] = useState(false);
  // Estas referencias enfocan el campo siguiente cuando el teclado envía la acción "Siguiente".
  const pechoRef = useRef(null);
  const cinturaRef = useRef(null);
  const brazoRef = useRef(null);
  const piernaRef = useRef(null);
  const grasaRef = useRef(null);

  // El peso actual existente se asocia automáticamente a la medición, sin editarlo en este formulario.
  const ultimoPeso = pesoActual ?? usuario?.datos?.pesoActual;
  const [pecho, setPecho] = useState('');
  const [cintura, setCintura] = useState('');
  const [brazo, setBrazo] = useState('');
  const [pierna, setPierna] = useState('');
  // % de grasa corporal (opcional).
  const [grasa, setGrasa] = useState('');

  const registrarMedidas = async () => {
    if (guardando) return; // evita doble toque
    const nuevasMedidas = {
      pecho: Number(pecho.replace(',', '.')),
      cintura: Number(cintura.replace(',', '.')),
      brazo: Number(brazo.replace(',', '.')),
      pierna: Number(pierna.replace(',', '.')),
    };

    const valores = Object.values(nuevasMedidas);

    if (valores.some((valor) => !Number.isFinite(valor) || valor <= 0)) {
      Alert.alert('Medidas inválidas', 'Completa todas las medidas con valores numéricos mayores que cero.');
      return;
    }

    const grasaTexto = grasa.trim();
    const grasaCorporal = grasaTexto ? Number(grasaTexto.replace(',', '.')) : null;
    if (grasaTexto && (!Number.isFinite(grasaCorporal) || grasaCorporal < 2 || grasaCorporal > 70)) {
      Alert.alert('% de grasa inválido', 'Ingresa un porcentaje entre 2 y 70, o déjalo vacío.');
      return;
    }

    setGuardando(true);

    // 1) Guarda la medición completa en medidas[] de Mongo: { fecha, peso, pecho, cintura, brazo, pierna }.
    // El peso se toma del perfil para completar la estructura que ya guarda el servidor.
    const pesoAsociado = Number(ultimoPeso);
    const enServidor = await agregarMedidas({
      ...nuevasMedidas,
      ...(grasaCorporal != null ? { grasaCorporal } : {}),
      ...(Number.isFinite(pesoAsociado) && pesoAsociado > 0 ? { peso: pesoAsociado } : {}),
    });

    // 2) El % de grasa también queda como valor actual en datos.grasaCorporal,
    // para que el trainer (Mis clientes) y el perfil del cliente muestren siempre el último.
    if (enServidor && grasaCorporal != null) {
      try {
        await api('/datos/', { method: 'PATCH', body: { grasaCorporal } });
      } catch {
        // Si falla, la medida igual quedó guardada en el historial.
      }
    }

    // Se guardan en Atlas (lista "medidas" del alumno) y aparecen en Progreso.
    // Si no hay conexión o el perfil no tiene un peso actual, no se registra la medición en el servidor.
    const aviso = enServidor
      ? null
      : 'No se pudieron guardar tus medidas. Revisa la conexión y que tu perfil tenga un peso actual registrado.';

    setGuardando(false);
    if (router.canGoBack()) router.back();
    else router.replace('/progreso');
    if (aviso) Alert.alert('No se guardaron las medidas', aviso);
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_metricas.jpg')} />
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
              Registrar medidas
            </Text>
            <LogoMarca />
          </View>

          <View className="px-5">
            <View className="bg-grafito rounded-2xl p-5">
              <Text className="text-blanco text-xl font-bold">
                Nuevas medidas
              </Text>
              <Text className="text-blanco/50 text-sm mt-2 mb-5">
                Ingresa tus medidas corporales actuales.
              </Text>

              <Text className="text-blanco/60 text-sm mb-2">Pecho</Text>
              <View className="flex-row items-center mb-4">
                <TextInput ref={pechoRef} value={pecho} onChangeText={setPecho} placeholder="Ej: 98" placeholderTextColor="#FFFFFF66" keyboardType="decimal-pad" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => cinturaRef.current?.focus()} className="flex-1 bg-carbon rounded-xl px-4 py-4 text-blanco text-lg" />
                <Text className="text-blanco/50 ml-3">cm</Text>
              </View>

              <Text className="text-blanco/60 text-sm mb-2">Cintura</Text>
              <View className="flex-row items-center mb-4">
                <TextInput ref={cinturaRef} value={cintura} onChangeText={setCintura} placeholder="Ej: 82" placeholderTextColor="#FFFFFF66" keyboardType="decimal-pad" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => brazoRef.current?.focus()} className="flex-1 bg-carbon rounded-xl px-4 py-4 text-blanco text-lg" />
                <Text className="text-blanco/50 ml-3">cm</Text>
              </View>

              <Text className="text-blanco/60 text-sm mb-2">Brazo</Text>
              <View className="flex-row items-center mb-4">
                <TextInput ref={brazoRef} value={brazo} onChangeText={setBrazo} placeholder="Ej: 34" placeholderTextColor="#FFFFFF66" keyboardType="decimal-pad" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => piernaRef.current?.focus()} className="flex-1 bg-carbon rounded-xl px-4 py-4 text-blanco text-lg" />
                <Text className="text-blanco/50 ml-3">cm</Text>
              </View>

              <Text className="text-blanco/60 text-sm mb-2">Pierna</Text>
              <View className="flex-row items-center">
                <TextInput ref={piernaRef} value={pierna} onChangeText={setPierna} placeholder="Ej: 55" placeholderTextColor="#FFFFFF66" keyboardType="decimal-pad" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => grasaRef.current?.focus()} className="flex-1 bg-carbon rounded-xl px-4 py-4 text-blanco text-lg" />
                <Text className="text-blanco/50 ml-3">cm</Text>
              </View>

              <Text className="text-blanco/60 text-sm mb-2 mt-4">% de grasa corporal (opcional)</Text>
              <View className="flex-row items-center">
                <TextInput ref={grasaRef} value={grasa} onChangeText={setGrasa} placeholder="Ej: 18" placeholderTextColor="#FFFFFF66" keyboardType="decimal-pad" returnKeyType="done" blurOnSubmit onSubmitEditing={registrarMedidas} className="flex-1 bg-carbon rounded-xl px-4 py-4 text-blanco text-lg" />
                <Text className="text-blanco/50 ml-3">%</Text>
              </View>

              <TouchableOpacity onPress={registrarMedidas} className="bg-azulClaro rounded-xl py-4 mt-5 items-center">
                <Text className="text-blanco font-bold">Guardar medidas</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
