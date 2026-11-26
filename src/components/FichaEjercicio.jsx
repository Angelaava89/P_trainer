import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/theme';
import { nombreSinDia } from '../lib/ejerciciosInfo';

// Etiquetas con los músculos que trabaja el ejercicio (Pecho, Tríceps, Glúteo...).
export function ChipsMusculos({ musculos = [], pequeno = false }) {
  if (!musculos.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
      {musculos.map((musculo) => (
        <View
          key={musculo}
          style={{
            backgroundColor: `${colors.azulClaro}26`,
            borderWidth: 1,
            borderColor: `${colors.azulClaro}66`,
            borderRadius: 99,
            paddingHorizontal: pequeno ? 7 : 9,
            paddingVertical: pequeno ? 1 : 2,
          }}
        >
          <Text style={{ color: colors.blanco, fontSize: pequeno ? 11 : 12, fontWeight: '600' }}>{musculo}</Text>
        </View>
      ))}
    </View>
  );
}

// Miniatura del ejercicio. Al tocarla se abre la ficha grande con imagen, músculos y en qué consiste.
// Si el ejercicio no tiene imagen se muestra un ícono de pesa (también abre la ficha).
export function ImagenEjercicio({ nombre, info, tamano = 64 }) {
  const [abierta, setAbierta] = useState(false);
  if (!info) return null;

  return (
    <>
      <TouchableOpacity
        accessibilityRole="imagebutton"
        accessibilityLabel={`Ver cómo se hace ${nombreSinDia(nombre)}`}
        onPress={() => setAbierta(true)}
        style={{
          width: tamano,
          height: tamano,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: info.imagen ? colors.blanco : colors.carbon,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.azulOscuro,
        }}
      >
        {info.imagen
          ? <Image source={info.imagen} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          : <Ionicons name="barbell-outline" size={tamano * 0.42} color={colors.azulClaro} />}
      </TouchableOpacity>

      <Modal visible={abierta} transparent animationType="fade" onRequestClose={() => setAbierta(false)}>
        <Pressable onPress={() => setAbierta(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: 20 }}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: colors.grafito, borderRadius: 18, borderWidth: 1, borderColor: colors.azulOscuro, overflow: 'hidden' }}>
            <ScrollView bounces={false}>
              {info.imagen ? (
                <View style={{ backgroundColor: colors.blanco, height: 280, padding: 10 }}>
                  <Image source={info.imagen} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
              ) : (
                <View style={{ height: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.carbon }}>
                  <Ionicons name="barbell-outline" size={44} color={colors.azulClaro} />
                </View>
              )}
              <View style={{ padding: 16 }}>
                <Text style={{ color: colors.blanco, fontSize: 18, fontWeight: '800' }}>{nombreSinDia(nombre)}</Text>
                <Text style={{ color: colors.gris, fontSize: 12, marginTop: 10, fontWeight: '700', letterSpacing: 0.5 }}>MÚSCULOS QUE TRABAJA</Text>
                <ChipsMusculos musculos={info.musculos} />
                <Text style={{ color: colors.gris, fontSize: 12, marginTop: 14, fontWeight: '700', letterSpacing: 0.5 }}>EN QUÉ CONSISTE</Text>
                <Text style={{ color: colors.blanco, fontSize: 14, lineHeight: 20, marginTop: 5, opacity: 0.85 }}>{info.descripcion}</Text>
                <TouchableOpacity
                  onPress={() => setAbierta(false)}
                  style={{ backgroundColor: colors.azulClaro, borderRadius: 12, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 18 }}
                >
                  <Text style={{ color: colors.blanco, fontWeight: '800' }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
