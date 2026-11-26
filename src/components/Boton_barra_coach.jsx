import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

// las 4 pestañas del coach (panel profesional). Misma idea que Boton_barra
// pero con las secciones del entrenador en vez de las del cliente.
const tabs = [
  { key: 'inicio', label: 'Inicio', icon: 'home', route: 'panel_profesional' },
  { key: 'clientes', label: 'Clientes', icon: 'people', route: 'clientes' },
  { key: 'perfil', label: 'Perfil', icon: 'menu', route: 'perfil_profesional' },
];

export default function Boton_barra_coach({ active }) {
  const router = useRouter();

  // El área segura mantiene estas pestañas por encima de los controles del sistema móvil.
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.carbon }}>
      {/* border-t separa la barra del contenido; px-2 distribuye las cuatro pestañas. */}
      <View className="flex-row bg-carbon border-t border-grafito pt-3 pb-3 px-2">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
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
                size={28}
                color={isActive ? colors.azulClaro : colors.blanco}
                style={{ opacity: isActive ? 1 : 0.4 }}
              />
              <Text className={`text-[16px] mt-1 ${isActive ? 'text-azulClaro' : 'text-blanco/40'}`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
