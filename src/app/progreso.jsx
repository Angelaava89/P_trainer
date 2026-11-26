import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Boton_barra from '../components/Boton_barra';
import LineChart from '../components/LineChart';
import { colors } from '../constants/theme';
import { useMetricas } from '../context/MetricasContext';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { calcularTMB } from '../lib/metabolismo';
import '../global.css';
import { calcularVariacionPeso } from '../metricas/metricas';
import LogoMarca from '../components/LogoMarca';
import FondoThomas from '../components/FondoThomas';

const tabs = ['Peso', 'Medidas'];

export default function Progreso() {
  const { pesoHistorial, medidasHistorial, recargar } = useMetricas();
  const variacionPeso = calcularVariacionPeso(pesoHistorial);
  const router = useRouter();
  const [tabActiva, setTabActiva] = useState('Peso');
  const [medidaActiva, setMedidaActiva] = useState('pecho');
  // altura y peso guardados en "Tus métricas" (Atlas), para calcular la tasa metabólica basal
  const [datosFisicos, setDatosFisicos] = useState(null);
  const { usuario } = useAuth();
  useFocusEffect(useCallback(() => {
    let activo = true;
    // Cada vez que se abre Progreso se vuelven a leer las medidas y el peso desde Mongo.
    recargar().catch(() => {});
    api('/datos/')
      .then((datos) => activo && setDatosFisicos(datos))
      .catch(() => activo && setDatosFisicos(null));
    return () => { activo = false; };
  }, []));

  // Tasa metabólica basal con el último peso registrado (o el de "Tus métricas" si aún no hay historial).
  // Solo se muestra: el sexo y la edad los entrega el backend (datos o usuario) cuando estén disponibles.
  const alturaCm = datosFisicos?.altura;
  const pesoParaTmb = pesoHistorial[pesoHistorial.length - 1]?.kg ?? datosFisicos?.pesoActual;
  const tmb = calcularTMB({
    peso: Number(pesoParaTmb),
    altura: Number(alturaCm),
    edad: Number(usuario?.edad),
    sexo: String(datosFisicos?.sexo || usuario?.sexo || '').toLowerCase(),
  });

  const opcionesMedidas = [
    { label: 'Pecho', value: 'pecho' },
    { label: 'Cintura', value: 'cintura' },
    { label: 'Brazo', value: 'brazo' },
    { label: 'Pierna', value: 'pierna' },
  ];

  const datosGraficoMedidas = medidasHistorial.map((medida) => ({
    fecha: medida.fecha,
    kg: medida[medidaActiva],
  }));

  // Peso que tenía la persona cuando registró cada medida. Las medidas nuevas lo traen guardado;
  // para las antiguas se busca el último peso registrado hasta ese día.
  const pesoDeMedida = (medida) => {
    if (Number(medida.peso) > 0) return Number(medida.peso);
    const fechaTexto = String(medida.fechaISO || '');
    const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto);
    const limite = new Date(soloDia ? `${fechaTexto}T23:59:59` : fechaTexto).getTime();
    if (Number.isNaN(limite)) return null;
    const previos = pesoHistorial.filter((p) => new Date(p.fechaISO).getTime() <= limite);
    return previos.length ? Number(previos[previos.length - 1].kg) : null;
  };

  const datosGraficoPeso = medidasHistorial.map((medida) => ({ kg: pesoDeMedida(medida) }));

  // Compara la última medición con la anterior: cuánto cambió la medida y cuánto el peso.
  const medidaNueva = medidasHistorial[medidasHistorial.length - 1];
  const medidaAnterior = medidasHistorial[medidasHistorial.length - 2];
  const pesoNuevoMedida = medidaNueva ? pesoDeMedida(medidaNueva) : null;
  const pesoAnteriorMedida = medidaAnterior ? pesoDeMedida(medidaAnterior) : null;
  const conSigno = (n) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

  const historialFechas = pesoHistorial
    .slice()
    .reverse()
    .map((item) => ({
      fecha: item.fecha,
      kg: `${item.kg} kg`,
    }));

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_progreso.jpg')} />
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.blanco} />
        </TouchableOpacity>
        <Text numberOfLines={1} className="text-blanco text-lg font-masthead ml-4 flex-1">Mi Progreso</Text>
        <LogoMarca />
      </View>

      <View className="flex-row px-5 mb-4" style={{ gap: 8 }}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTabActiva(t)}
            className={`px-5 py-3 rounded-full ${tabActiva === t ? 'bg-azulClaro' : 'bg-grafito'}`}
          >
            <Text className={`text-sm ${tabActiva === t ? 'text-blanco font-bold' : 'text-blanco/50'}`}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {tabActiva === 'Peso' && (
          <View className="px-5">
            <View className="bg-grafito rounded-2xl p-4 flex-row justify-between items-start">
              <View>
                <Text className="text-blanco/50 text-xs">Peso actual</Text>
                <Text className="text-blanco text-3xl font-bold mt-1">
                  {variacionPeso.actual} kg
                </Text>
              </View>
              <View className="items-end">
                <View className="flex-row items-center">
                  <Ionicons
                    name={variacionPeso.diferencia <= 0 ? 'arrow-down' : 'arrow-up'}
                    size={14}
                    color={variacionPeso.diferencia <= 0 ? colors.verde : colors.rojo}
                  />
                  <Text
                    className={`text-sm font-bold ml-1 ${variacionPeso.diferencia <= 0 ? 'text-verde' : 'text-rojo'}`}
                  >
                    {Math.abs(variacionPeso.diferencia).toFixed(1)} kg
                  </Text>
                </View>
                <Text className="text-blanco/40 text-[11px] mt-0.5">en 4 semanas</Text>
                <Text className="text-blanco/40 text-[11px] mt-0.5">
                  {Math.abs(variacionPeso.porcentaje).toFixed(1)}% de cambio
                </Text>
              </View>
            </View>

            {/* Tasa metabólica basal: calorías que el cuerpo usa en reposo */}
            <View
              className="bg-grafito rounded-2xl p-4 mt-4"
              style={{ borderWidth: 1, borderColor: colors.azulClaro }}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-blanco/50 text-xs">Tu tasa metabólica basal</Text>
                  <Text className="text-blanco text-3xl font-bold mt-1">
                    {tmb !== null ? tmb : '--'} <Text className="text-blanco/50 text-sm font-normal">kcal/día</Text>
                  </Text>
                </View>
                <View className="items-end" style={{ flexShrink: 1, marginLeft: 12 }}>
                  <View className="flex-row items-center rounded-full px-3 py-1" style={{ backgroundColor: `${colors.azulClaro}33` }}>
                    <Ionicons name="flame-outline" size={14} color={colors.azulClaro} />
                    <Text className="text-xs font-bold ml-1" style={{ color: colors.azulClaro }}>En reposo</Text>
                  </View>
                  <Text className="text-blanco/40 text-[11px] mt-2 text-right">Calorías que tu cuerpo usa sin actividad</Text>
                </View>
              </View>
            </View>

            <View className="bg-grafito rounded-2xl p-4 mt-4">
              <LineChart data={pesoHistorial} color={colors.verde} height={120} />
              <View className="flex-row justify-between mt-2">
                {pesoHistorial.map((p, i) => (
                  <Text key={`${p.fecha}-${i}`} className="text-blanco/40 text-[11px]" style={{ flex: 1, textAlign: 'center' }}>
                    {p.fecha}
                  </Text>
                ))}
              </View>
            </View>

            {/* El historial muestra cada registro sin controles para cambiarlo desde Progreso. */}
            <Text className="text-blanco/60 text-sm mt-6 mb-2">Historial</Text>
            <View className="bg-grafito rounded-2xl px-4">
              {historialFechas.map((h, i) => (
                <View
                  key={`${h.fecha}-${i}`}
                  className={`flex-row justify-between items-center py-3 ${i !== historialFechas.length - 1 ? 'border-b border-carbon' : ''}`}
                >
                  <Text className="text-blanco/70 text-sm">{h.fecha}</Text>
                  <Text className="text-blanco text-sm">{h.kg}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {tabActiva === 'Medidas' && (
          <View className="px-5">
            <View className="bg-grafito rounded-2xl p-4">
              <Text className="text-blanco text-lg font-bold mb-4">Evolución de medidas</Text>

              <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                {opcionesMedidas.map((opcion) => (
                  <TouchableOpacity
                    key={opcion.value}
                    onPress={() => setMedidaActiva(opcion.value)}
                    className={`px-4 py-2 rounded-full ${medidaActiva === opcion.value ? 'bg-azulClaro' : 'bg-carbon'}`}
                  >
                    <Text className={`text-xs ${medidaActiva === opcion.value ? 'text-blanco font-bold' : 'text-blanco/50'}`}>
                      {opcion.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-blanco/50 text-xs mb-1">
                {opcionesMedidas.find((opcion) => opcion.value === medidaActiva)?.label}
              </Text>
              <Text className="text-blanco text-2xl font-bold mb-3">
                {medidasHistorial.length > 0
                  ? `${medidasHistorial[medidasHistorial.length - 1][medidaActiva]} cm`
                  : '-- cm'}
              </Text>

              {medidasHistorial.length >= 2 ? (
                <>
                  {/* leyenda: línea continua = medida, punteada = peso */}
                  <View className="flex-row mb-2" style={{ gap: 16 }}>
                    <View className="flex-row items-center">
                      <View style={{ width: 14, height: 3, backgroundColor: colors.verde, borderRadius: 2 }} />
                      <Text className="text-blanco/60 text-xs ml-2">
                        {opcionesMedidas.find((opcion) => opcion.value === medidaActiva)?.label} (cm)
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <View style={{ width: 14, height: 3, backgroundColor: colors.azulClaro, borderRadius: 2 }} />
                      <Text className="text-blanco/60 text-xs ml-2">Peso (kg)</Text>
                    </View>
                  </View>
                  <LineChart
                    data={datosGraficoMedidas}
                    color={colors.verde}
                    height={150}
                    serieSecundaria={{ data: datosGraficoPeso, color: colors.azulClaro }}
                  />
                </>
              ) : (
                <Text className="text-blanco/40 text-sm py-6 text-center">
                  Registra al menos dos mediciones para ver tu evolución.
                </Text>
              )}

              <View className="flex-row justify-between mt-2">
                {medidasHistorial.map((medida, i) => (
                  <Text key={`${medida.fecha}-${i}`} className="text-blanco/40 text-[10px]" style={{ flex: 1, textAlign: 'center' }}>
                    {medida.fecha}
                  </Text>
                ))}
              </View>

              {/* antes → ahora: la medida y el peso entre el registro anterior y el último */}
              {!!medidaAnterior && (
                <View className="bg-carbon rounded-xl p-3 mt-4">
                  <Text className="text-blanco/40 text-[11px] mb-2">
                    Desde tu registro anterior ({medidaAnterior.fecha} → {medidaNueva.fecha})
                  </Text>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-blanco/60 text-sm">
                      {opcionesMedidas.find((opcion) => opcion.value === medidaActiva)?.label}
                    </Text>
                    <Text className="text-blanco text-sm">
                      {medidaAnterior[medidaActiva]} → {medidaNueva[medidaActiva]} cm
                      {'  '}
                      <Text style={{ color: colors.verde }}>
                        ({conSigno(Number(medidaNueva[medidaActiva]) - Number(medidaAnterior[medidaActiva]))} cm)
                      </Text>
                    </Text>
                  </View>
                  {pesoAnteriorMedida && pesoNuevoMedida ? (
                    <View className="flex-row justify-between">
                      <Text className="text-blanco/60 text-sm">Peso</Text>
                      <Text className="text-blanco text-sm">
                        {pesoAnteriorMedida} → {pesoNuevoMedida} kg
                        {'  '}
                        <Text style={{ color: colors.azulClaro }}>
                          ({conSigno(pesoNuevoMedida - pesoAnteriorMedida)} kg)
                        </Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={() => router.push('/registrar-medidas')}
              className="bg-azulClaro rounded-2xl py-4 mt-4 items-center"
            >
              <Text className="text-blanco font-bold text-base">Registrar nuevas medidas</Text>
            </TouchableOpacity>

            <View className="bg-grafito rounded-2xl p-5 mt-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-blanco text-xl font-bold">Medidas corporales</Text>
                  <Text className="text-blanco/40 text-xs mt-1">Último registro</Text>
                </View>
                <Ionicons name="body-outline" size={28} color={colors.azulClaro} />
              </View>

              {medidasHistorial.length > 0 && (
                <View className="mt-5">
                  {[
                    ['Pecho', 'pecho'],
                    ['Cintura', 'cintura'],
                    ['Brazo', 'brazo'],
                    ['Pierna', 'pierna'],
                  ].map(([label, key], index, arr) => (
                    <View key={key} className={`flex-row justify-between py-3 ${index !== arr.length - 1 ? 'border-b border-carbon' : ''}`}>
                      <Text className="text-blanco/60">{label}</Text>
                      <Text className="text-blanco font-bold">{medidasHistorial[medidasHistorial.length - 1][key]} cm</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Text className="text-blanco/60 text-sm mt-6 mb-2">Historial de medidas</Text>
            <View className="bg-grafito rounded-2xl px-4">
              {medidasHistorial.slice().reverse().map((medida, i) => (
                <View
                  key={`${medida.fecha}-${i}`}
                  className={`py-4 ${i !== medidasHistorial.length - 1 ? 'border-b border-carbon' : ''}`}
                >
                  <View className="flex-row justify-between mb-3">
                    <Text className="text-blanco font-bold text-sm">{medida.fecha}</Text>
                    {pesoDeMedida(medida) ? (
                      <Text style={{ color: colors.azulClaro }} className="text-sm font-bold">{pesoDeMedida(medida)} kg</Text>
                    ) : null}
                  </View>
                  {[
                    ['Pecho', 'pecho'],
                    ['Cintura', 'cintura'],
                    ['Brazo', 'brazo'],
                    ['Pierna', 'pierna'],
                  ].map(([label, key]) => (
                    <View key={key} className="flex-row justify-between mb-2 last:mb-0">
                      <Text className="text-blanco/50 text-sm">{label}</Text>
                      <Text className="text-blanco text-sm">{medida[key]} cm</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      <Boton_barra active="progreso" />

    </SafeAreaView>
  );
}
