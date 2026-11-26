import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Boton_barra from '../components/Boton_barra';
import { colors } from '../constants/theme';
import { usePlanContratado } from '../lib/planesCliente';
import FondoThomas from '../components/FondoThomas';
import '../global.css';
import { leerCatalogoRutinas, leerRutinasCompradas } from '../lib/rutinas';
import LogoMarca from '../components/LogoMarca';
import { ChipsMusculos, ImagenEjercicio } from '../components/FichaEjercicio';
import { infoEjercicio } from '../lib/ejerciciosInfo';

// Permite consultar los ejercicios de una rutina predeterminada después de comprarla.
export default function RutinaDetalle() {
  const router = useRouter();
  const parametros = useLocalSearchParams();
  const id = Array.isArray(parametros.id) ? parametros.id[0] : parametros.id;
  const { planId, esPlanBasico } = usePlanContratado();
  const pestañaRutinas = esPlanBasico || planId === 'avanzado' ? 'rutina' : 'mis-rutinas';
  const [cargando, setCargando] = useState(true);
  const [cargandoRutina, setCargandoRutina] = useState(true);
  const [comprada, setComprada] = useState(false);
  const [rutina, setRutina] = useState(null);

  // Busca la rutina adquirida en la misma biblioteca predeterminada que ofrece el catálogo.
  useEffect(() => {
    let activa = true;
    setCargandoRutina(true);
    const cargarRutina = async () => {
      try {
        const catalogo = await leerCatalogoRutinas();
        const encontrada = catalogo.find((item) => String(item.id) === String(id));
        if (activa) setRutina(encontrada || null);
      } catch (error) {
        if (activa) setRutina(null);
      } finally {
        if (activa) setCargandoRutina(false);
      }
    };

    cargarRutina();
    return () => { activa = false; };
  }, [id]);

  // El acceso se verifica en el mismo almacenamiento que guarda las compras locales.
  useEffect(() => {
    let activa = true;
    setCargando(true);
    const verificarCompra = async () => {
      try {
        const ids = await leerRutinasCompradas();
        if (activa) setComprada(ids.includes(String(id)));
      } catch (error) {
        if (activa) setComprada(false);
      } finally {
        if (activa) setCargando(false);
      }
    };

    verificarCompra();
    return () => { activa = false; };
  }, [id]);

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={comprada ? ['top'] : ['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_progreso.jpg')} />
      {/* La cabecera mantiene el regreso y muestra el logo a la derecha. */}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.blanco} />
        </TouchableOpacity>
        <Text numberOfLines={1} className="text-blanco text-xl font-masthead ml-4 flex-1">Mi rutina</Text>
        <LogoMarca />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        {cargando || cargandoRutina ? (
          <ActivityIndicator color={colors.azulClaro} style={{ marginTop: 36 }} />
        ) : !rutina ? (
          <View className="bg-grafito rounded-2xl p-5 items-center">
            <Text className="text-blanco font-bold">No encontramos esta rutina</Text>
          </View>
        ) : !comprada ? (
          <View className="bg-grafito rounded-2xl p-5 items-center">
            <Ionicons name="lock-closed-outline" size={32} color={colors.gris} />
            <Text className="text-blanco font-bold mt-3">Rutina bloqueada</Text>
            <Text className="text-blanco/55 text-sm text-center mt-2">Completa la compra para acceder a sus ejercicios.</Text>
            <TouchableOpacity className="bg-azulClaro rounded-full py-3 px-5 mt-4" onPress={() => router.replace('/comprar_rutinas')}>
              <Text className="text-blanco font-bold">Volver al catálogo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* El resumen identifica la rutina comprada, su enfoque, nivel y cantidad de ejercicios. */}
            <View className="bg-grafito rounded-2xl p-4 mb-5" style={{ borderWidth: 1, borderColor: colors.azulOscuro }}>
              <Text className="text-blanco text-2xl font-masthead">{rutina.titulo || 'Mi rutina'}</Text>
              <Text className="text-blanco/70 text-base mt-2">{rutina.enfoqueRutina || rutina.nombre}</Text>
              <View className="flex-row flex-wrap items-center mt-3" style={{ gap: 8 }}>
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(37,117,255,0.18)' }}>
                  <Text className="text-azulClaro text-xs font-bold">NIVEL {String(rutina.nivel || '').toLocaleUpperCase('es-CL')}</Text>
                </View>
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <Text className="text-blanco/75 text-xs font-bold">
                    {(rutina.dias || []).reduce((total, dia) => total + (dia.ejercicios || []).length, 0)} ejercicios
                  </Text>
                </View>
              </View>
              <Text className="text-azulClaro text-sm mt-4">Ejercicios de esta rutina</Text>
            </View>

            {/* Cada ejercicio ocupa su propia tarjeta para facilitar la lectura de la rutina comprada. */}
            {(rutina.dias || []).map((dia) => (
              <View key={dia.nombre} className="mb-2">
                <Text className="text-blanco/55 text-sm font-bold mb-2 px-1">{dia.nombre}</Text>
                {(dia.ejercicios || []).map((ejercicio, indice) => {
                  // Imagen, músculos y en qué consiste (toca la imagen para verla en grande).
                  const info = infoEjercicio(ejercicio.nombre);
                  return (
                    <View key={`${ejercicio.nombre}-${indice}`} className="bg-grafito rounded-2xl p-3 mb-3 flex-row items-center" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                      <ImagenEjercicio nombre={ejercicio.nombre} info={info} tamano={72} />
                      <View className="flex-1" style={{ marginLeft: 12, minWidth: 0 }}>
                        <Text className="text-blanco text-base font-bold">{ejercicio.nombre}</Text>
                        {!!info && <ChipsMusculos musculos={info.musculos} />}
                        <Text className="text-blanco/75 text-sm mt-1">
                          {ejercicio.series} series · {ejercicio.repeticiones} · descanso {ejercicio.descanso}
                        </Text>
                        {!!info && <Text className="text-blanco/55 text-xs mt-1">{info.descripcion}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </ScrollView>
      {comprada && <Boton_barra active={pestañaRutinas} />}
    </SafeAreaView>
  );
}
