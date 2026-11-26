import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import '../global.css';
import LogoMarca from '../components/LogoMarca';
import FondoThomas from '../components/FondoThomas';

// ---------- RUT chileno ----------

// Deja solo números y K: "18.456.789-3" -> "184567893"
function limpiarRut(rut) {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

// Al guardar se deja siempre igual: "12345678-5" o "12.345.678-5" -> "12.345.678-5"
// (así Django detecta un RUT repetido aunque se haya escrito distinto; máx. 12 caracteres, como en models.py)
function formatearRut(rut) {
  const limpio = limpiarRut(rut).slice(0, 9);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

// Revisa el dígito verificador (módulo 11)
function rutValido(rut) {
  const limpio = limpiarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === esperado;
}

// ---------- componentes ----------

// un input con ícono a la izquierda — se repite varias veces así que lo armamos una sola vez
function Campo({ icon, placeholder, secureTextEntry, value, onChangeText, onBlur, keyboardType, autoCapitalize, autoCorrect, maxLength }) {
  return (
    <View className="flex-row items-center bg-grafito rounded-xl px-4 mb-4" style={{ height: 50 }}>
      <Ionicons name={icon} size={18} color={colors.blanco} style={{ opacity: 0.5 }} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.4)"
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoComplete={autoCorrect === false ? 'off' : undefined}
        maxLength={maxLength}
        className="text-blanco text-sm ml-3 flex-1"
      />
    </View>
  );
}

export default function Registro() {
  const router = useRouter();
  const { registrar } = useAuth();

  // cuenta
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [edad, setEdad] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');

  const [enviando, setEnviando] = useState(false);

  const handleRegistrarse = async () => {
    if (enviando) return; // evita doble toque

    if (!nombre.trim() || !rut || !edad || !correo.trim() || !password || !confirmar) {
      Alert.alert('Campos obligatorios', 'Completa todos los campos.');
      return;
    }
    if (!rutValido(rut)) {
      Alert.alert('RUT inválido', 'Revisa el RUT y su dígito verificador.');
      return;
    }
    const edadValor = Number(edad);
    if (!Number.isInteger(edadValor) || edadValor < 12 || edadValor > 100) {
      Alert.alert('Edad inválida', 'Ingresa una edad entre 12 y 100 años.');
      return;
    }
    const email = correo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }
    // Mantiene el mínimo de contraseña esperado también por el alta de administradores.
    if (password.length < 8) {
      Alert.alert('Contraseña muy corta', 'Usa al menos 8 caracteres.');
      return;
    }
    if (password !== confirmar) {
      Alert.alert('Las contraseñas no coinciden', 'Revisa ambos campos e inténtalo nuevamente.');
      return;
    }
    // Misma forma que espera UsuarioSerializer en Django.
    // Altura, peso, objetivo y experiencia ("datos") se guardan en la pantalla siguiente.
    const cuenta = {
      nombre: nombre.trim(),
      rut: formatearRut(rut),
      edad: edadValor,
      correo: email,
      password,
    };

    // La cuenta se crea solo en Django. Antes, si el servidor no respondía, se guardaba
    // en el teléfono (con la contraseña en texto plano) y se seguía sin sesión real.
    try {
      setEnviando(true);
      try {
        await registrar(cuenta);
      } catch (fallo) {
        Alert.alert(
          fallo.status ? 'No se pudo crear la cuenta' : 'No se pudo conectar',
          fallo.message || 'Revisa los datos e inténtalo nuevamente.'
        );
        return;
      }

      await AsyncStorage.setItem('ptrainer_usuario_actual', JSON.stringify({ nombre: cuenta.nombre, correo: email }));
      router.push({ pathname: '/registro_metricas', params: { origenRegistro: '1' } });
    } catch (error) {
      Alert.alert('No se pudo crear la cuenta', 'Inténtalo nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_registro.jpg')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View className="px-6 pt-2">
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity onPress={() => router.back()} >
              <Ionicons name="chevron-back" size={26} color={colors.blanco} />
            </TouchableOpacity>
            <LogoMarca conSalida={false} />
          </View>

          <Text className="text-blanco text-2xl font-masthead">Crea tu cuenta</Text>
          <Text className="text-blanco/50 text-sm mt-1 mb-8">Únete y empieza tu transformación</Text>

          {/* ---------- datos de la cuenta ---------- */}
          <Campo icon="person-outline" placeholder="Nombre completo" value={nombre} onChangeText={setNombre} />
          <Campo
            icon="card-outline"
            placeholder="RUT (ej: 12.345.678-5)"
            value={rut}
            onChangeText={setRut}
            // mientras se escribe no se toca nada; al terminar se ponen puntos y guion
            onBlur={() => setRut((actual) => formatearRut(actual))}
            autoCorrect={false}
            autoCapitalize="characters"
            maxLength={12}
          />
          <Campo
            icon="calendar-outline"
            placeholder="Edad"
            value={edad}
            onChangeText={(t) => setEdad(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Campo
            icon="mail-outline"
            placeholder="Correo electrónico"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Campo
            icon="lock-closed-outline"
            placeholder="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          <Campo
            icon="lock-closed-outline"
            placeholder="Confirmar contraseña"
            secureTextEntry
            value={confirmar}
            onChangeText={setConfirmar}
            autoCapitalize="none"
          />

          <TouchableOpacity
            className={`bg-azulClaro rounded-full py-4 items-center mt-6 ${enviando ? 'opacity-50' : ''}`}
            onPress={handleRegistrarse}
            disabled={enviando}
          >
            <Text className="text-blanco text-base font-bold">{enviando ? 'Creando cuenta...' : 'Registrarse'}</Text>
          </TouchableOpacity>

          {/* separador */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-[1px] bg-grafito" />
            <Text className="text-blanco/40 text-xs mx-3">o continúa con</Text>
            <View className="flex-1 h-[1px] bg-grafito" />
          </View>

          {/* social — decorativos por ahora, no hay login real todavía */}
          <View className="flex-row justify-center" style={{ gap: 16 }}>
            <TouchableOpacity onPress={() => Alert.alert('Acceso no disponible', 'Próximamente.')} className="bg-grafito rounded-full items-center justify-center" style={{ width: 48, height: 48 }}>
              <Ionicons name="logo-google" size={20} color={colors.blanco} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Acceso no disponible', 'Próximamente.')} className="bg-grafito rounded-full items-center justify-center" style={{ width: 48, height: 48 }}>
              <Ionicons name="logo-apple" size={20} color={colors.blanco} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Acceso no disponible', 'Próximamente.')} className="bg-grafito rounded-full items-center justify-center" style={{ width: 48, height: 48 }}>
              <Ionicons name="logo-facebook" size={20} color={colors.blanco} />
            </TouchableOpacity>
          </View>

          <Text className="text-blanco/40 text-[14px] text-center mt-8">
            Al registrarte aceptas nuestros{' '}
            <Text className="text-blanco/70 underline">Términos y Condiciones</Text>
          </Text>

          <TouchableOpacity onPress={() => router.push('/login')} className="mt-4 items-center">
            <Text className="text-blanco/70 text-xs">
              ¿Ya tienes cuenta? <Text className="text-azulClaro font-bold">Inicia sesión</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
