
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { api } from '../api/client';
import { escribirleAlCliente } from '../lib/whatsapp';
import '../global.css';
import LogoMarca from '../components/LogoMarca';
import FondoThomas from '../components/FondoThomas';

// Pantalla principal
export default function MensajesCoach() {
  const router = useRouter();

  const [busqueda, setBusqueda] = useState('');

  // Alumnos reales desde Django (GET /api/alumnos/, solo para profesionales)
  const [clientes, setClientes] = useState([]);
  const [aviso, setAviso] = useState('');

  useFocusEffect(useCallback(() => {
    let activo = true;
    api('/alumnos/')
      .then((alumnos) => {
        if (!activo) return;
        setClientes(alumnos);
        setAviso('');
      })
      .catch((error) => {
        if (!activo) return;
        setClientes([]);
        setAviso(
          error.status === 401 || error.status === 403
            ? 'Inicia sesión como profesional para ver a tus clientes.'
            : 'No se pudo conectar con el servidor.'
        );
      });
    return () => { activo = false; };
  }, []));

  // Filtrar clientes por nombre o correo
  const clientesFiltrados = clientes.filter((cliente) => {
    const nombre = String(cliente.nombre || '').toLowerCase();
    const correo = String(cliente.correo || '').toLowerCase();
    const termino = busqueda.trim().toLowerCase();

    return nombre.includes(termino) || correo.includes(termino);
  });

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_rutina.jpg')} />

      {/* Encabezado */}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="chevron-back"
            size={26}
            color={colors.blanco}
          />
        </TouchableOpacity>

        <Text numberOfLines={1} className="text-blanco text-xl font-masthead ml-4 flex-1">
          Mensajes WhatsApp
        </Text>
        <LogoMarca />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}
      >

        {/* Información */}
        <View className="bg-grafito rounded-2xl p-4 mb-5">
          <View className="flex-row items-center">
            <Ionicons
              name="logo-whatsapp"
              size={25}
              color="#25D366"
            />

            <Text className="text-blanco font-bold ml-3">
              Comunicación con clientes
            </Text>
          </View>

          <Text className="text-blanco/50 text-xs mt-2">
            Selecciona un cliente para abrir su conversación de WhatsApp.
          </Text>
        </View>

        {/* Buscador */}
        <View className="flex-row items-center bg-grafito rounded-xl px-4 mb-5">
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.blanco}
          />

          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar cliente..."
            placeholderTextColor="#FFFFFF66"
            className="flex-1 text-blanco px-3 py-3"
          />
        </View>

        {/* Listado de clientes */}
        <Text className="text-blanco font-bold mb-3">
          Mis conversaciones
        </Text>

        {clientesFiltrados.length > 0 ? (

          clientesFiltrados.map((cliente) => (
            <TouchableOpacity
              key={String(cliente.id)}
              onPress={() => escribirleAlCliente(cliente.id)}
              activeOpacity={0.8}
              className="flex-row items-center bg-grafito rounded-xl p-4 mb-3"
            >

              <View className="w-11 h-11 rounded-full bg-carbon items-center justify-center">
                <Ionicons
                  name="person-outline"
                  size={23}
                  color={colors.azulClaro}
                />
              </View>

              <View className="flex-1 ml-3">
                <Text className="text-blanco font-bold">
                  {cliente.nombre || 'Cliente'}
                </Text>

                <Text className="text-blanco/40 text-xs mt-1">
                  {cliente.correo || 'Responder en WhatsApp'}
                </Text>
              </View>

              <Ionicons
                name="logo-whatsapp"
                size={25}
                color="#25D366"
              />

              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.blanco}
                style={{ opacity: 0.4, marginLeft: 8 }}
              />

            </TouchableOpacity>
          ))

        ) : (

          <View className="bg-grafito rounded-2xl p-6 items-center">
            <Ionicons
              name="people-outline"
              size={38}
              color={colors.azulClaro}
            />

            <Text className="text-blanco font-bold mt-3">
              No hay clientes disponibles
            </Text>

            <Text className="text-blanco/50 text-xs text-center mt-2">
              {aviso || 'Todavía no hay alumnos registrados.'}
            </Text>
          </View>

        )}

      </ScrollView>
    </SafeAreaView>
  );
}
