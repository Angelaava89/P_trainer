import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { irSinHistorial } from '../lib/navegacion';

// Mantiene el cierre de sesión como una acción visible al final de los perfiles de usuario.
export default function BotonCerrarSesion() {
  const router = useRouter();
  const { cerrarSesion } = useAuth();

  // Pide confirmación antes de borrar las credenciales locales y volver al acceso.
  const confirmarSalida = () => {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          // Borra el token y la sesión guardada en el dispositivo.
          await cerrarSesion();
          irSinHistorial(router, '/login');
        },
      },
    ]);
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Cerrar sesión"
      onPress={confirmarSalida}
      className="flex-row items-center justify-center mx-5 mt-5 mb-1 rounded-xl bg-rojo"
      style={{ minHeight: 52, gap: 8 }}
    >
      <Ionicons name="log-out-outline" size={20} color={colors.blanco} />
      <Text className="text-blanco text-sm font-bold">Cerrar sesión</Text>
    </TouchableOpacity>
  );
}
