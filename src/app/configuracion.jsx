import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import FondoThomas from '../components/FondoThomas';
import '../global.css';
import LogoMarca from '../components/LogoMarca';

export default function Configuracion() {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState(true);
  const [recordatorios, setRecordatorios] = useState(true);
  const [temaOscuro, setTemaOscuro] = useState(true);
  const opciones = [
    { label: 'Notificaciones', descripcion: 'Avisos de rutinas y clases presenciales', value: notificaciones, set: setNotificaciones },
    { label: 'Recordatorios', descripcion: 'Recordatorios de entrenamiento', value: recordatorios, set: setRecordatorios },
    { label: 'Tema oscuro', descripcion: 'Preferencia visual', value: temaOscuro, set: setTemaOscuro },
  ];
  return <SafeAreaView className="flex-1 bg-carbon" edges={['top', 'bottom']}>
    <FondoThomas imagen={require('../../assets/images/fondos/fondo_login.jpg')} />
    <View className="flex-row items-center px-5 pt-2 pb-4"><TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.blanco} /></TouchableOpacity><Text numberOfLines={1} className="text-blanco text-xl font-masthead ml-4 flex-1">Configuración</Text><LogoMarca /></View>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
      {opciones.map((o) => <View key={o.label} className="flex-row items-center bg-grafito rounded-xl p-4 mb-3"><View className="flex-1"><Text className="text-blanco font-bold">{o.label}</Text><Text className="text-blanco/50 text-xs mt-1">{o.descripcion}</Text></View><Switch value={o.value} onValueChange={o.set} trackColor={{ false: '#454B55', true: colors.azulClaro }} thumbColor={colors.blanco} /></View>)}
      <Text className="text-blanco/40 text-xs mt-2">Estas preferencias se mantienen solo mientras la pantalla está abierta.</Text>
    </ScrollView>
  </SafeAreaView>;
}
