import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import FondoThomas from '../components/FondoThomas';
import LogoMarca from '../components/LogoMarca';
import { colors } from '../constants/theme';
import '../global.css';

// La ficha muestra solo los datos del alumno seleccionando su ID de la base actual.
export default function PerfilClienteCoach() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const clienteId = Array.isArray(params.clienteId) ? params.clienteId[0] : params.clienteId;
  const [cliente, setCliente] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // La pantalla se actualiza al volver de asignar una rutina o un plan de nutrición.
  useFocusEffect(useCallback(() => {
    let activa = true;
    setCargando(true);
    api('/alumnos/')
      .then((alumnos) => {
        if (!activa) return;
        const encontrado = (Array.isArray(alumnos) ? alumnos : []).find(
          (alumno) => String(alumno.id) === String(clienteId)
        );
        setCliente(encontrado || null);
        setError(encontrado ? '' : 'No se encontró el perfil de este cliente.');
      })
      .catch((fallo) => {
        if (!activa) return;
        setCliente(null);
        setError(fallo?.message || 'No se pudo cargar el perfil del cliente.');
      })
      .finally(() => { if (activa) setCargando(false); });
    return () => { activa = false; };
  }, [clienteId]));

  const datos = cliente?.datos || {};
  const lesiones = Array.isArray(datos.lesion) ? datos.lesion : [];
  const alergias = Array.isArray(datos.alergia) ? datos.alergia : [];

  return (
    <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
      <FondoThomas imagen={require('../../assets/images/fondos/fondo_clientes.jpg')} />
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <TouchableOpacity accessibilityLabel="Volver" onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={26} color={colors.blanco} />
        </TouchableOpacity>
        <Text numberOfLines={1} className="flex-1 text-blanco text-xl font-masthead">Perfil del cliente</Text>
        <LogoMarca />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 26 }}>
        {cargando ? (
          <View className="bg-grafito rounded-2xl p-5">
            <Text className="text-blanco/60 text-sm">Cargando perfil del cliente…</Text>
          </View>
        ) : !cliente ? (
          <View className="bg-grafito rounded-2xl p-5">
            <Text className="text-blanco text-base font-bold">No se pudo abrir el perfil</Text>
            <Text className="text-blanco/60 text-sm mt-2">{error}</Text>
          </View>
        ) : (
          <>
            <View className="bg-grafito rounded-2xl p-5">
              <View className="flex-row items-center">
                <View className="items-center justify-center rounded-full" style={{ width: 58, height: 58, backgroundColor: `${colors.azulClaro}33` }}>
                  <Text className="text-azulClaro text-lg font-bold">
                    {(cliente.nombre || 'C').trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1 ml-4">
                  <Text className="text-blanco text-xl font-bold">{cliente.nombre || 'Cliente'}</Text>
                  <Text className="text-blanco/50 text-sm mt-1">Alumno · {cliente.edad ? `${cliente.edad} años` : 'Edad no registrada'}</Text>
                </View>
              </View>

              <View className="mt-5 pt-4" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                <DatoPerfil etiqueta="Correo" valor={cliente.correo} />
                <DatoPerfil etiqueta="RUT" valor={cliente.rut} />
                <DatoPerfil etiqueta="Objetivo" valor={datos.objetivo} />
                <DatoPerfil etiqueta="Experiencia" valor={datos.experiencia} />
                <DatoPerfil etiqueta="Altura" valor={datos.altura ? `${datos.altura} m` : ''} />
                <DatoPerfil etiqueta="Peso actual" valor={datos.pesoActual ? `${datos.pesoActual} kg` : ''} ultimo />
              </View>
            </View>

            <View className="bg-grafito rounded-2xl p-5 mt-4">
              <Text className="text-blanco text-base font-bold">Antecedentes de salud</Text>
              <Text className="text-blanco/50 text-sm mt-4 mb-2">Lesiones</Text>
              {lesiones.length ? lesiones.map((lesion, indice) => (
                <View key={`${lesion.areaCorporal || 'lesion'}-${indice}`} className="flex-row items-start rounded-xl bg-carbon p-3 mb-2">
                  <Ionicons name="bandage-outline" size={17} color={colors.rojo} />
                  <View className="flex-1 ml-2">
                    <Text className="text-blanco text-sm font-bold">{lesion.areaCorporal || 'Zona no indicada'}</Text>
                    {!!lesion.detalle && <Text className="text-blanco/60 text-xs mt-1">{lesion.detalle}</Text>}
                    {!!lesion.reposo && <Text className="text-blanco/50 text-xs mt-1">Reposo: {lesion.reposo}</Text>}
                  </View>
                </View>
              )) : <Text className="text-blanco/50 text-sm">Sin lesiones registradas.</Text>}

              <Text className="text-blanco/50 text-sm mt-4 mb-2">Alergias e intolerancias</Text>
              {alergias.length ? (
                <View className="flex-row flex-wrap" style={{ gap: 7 }}>
                  {alergias.map((alergia, indice) => (
                    <View key={`${alergia.tipo || 'alergia'}-${indice}`} className="rounded-full px-3 py-2" style={{ backgroundColor: `${colors.rojo}22` }}>
                      <Text className="text-blanco text-xs">{alergia.tipo}</Text>
                    </View>
                  ))}
                </View>
              ) : <Text className="text-blanco/50 text-sm">Sin alergias registradas.</Text>}
            </View>


          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Los datos quedan en filas sencillas para facilitar la lectura del entrenador.
function DatoPerfil({ etiqueta, valor, ultimo = false }) {
  return (
    <View className="flex-row items-center justify-between py-2" style={!ultimo ? { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' } : undefined}>
      <Text className="text-blanco/45 text-sm">{etiqueta}</Text>
      <Text className="text-blanco text-sm font-medium ml-4 flex-1 text-right">{valor || 'Sin información'}</Text>
    </View>
  );
}
