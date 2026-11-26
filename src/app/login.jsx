import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import '../global.css';
import { destinoDeSesion } from '../lib/destinoSesion';
import LogoMarca from '../components/LogoMarca';
import FondoThomas from '../components/FondoThomas';

// Inicio de sesión compartido; después de autenticar, el rol define si abre la app o el panel admin.
export default function Login() {
  const router = useRouter();
  const { iniciarSesion } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async () => {
    const email = correo.trim().toLowerCase();
    if (!email || !password) {
      Alert.alert('Completa los campos', 'Ingresa tu correo y contraseña.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }
    if (enviando) return;

    // Solo se entra con una sesión confirmada por Django. Antes, si el servidor fallaba y la
    // contraseña coincidía con una copia guardada en el teléfono, se entraba sin token.
    let respuesta;
    try {
      setEnviando(true);
      respuesta = await iniciarSesion({ correo: email, password });
    } catch (fallo) {
      setEnviando(false);
      Alert.alert(
        fallo.status ? 'Datos incorrectos' : 'No se pudo conectar',
        fallo.message || 'Revisa tu correo y contraseña o intenta nuevamente.'
      );
      return;
    }

    try {
      router.replace(await destinoDeSesion(respuesta));
    } catch (error) {
      Alert.alert('No se pudo iniciar sesión', 'Inténtalo nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_login.jpg')} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-3">
          <View className="flex-row items-center justify-between mb-8">
            <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Volver">
              <Ionicons name="chevron-back" size={26} color={colors.blanco} />
            </TouchableOpacity>
            <LogoMarca conSalida={false} />
          </View>
          <Text className="text-blanco text-3xl font-masthead">Inicia sesión</Text>
          <Text className="text-blanco/50 text-sm mt-2 mb-8">Bienvenido de vuelta a Classic Physique</Text>

          <View className="flex-row items-center bg-grafito rounded-xl px-4 mb-4" style={{ height: 52 }}>
            <Ionicons name="mail-outline" size={18} color={colors.blanco} />
            <TextInput value={correo} onChangeText={setCorreo} placeholder="Correo electrónico" placeholderTextColor="#FFFFFF66" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} className="text-blanco text-sm ml-3 flex-1" />
          </View>
          <View className="flex-row items-center bg-grafito rounded-xl px-4" style={{ height: 52 }}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.blanco} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Contraseña" placeholderTextColor="#FFFFFF66" secureTextEntry className="text-blanco text-sm ml-3 flex-1" />
          </View>
          <TouchableOpacity onPress={() => Alert.alert('Recuperar contraseña', 'La recuperación de contraseña no está conectada en este prototipo.')} className="items-end mt-3">
            <Text className="text-azulClaro text-xs">¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={entrar} disabled={enviando} className="bg-azulClaro rounded-xl py-4 items-center mt-6" style={{ opacity: enviando ? 0.6 : 1 }}>
            <Text className="text-blanco font-bold">{enviando ? 'Ingresando…' : 'Iniciar sesión'}</Text>
          </TouchableOpacity>
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-[1px] bg-grafito" />
            <Text className="text-blanco/40 text-xs mx-3">o continúa con</Text>
            <View className="flex-1 h-[1px] bg-grafito" />
          </View>
          <View className="flex-row justify-center" style={{ gap: 16 }}>
            {['google', 'apple', 'facebook'].map((proveedor) => (
              <TouchableOpacity key={proveedor} onPress={() => Alert.alert('Acceso no disponible', `El inicio con ${proveedor} es solo visual en este prototipo.`)} className="bg-grafito rounded-full items-center justify-center" style={{ width: 48, height: 48 }}>
                <Ionicons name={`logo-${proveedor}`} size={20} color={colors.blanco} />
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row justify-center mt-8">
            <Text className="text-blanco/50 text-sm">¿No tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.push('/registro')}>
              <Text className="text-azulClaro text-sm font-bold">Regístrate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
