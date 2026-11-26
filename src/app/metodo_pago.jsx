import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import { formatearPrecio, plans } from '../constants/index';
import { colors } from '../constants/theme';
import '../global.css';
import { guardarPlanContratado } from '../lib/planesCliente';
import { guardarRutinaComprada, leerCatalogoRutinas, PRECIO_RUTINA } from '../lib/rutinas';


export default function Pago() {
  const router = useRouter();
  const parametros = useLocalSearchParams();
  const id = Array.isArray(parametros.id) ? parametros.id[0] : parametros.id;
  const rutinaId = Array.isArray(parametros.rutinaId) ? parametros.rutinaId[0] : parametros.rutinaId;
  const origen = Array.isArray(parametros.origen) ? parametros.origen[0] : parametros.origen;
  const esMejoraPlan = origen === 'cambio-plan';
  const esBajaNivel = origen === 'baja-nivel';
  const [rutina, setRutina] = useState(null);
  const [cargandoRutina, setCargandoRutina] = useState(Boolean(rutinaId));
  const [procesandoPago, setProcesandoPago] = useState(false); //nuevo

  // La rutina seleccionada se busca en el catálogo para confirmar el producto correcto.
  useEffect(() => {
    if (!rutinaId) {
      setRutina(null);
      setCargandoRutina(false);
      return undefined;
    }

    let activa = true;
    const cargarRutina = async () => {
      setCargandoRutina(true);
      try {
        const catalogo = await leerCatalogoRutinas();
        const encontrada = catalogo.find((item) => String(item.id) === String(rutinaId));
        if (activa) setRutina(encontrada || null);
      } catch (error) {
        if (activa) setRutina(null);
      } finally {
        if (activa) setCargandoRutina(false);
      }
    };

    cargarRutina();
    return () => { activa = false; };
  }, [rutinaId]);

  const esCompraRutina = Boolean(rutinaId);
  const plan = plans.find((p) => p.id === id) ?? plans[0];
  // Foto de fondo según el plan que se muestra: básico -> foto 5, avanzado -> foto 4.
  // Al comprar una rutina (u otro plan) la pantalla queda sin foto.
  const fondoPlan = esCompraRutina
    ? null
    : plan.id === 'inicial'
      ? require('../../assets/images/fondos/fondo_clientes.jpg')
      : plan.id === 'avanzado'
        ? require('../../assets/images/fondos/fondo_registro.jpg')
        : null;
  const tituloRutina = rutina?.nombre || rutina?.titulo || 'Rutina';
  const precio = esCompraRutina ? PRECIO_RUTINA : plan.precio;

  const handlePagar = async () => {
    if (procesandoPago) return; //nuevo

    if (!__DEV__) {
      Alert.alert(
        'Pagos no disponibles',
        'La pasarela de pago todavía no está integrada.'
      );
      return;
    }

    if (
      !esCompraRutina &&
      !plans.some((item) => item.id === id)
    ) {
      Alert.alert(
        'Plan no válido',
        'Vuelve a Planes y Servicios y selecciona un plan.'
      );
      return;
    }

    if (esCompraRutina) {
      if (!rutina) {
        Alert.alert('Rutina no disponible', 'Vuelve al catálogo y selecciona una rutina vigente.');
        return;
      }

      // El simulador desbloquea la rutina local; Mercado Pago confirmará compras reales más adelante.
      try {
        await guardarRutinaComprada(null, rutina.id, rutina);
        router.replace('/home');
      } catch (error) {
        // Muestra el motivo que manda el servidor (por ejemplo, pagos deshabilitados).
        Alert.alert('No se pudo guardar', error?.message || 'Intenta nuevamente para habilitar esta rutina.');
      }
      return;
    }

    // La selección queda asociada a la cuenta activa cuando se confirma el pago de prueba.
    setProcesandoPago(true);

    Alert.alert(
      'Simular pago de suscripción',
      `${plan.title}\n` +
        `${formatearPrecio(plan.precio)} / trimestre\n\n` +
        'Elige el resultado de esta prueba. No se realizará ningún cobro.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            setProcesandoPago(false);
          },
        },
        {
          text: 'Rechazado',
          onPress: () => {
            setProcesandoPago(false);

            Alert.alert(
              'Pago rechazado — prueba',
              'La suscripción anterior se conserva.'
            );
          },
        },
        {
          text: 'Aprobado',
          onPress: async () => {
            try {
              await guardarPlanContratado(plan.id);

              Alert.alert(
                'Pago aprobado — prueba',
                `${plan.title} quedó guardado en tu cuenta.`,
                [
                  {
                    text: 'Continuar',
                    onPress: () => router.replace('/home'),
                  },
                ],
                { cancelable: false }
              );
            } catch (error) {
              Alert.alert(
                'No se pudo guardar la suscripción',
                error?.message || 'Intenta nuevamente.'
              );
            } finally {
              setProcesandoPago(false);
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      {!!fondoPlan && <FondoThomas imagen={fondoPlan} />}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.blanco} />
        </TouchableOpacity>
        <Text numberOfLines={1} className="text-blanco text-xl font-masthead ml-4 flex-1">{esCompraRutina ? 'Comprar rutina' : esMejoraPlan ? 'Mejora tu plan' : esBajaNivel ? 'Baja de nivel tu plan' : 'Contratar plan'}</Text>
        <LogoMarca />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="px-5">
          {esCompraRutina && cargandoRutina ? (
            <ActivityIndicator color={colors.azulClaro} style={{ marginTop: 36 }} />
          ) : esCompraRutina && !rutina ? (
            <View className="bg-grafito rounded-2xl p-5 items-center">
              <Ionicons name="alert-circle-outline" size={32} color={colors.gris} />
              <Text className="text-blanco font-bold mt-3">No encontramos esa rutina</Text>
              <Text className="text-blanco/55 text-sm text-center mt-2">Vuelve al catálogo y elige una rutina disponible.</Text>
            </View>
          ) : (
            <>
              {/* El resumen cambia según se compre una rutina individual o un plan mensual. */}
              <View className="bg-grafito rounded-2xl p-4" style={{ borderWidth: 1.5, borderColor: esCompraRutina ? colors.azulClaro : plan.color }}>
                <Text className="text-blanco text-lg font-masthead mb-2">{esCompraRutina ? tituloRutina : plan.title}</Text>

                {esCompraRutina ? (
                  <View>
                    <Text className="text-blanco/65 text-sm">{rutina.titulo} · Nivel {rutina.nivel.toLowerCase()}</Text>
                    <Text className="text-blanco/55 text-sm mt-1">Enfoque: {rutina.enfoqueRutina}</Text>
                  </View>
                ) : (
                  plan.checklist.map((item) => (
                    <View key={item} className="flex-row items-center mb-1.5">
                      <Ionicons name="checkmark" size={14} color={plan.color} />
                      <Text className="text-blanco/70 text-xs ml-2">{item}</Text>
                    </View>
                  ))
                )}

                <View className="flex-row items-baseline mt-3">
                  <Text className="text-blanco text-2xl font-bold">{formatearPrecio(precio)}</Text>
                  {!esCompraRutina && <Text className="text-blanco/40 text-xs ml-1">/ trimestre</Text>}
                </View>
                {!esCompraRutina && <Text className="text-blanco/50 text-xs mt-0.5">Plan trimestral</Text>}
              </View>

              {/* El botón único queda como punto de entrada a la futura pasarela Mercado Pago. */}
              {__DEV__ && (
              <Text className="text-blanco/60 text-sm text-center mt-6">Modo de prueba: no se realizarán cobros reales.</Text>)}
              <TouchableOpacity className="bg-azulClaro rounded-full py-4 items-center mt-4" onPress={handlePagar}disabled={procesandoPago || !__DEV__}
                style={{opacity: procesandoPago || !__DEV__ ? 0.5 : 1,}}              >
                <Text className="text-blanco text-base font-bold">{procesandoPago ? 'Procesando…' : __DEV__ ? 'Simular pago' : 'Pagos próximamente'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
