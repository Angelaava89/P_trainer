import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import Boton_barra from '../components/Boton_barra';
import FondoThomas from '../components/FondoThomas';
import { colors } from '../constants/theme';
import '../global.css';
import { usePlanContratado, useRutinasCompradas } from '../lib/planesCliente';
import { abrirAppWhatsApp } from '../lib/whatsapp';

// Los accesos se presentan en filas para mantener el mismo formato que el panel profesional.
// "planes": en qué planes aparece cada acceso. Sin "planes" = aparece siempre.
//   Básico:     rutina y progreso (gráficos de medidas y métricas) + perfil en la barra inferior.
//   Avanzado:   agrega nutrición, agendamiento de asesorías y seguimiento por WhatsApp.
const accesos = [
  { icon: 'barbell-outline', label: 'Mi rutina', route: 'rutina' },
  { icon: 'nutrition-outline', label: 'Mi nutrición', route: 'nutricion', planes: ['avanzado'] },
  { icon: 'stats-chart-outline', label: 'Mi progreso', route: 'progreso', requiereProgreso: true },
  { icon: 'calendar-outline', label: 'Agendar Clase Presencial', route: 'agendar', planes: ['avanzado'] },
  { icon: 'logo-whatsapp', label: 'Mensajes WhatsApp', action: 'whatsapp', planes: ['avanzado'] },
];

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { planId, cargandoPlan } = usePlanContratado();
  const { tieneRutinasCompradas, cargandoRutinas } = useRutinasCompradas();
  const mostrarRutinasIndividuales = !cargandoPlan && !cargandoRutinas && !planId && tieneRutinasCompradas;
  // Los compradores individuales ven sus rutinas sin el resumen de medidas y progreso de los planes.
  const mostrarProgreso = Boolean(planId) || (!cargandoPlan && !cargandoRutinas && !tieneRutinasCompradas);
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [notificacionesPendientes, setNotificacionesPendientes] = useState(0);
  const [rutinasNuevas, setRutinasNuevas] = useState([]); // rutinas asignadas que aún no abre

  useFocusEffect(useCallback(() => {
    let activo = true;
    const cargarNotificaciones = async () => {
      try {
        // avisos sin leer guardados en Atlas
        const avisos = await api('/notificaciones/');
        const pendientes = (Array.isArray(avisos) ? avisos : []).filter((aviso) => !aviso.leida).length;
        if (activo) setNotificacionesPendientes(pendientes);
      } catch (error) {
        if (activo) setNotificacionesPendientes(0);
      }
    };
    cargarNotificaciones();

    // rutinas que el entrenador le asignó y que todavía no ha abierto
    api('/mis-rutinas/')
      .then((lista) => activo && setRutinasNuevas((Array.isArray(lista) ? lista : []).filter((r) => !r.vista)))
      .catch(() => activo && setRutinasNuevas([]));

    return () => { activo = false; };
  }, []));

  const WhatsApp = async () => {
    // El aviso conserva la comunicación dentro de la app sin depender de un teléfono guardado.
    api('/avisos/whatsapp/', { method: 'POST' }).catch(() => {});
    await abrirAppWhatsApp();
  };

  useEffect(() => {
    let activo = true;
    const cargarUsuario = async () => {
      try {
        const usuario = await AsyncStorage.getItem('ptrainer_usuario_actual');
        if (activo && usuario) {
          const datos = JSON.parse(usuario);
          const nombre = (datos.nombre || '').trim();
          setNombreUsuario(nombre ? nombre.split(/\s+/)[0] : '');
        }
      } catch (error) {
        if (activo) setNombreUsuario('');
      }
    };
    cargarUsuario();
    return () => { activo = false; };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_bienvenido.jpg')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      >
        {/* El emblema, el logo y las notificaciones se distribuyen en el encabezado. */}
        <View className="flex-row items-center justify-between px-5 pt-2" style={{ position: 'relative' }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={() => router.push('perfil')}>
            <Image source={require('../../assets/images/advertencia.jpg')} style={{ width: 46, height: 46, borderRadius: 23 }} />
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
          <Text className="text-blanco text-2xl font-masthead">
            {`HOLA${nombreUsuario ? `, ${nombreUsuario.toUpperCase()}` : ''}`}
          </Text>
          <Text className="text-blanco/50 text-sm mt-1">
            {mostrarRutinasIndividuales ? 'Tus rutinas compradas, listas para entrenar' : 'Tu progreso y tus planes, en un solo lugar'}
          </Text>
          {__DEV__ && (
            <Text className="text-azulClaro text-sm mt-2">
              {cargandoPlan
                ? 'Consultando suscripción de prueba…'
                : `Suscripción local: ${
                    ({ inicial: 'Básico', avanzado: 'Avanzado' })[planId] || 'Sin suscripción'}`}
            </Text>
          )}
        </View>

        {/* aviso de rutina nueva por empezar */}
        {rutinasNuevas.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/rutina')}
            className="flex-row items-center bg-grafito rounded-2xl p-4 mx-5 mt-6"
            style={{ borderWidth: 1, borderColor: colors.verde }}
          >
            <View className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: `${colors.verde}33` }}>
              <Ionicons name="barbell" size={18} color={colors.verde} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-blanco text-sm font-bold">
                {rutinasNuevas.length === 1 ? 'Tienes una rutina nueva por empezar' : `Tienes ${rutinasNuevas.length} rutinas nuevas por empezar`}
              </Text>
              <Text className="text-blanco/60 text-xs mt-1" numberOfLines={1}>{rutinasNuevas.map((r) => r.titulo).join(', ')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.blanco} style={{ opacity: 0.4 }} />
          </TouchableOpacity>
        )}

        {/* Las compras individuales abren este acceso como Mis rutinas; las demás cuentas conservan Mi rutina. */}
        <View className="px-5 mt-6" style={{ gap: 10 }}>
          {accesos
            .filter((item) => (!item.planes || (!cargandoPlan && item.planes.includes(planId))) && (!item.requiereProgreso || mostrarProgreso))
            .map((item) => (
            <View key={item.label} style={{ gap: 8 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={item.route === 'rutina' && mostrarRutinasIndividuales ? 'Mis rutinas' : item.label}
                activeOpacity={0.82}
                onPress={() => {
                  if (item.action === 'whatsapp') return WhatsApp();
                  if (item.route === 'rutina' && mostrarRutinasIndividuales) {
                    return router.push({ pathname: '/comprar_rutinas', params: { vista: 'mis-rutinas' } });
                  }
                  return router.push(item.route);
                }}
                className="flex-row items-center bg-grafito rounded-xl px-4"
                style={{ minHeight: 56, paddingVertical: 15 }}
              >
                <Ionicons name={item.icon} size={21} color={colors.azulClaro} />
                <Text numberOfLines={1} className="text-blanco text-sm ml-3 flex-1">
                  {item.route === 'rutina' && mostrarRutinasIndividuales ? 'Mis rutinas' : item.label}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.blanco} style={{ opacity: 0.3 }} />
              </TouchableOpacity>

              {item.route === 'rutina' && mostrarRutinasIndividuales && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Comprar más rutinas"
                  activeOpacity={0.82}
                  onPress={() => router.push({ pathname: '/comprar_rutinas', params: { vista: 'biblioteca' } })}
                  className="flex-row items-center rounded-xl px-4"
                  style={{ minHeight: 50, borderWidth: 1, borderColor: colors.azulClaro, backgroundColor: 'rgba(37,117,255,0.08)' }}
                >
                  <Ionicons name="cart-outline" size={20} color={colors.azulClaro} />
                  <Text className="text-azulClaro text-sm font-bold ml-3 flex-1">Comprar más rutinas</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.azulClaro} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <Boton_barra active="inicio" />
    </SafeAreaView>
  );
}
