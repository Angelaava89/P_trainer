import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import { colors } from '../constants/theme';
import '../global.css';

// nombres en español a mano — evitamos toLocaleString/Intl porque en Hermes
// (el motor de JS de RN) el soporte de locales no siempre viene completo
const meses = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const horarios = ['09:00', '10:00', '11:00', '14:00', '16:00', '17:00'];
const valorParametro = (valor) => (Array.isArray(valor) ? valor[0] : valor);
const fechaISO = (year, mes, dia) => `${year}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

// arma la grilla del mes: un array de 42 casillas (6 semanas x 7 días),
// con null en los espacios antes del día 1 y después del último día
function construirGrilla(year, mes) {
  const primerDiaSemana = new Date(year, mes, 1).getDay(); // 0=domingo
  const offset = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1; // que la semana empiece en lunes
  const diasEnMes = new Date(year, mes + 1, 0).getDate();

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

export default function Agendar() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const citaId = valorParametro(params.asesoriaId) || '';
  const notificacionId = valorParametro(params.notificacionId) || '';
  const hoy = new Date();
  const hoyISO = fechaISO(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12);
  const [fechaVisible, setFechaVisible] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12));
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoyISO);
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  // horas ya tomadas por cualquier cliente (vienen de Atlas, sin nombres)
  const [agenda, setAgenda] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const year = fechaVisible.getFullYear();
  const mes = fechaVisible.getMonth();
  const diaSeleccionado = Number(fechaSeleccionada.slice(-2));
  const celdas = construirGrilla(year, mes);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  useEffect(() => {
    let activo = true;
    const cargarDatos = async () => {
      try {
        const [ocupadas, misAsesorias] = await Promise.all([
          api('/asesorias/ocupadas/'),
          citaId ? api('/asesorias/') : Promise.resolve([]),
        ]);
        if (!activo) return;
        setAgenda(Array.isArray(ocupadas) ? ocupadas : []);
        // si viene desde una notificación de "reagendar", se abre en la fecha de esa asesoría
        const cita = (misAsesorias || []).find((item) => item.id === citaId);
        if (cita) {
          const fechaCita = cita.fecha < hoyISO ? hoyISO : cita.fecha;
          setFechaSeleccionada(fechaCita);
          const [anioCita, mesCita] = fechaCita.split('-').map(Number);
          setFechaVisible(new Date(anioCita, mesCita - 1, 1, 12));
        }
      } catch (error) {
        if (activo) Alert.alert('No se pudieron cargar las Clases Presenciales', error?.message || 'Inténtalo nuevamente.');
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargarDatos();
    return () => { activo = false; };
  }, [citaId]);

  const cambiarMes = (desfase) => {
    const siguiente = new Date(fechaVisible.getFullYear(), fechaVisible.getMonth() + desfase, 1, 12);
    if (siguiente < inicioMesActual) return;
    setFechaVisible(siguiente);
    const vuelveAlMesActual = siguiente.getFullYear() === hoy.getFullYear() && siguiente.getMonth() === hoy.getMonth();
    setFechaSeleccionada(vuelveAlMesActual ? hoyISO : fechaISO(siguiente.getFullYear(), siguiente.getMonth(), 1));
    setHoraSeleccionada('');
  };

  const seleccionarDia = (dia) => {
    const seleccion = fechaISO(year, mes, dia);
    if (seleccion < hoyISO) return;
    setFechaSeleccionada(seleccion);
    setHoraSeleccionada('');
  };

  const mesAnteriorDeshabilitado = new Date(year, mes - 1, 1, 12) < inicioMesActual;

  const horariosOcupados = useMemo(() => new Set(agenda
    .filter((cita) => cita.fecha === fechaSeleccionada && cita.id !== citaId)
    .map((cita) => cita.hora)), [agenda, fechaSeleccionada, citaId]);

  const handleConfirmar = async () => {
    if (!horaSeleccionada) {
      Alert.alert('Selecciona un horario', 'Elige una hora antes de confirmar.');
      return;
    }
    if (guardando) return;

    try {
      setGuardando(true);

      if (citaId) {
        // el cliente pide otro horario para una asesoría que el entrenador reagendó
        await api(`/asesorias/${citaId}/`, { method: 'PATCH', body: { fecha: fechaSeleccionada, hora: horaSeleccionada } });
        if (notificacionId) {
          await api(`/notificaciones/${notificacionId}/`, {
            method: 'PATCH',
            body: { leida: true, resuelta: true, respuesta: 'reagendada' },
          }).catch(() => {});
        }
      } else {
        // nueva reserva: queda en Atlas y le llega un aviso al personal trainer
        await api('/asesorias/', { method: 'POST', body: { fecha: fechaSeleccionada, hora: horaSeleccionada } });
      }

      const mensaje = citaId
        ? 'Tu nuevo horario quedó enviado al personal trainer.'
        : 'Tu solicitud quedó guardada y le llegó un aviso al personal trainer.';
      Alert.alert(citaId ? 'Cambio enviado' : 'Clase Presencial  solicitada', mensaje, [
        { text: 'Continuar', onPress: () => router.replace('/home') },
      ]);
    } catch (error) {
      if (error?.status === 409) {
        Alert.alert('Horario ocupado', 'Ese horario ya fue reservado. Elige otro.');
        api('/asesorias/ocupadas/').then(setAgenda).catch(() => {});
      } else {
        Alert.alert('No se pudo guardar', error?.message || 'Inténtalo nuevamente.');
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_registro.jpg')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* encabezado */}
        <View className="flex-row items-center px-5 pt-2 mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="chevron-back" size={26} color={colors.blanco} />
          </TouchableOpacity>
          <Text numberOfLines={1} className="text-blanco text-xl font-masthead flex-1">{citaId ? 'Reagendar Clase Presencial' : 'Clase Presencial'}</Text>
          <LogoMarca />
        </View>

        {/* calendario */}
        <View className="mx-5 bg-grafito rounded-2xl p-4">
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity accessibilityLabel="Mes anterior" disabled={mesAnteriorDeshabilitado} onPress={() => cambiarMes(-1)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: mesAnteriorDeshabilitado ? 0.25 : 1 }}>
              <Ionicons name="chevron-back" size={20} color={colors.blanco} />
            </TouchableOpacity>
            <Text className="text-blanco text-base font-bold">{meses[mes]} {year}</Text>
            <TouchableOpacity accessibilityLabel="Mes siguiente" onPress={() => cambiarMes(1)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-forward" size={20} color={colors.blanco} />
            </TouchableOpacity>
          </View>

          {/* iniciales de los días */}
          <View className="flex-row mb-2">
            {diasSemana.map((d) => (
              <View key={d} className="flex-1 items-center">
                <Text className="text-blanco/40 text-xs">{d}</Text>
              </View>
            ))}
          </View>

          {/* semanas */}
          {semanas.map((semana, i) => (
            <View key={i} className="flex-row mb-1">
              {semana.map((dia, j) => {
                const esSeleccionado = dia === diaSeleccionado;
                const fechaDia = dia ? fechaISO(year, mes, dia) : '';
                const esPasado = Boolean(dia && fechaDia < hoyISO);
                return (
                  <View key={j} className="flex-1 items-center">
                    {dia ? (
                      <TouchableOpacity
                        disabled={esPasado}
                        onPress={() => seleccionarDia(dia)}
                        accessibilityState={{ selected: esSeleccionado, disabled: esPasado }}
                        className={`items-center justify-center ${esSeleccionado ? 'bg-verde' : ''}`}
                        style={{ width: 32, height: 32, borderRadius: 16, opacity: esPasado ? 0.25 : 1 }}
                      >
                        <Text className={`text-sm ${esSeleccionado ? 'text-blanco font-bold' : esPasado ? 'text-blanco/20' : 'text-blanco/70'}`}>
                          {dia}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ width: 32, height: 32 }} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* horarios disponibles */}
        <View className="px-5 mt-6">
          <Text className="text-blanco/60 text-md mb-3">Horarios disponibles</Text>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {horarios.map((hora) => {
              const esSeleccionada = hora === horaSeleccionada;
              const ocupado = horariosOcupados.has(hora);
              return (
                <TouchableOpacity
                  key={hora}
                  disabled={ocupado || cargando}
                  onPress={() => setHoraSeleccionada(hora)}
                  className={`rounded-xl items-center justify-center ${esSeleccionada ? 'bg-azulClaro' : 'bg-grafito'}`}
                  style={{ width: '30%', height: 50, opacity: ocupado ? 0.4 : 1 }}
                >
                  <Text className={`text-sm ${esSeleccionada ? 'text-blanco font-bold' : 'text-blanco/70'}`}>
                    {hora}
                  </Text>
                  {ocupado && <Text className="text-blanco/60 text-[12px]">Ocupado</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* resumen rápido */}
        {!!horaSeleccionada && (
          <View className="mx-5 mt-6 bg-grafito rounded-xl px-4 py-3">
            <Text className="text-blanco/50 text-xs">Tu Clase Presencial</Text>
            <Text className="text-blanco text-sm mt-1">
              {diaSeleccionado} de {meses[mes]} · {horaSeleccionada}
            </Text>
          </View>
        )}

        <TouchableOpacity
          disabled={!horaSeleccionada || guardando || cargando}
          className={`mx-5 mt-6 rounded-full py-4 items-center ${horaSeleccionada ? 'bg-azulClaro' : 'bg-grafito'}`}
          onPress={handleConfirmar}
        >
          <Text className={`text-base font-bold ${horaSeleccionada ? 'text-blanco' : 'text-blanco/40'}`}>
            {guardando ? 'Guardando…' : citaId ? 'Enviar nuevo horario' : 'Solicitar Clase Presencial'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
