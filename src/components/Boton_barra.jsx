import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { usePlanContratado, useRutinasCompradas } from '../lib/planesCliente';

export default function Boton_barra({ active }) {
  const router = useRouter();
  const { planId, esPlanBasico, cargandoPlan } = usePlanContratado();
  const { tieneRutinasCompradas, cargandoRutinas } = useRutinasCompradas();
  const mostrarMiRutina = esPlanBasico || planId === 'avanzado';
  const mostrarRutinasIndividuales = !cargandoPlan && !planId && tieneRutinasCompradas;
  // Las compras individuales sin plan usan la navegación para sus rutinas, sin la pestaña de progreso.
  const mostrarProgreso = Boolean(planId) || (!cargandoPlan && !cargandoRutinas && !tieneRutinasCompradas);

  // Los planes tienen su pestaña Mi rutina; las cuentas de compra individual ven sus compras en Mis rutinas.
  const tabs = [
    { key: 'inicio', label: 'Inicio', icon: 'home', route: 'home' },
    mostrarMiRutina
      ? { key: 'rutina', label: 'Mi rutina', icon: 'barbell', route: 'rutina' }
      : mostrarRutinasIndividuales
        ? { key: 'mis-rutinas', label: 'Mis rutinas', icon: 'barbell', route: { pathname: '/comprar_rutinas', params: { vista: 'mis-rutinas' } } }
        : { key: 'planes', label: 'Planes', icon: 'pricetags', route: 'planes' },
    ...(mostrarProgreso ? [{ key: 'progreso', label: 'Progreso', icon: 'stats-chart', route: 'progreso' }] : []),
    { key: 'mas', label: 'Perfil', icon: 'menu', route: 'perfil' },
  ];

  // Si un acceso no está disponible para esta cuenta, Inicio conserva el estado activo.
  const pestañaActiva = active === 'rutina' && !mostrarMiRutina ? 'inicio' : active;

  // El área segura mantiene estas pestañas por encima de los controles del sistema móvil.
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.carbon }}>
      {/* border-t separa la barra del contenido; px-2 distribuye las cuatro pestañas. */}
      <View className="flex-row bg-carbon border-t border-grafito pt-2 pb-2 px-2">
        {tabs.map((tab) => {
          const isActive = tab.key === pestañaActiva;
          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              className="flex-1 items-center"
              onPress={() => router.push(tab.route)}
            >
              {/* El icono relleno y el azul identifican la pestaña seleccionada. */}
              <Ionicons
                name={isActive ? tab.icon : `${tab.icon}-outline`}
                size={22}
                color={isActive ? colors.azulClaro : colors.blanco}
                style={{ opacity: isActive ? 1 : 0.4 }}
              />
              <Text className={`text-[14px] mt-1 ${isActive ? 'text-azulClaro' : 'text-blanco/40'}`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
