import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import Boton_barra_coach from '../components/Boton_barra_coach';
import FondoThomas from '../components/FondoThomas';
import { colors } from '../constants/theme';
import '../global.css';
import { CLAVE_ASIGNACIONES } from '../lib/rutinas';

// Las métricas del panel parten en cero y se reemplazan con los datos del entrenador.
const statsVacios = [
  { icon: 'people', valor: '0', label: 'Clientes activos' },
  { icon: 'barbell', valor: '0', label: 'Rutinas asignadas' },
  { icon: 'calendar', valor: '0', label: 'Clases presenciales hoy' },
];

// menú de accesos del panel del coach
const menu = [
  { icon: 'people-outline', label: 'Mis clientes', route: 'clientes' },
  { icon: 'barbell-outline', label: 'Rutinas', route: 'rutinas_coach' },
  { icon: 'fitness-outline', label: 'Ejercicios', route: 'ejercicios_coach' },
  { icon: 'videocam-outline', label: 'Videos', route: 'videos_coach' },
  { icon: 'nutrition-outline', label: 'Nutrición', route: 'asignar_nutricion_coach' },
  { icon: 'calendar-outline', label: 'Calendario de clases presenciales', route: 'agenda_coach' },
  { icon: 'logo-whatsapp', label: ' Mensajes WhatsApp', route: 'mensajes_coach' },
  
];

export default function PanelProfesional() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [nombreUsuario, setNombreUsuario] = useState('Coach');
  const [notificacionesPendientes, setNotificacionesPendientes] = useState(0);
  const [stats, setStats] = useState(statsVacios);

  // avisos sin leer del profesional (reservas, WhatsApp, objetivos, lesiones) desde Atlas
  useFocusEffect(useCallback(() => {
    let activo = true;
    api('/notificaciones/')
      .then((avisos) => {
        if (activo) setNotificacionesPendientes((Array.isArray(avisos) ? avisos : []).filter((a) => !a.leida).length);
      })
      .catch(() => activo && setNotificacionesPendientes(0));

    const cargarResumen = async () => {
      try {
        const [alumnos, asesorias, asignacionesTexto] = await Promise.all([
          api('/alumnos/'),
          api('/asesorias/'),
          AsyncStorage.getItem(CLAVE_ASIGNACIONES),
        ]);
        if (!activo) return;
        const asignaciones = asignacionesTexto ? JSON.parse(asignacionesTexto) : {};
        const totalRutinas = Object.values(asignaciones || {}).reduce(
          (total, lista) => total + (Array.isArray(lista) ? lista.length : 0),
          0,
        );
        const ahora = new Date();
        const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
        const asesoriasHoy = (Array.isArray(asesorias) ? asesorias : []).filter((asesoria) => asesoria.fecha === hoyISO).length;
        setStats([
          { icon: 'people', valor: String(Array.isArray(alumnos) ? alumnos.length : 0), label: 'Clientes activos' },
          { icon: 'barbell', valor: String(totalRutinas), label: 'Rutinas asignadas' },
          { icon: 'calendar', valor: String(asesoriasHoy), label: 'Clases de hoy' },
        ]);
      } catch {
        if (activo) setStats(statsVacios);
      }
    };
    cargarResumen();
    return () => { activo = false; };
  }, []));

  useEffect(() => {
    let activo = true;
    const cargarUsuario = async () => {
      try {
        const guardado = await AsyncStorage.getItem('ptrainer_usuario_actual');
        if (guardado && activo) {
          const datos = JSON.parse(guardado);
          const nombre = (datos.nombre || '').trim().split(/\s+/)[0];
          if (nombre) setNombreUsuario(nombre);
        }
      } catch (error) {
        // Mantener el saludo predeterminado si no hay usuario guardado.
      }
    };
    cargarUsuario();
    return () => { activo = false; };
  }, []);

  // Limita el ancho en tablets para conservar el aspecto de la referencia móvil.
  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_panel_profesional.jpg')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        {/* El emblema, el logo y las notificaciones se distribuyen en el encabezado. */}
        <View className="flex-row items-center justify-between px-5 pt-2" style={{ position: 'relative' }}>
          <TouchableOpacity onPress={() => router.push('/perfil_profesional')}>
            <Image
              source={require('../../assets/images/advertencia.jpg')}
              style={{ width: 46, height: 46, borderRadius: 23 }}
            />
          </TouchableOpacity>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Image
              source={require('../../assets/images/logo_tbtf.png')}
              resizeMode="contain"
              accessibilityLabel="Logo TBTF"
              style={{ width: Math.min(112, width * 0.3), height: 32 }}
            />
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Abrir notificaciones"
            onPress={() => router.push('notificaciones')}
            style={{ width: 44, height: 46, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="notifications-outline" size={27} color={colors.blanco} />
            {notificacionesPendientes > 0 && (
              <View className="absolute items-center justify-center rounded-full bg-rojo" style={{ minWidth: 19, height: 19, top: 0, right: 0, paddingHorizontal: 4 }}>
                <Text className="text-blanco text-[12px] font-bold">{notificacionesPendientes > 9 ? '9+' : notificacionesPendientes}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View className="px-5 mt-3">
          <Text className="text-blanco text-2xl font-masthead">{`HOLA, ${nombreUsuario.toUpperCase()}`}</Text>
          <Text className="text-blanco/50 text-sm mt-1">Gestiona tus clientes y planes</Text>
        </View>

        {/* Resumen compacto con tres métricas y acentos azules. */}
        <View className="flex-row px-5 mt-5" style={{ gap: 10 }}>
          {stats.map((s) => (
            <View
              key={s.label}
              className="flex-1 bg-grafito rounded-2xl items-center py-4"
              style={{ minWidth: 0 }}
            >
              <Ionicons name={s.icon} size={20} color={colors.azulClaro} />
              <Text className="text-blanco text-lg font-bold mt-1">{s.valor}</Text>
              <Text numberOfLines={2} className="text-blanco/40 text-[14px] mt-0.5 text-center">{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Accesos en filas oscuras, con la misma jerarquía visual que el inicio del cliente. */}
        <View className="px-5 mt-6" style={{ gap: 10 }}>
          {menu.map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route)}
              activeOpacity={0.82}
              className="flex-row items-center bg-grafito rounded-xl px-4"
              style={{ minHeight: 56, paddingVertical: 15 }}
            >
              <Ionicons name={item.icon} size={20} color={colors.azulClaro} />
              <Text className="text-blanco text-sm ml-3 flex-1">{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.blanco} style={{ opacity: 0.3 }} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Boton_barra_coach active="inicio" />
    </SafeAreaView>
  );
}
