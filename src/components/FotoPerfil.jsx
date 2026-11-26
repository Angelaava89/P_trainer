import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/theme';

const FOTO_POR_DEFECTO = require('../../assets/images/gato.jpg');

// Cada usuario tiene su propia foto en este celular (llave según su correo)
async function llaveFoto() {
  try {
    const actual = JSON.parse((await AsyncStorage.getItem('ptrainer_usuario_actual')) || 'null');
    return `ptrainer_foto_perfil_${actual?.correo || 'invitado'}`;
  } catch {
    return 'ptrainer_foto_perfil_invitado';
  }
}

// Foto de perfil editable: al tocarla se puede elegir de la galería, tomar una foto o quitarla.
// La imagen se guarda en el celular (no en Atlas).
export default function FotoPerfil({ tamano = 120 }) {
  const [foto, setFoto] = useState(null); // data URI de la imagen elegida, o null = foto por defecto
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    let activo = true;
    llaveFoto()
      .then((llave) => AsyncStorage.getItem(llave))
      .then((guardada) => { if (activo && guardada) setFoto(guardada); })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

  const guardar = async (resultado) => {
    if (resultado.canceled || !resultado.assets?.[0]?.base64) return;
    const { base64, mimeType } = resultado.assets[0];
    const dataUri = `data:${mimeType || 'image/jpeg'};base64,${base64}`;
    setFoto(dataUri);
    try {
      await AsyncStorage.setItem(await llaveFoto(), dataUri);
    } catch {
      Alert.alert('No se pudo guardar la foto', 'Prueba con otra imagen.');
    }
  };

  // Recorte cuadrado y calidad baja para que la foto pese poco
  const opciones = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.3, base64: true };

  const elegirDeGaleria = async () => {
    setMenuAbierto(false);
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Permite el acceso a tus fotos para cambiar la imagen de perfil.');
      return;
    }
    guardar(await ImagePicker.launchImageLibraryAsync(opciones));
  };

  const tomarFoto = async () => {
    setMenuAbierto(false);
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Permite el acceso a la cámara para tomar tu foto de perfil.');
      return;
    }
    guardar(await ImagePicker.launchCameraAsync(opciones));
  };

  const quitarFoto = async () => {
    setMenuAbierto(false);
    setFoto(null);
    try {
      await AsyncStorage.removeItem(await llaveFoto());
    } catch {}
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setMenuAbierto(true)}
        activeOpacity={0.8}
        className="relative"
        accessibilityLabel="Cambiar foto de perfil"
      >
        <Image
          className="border-2 border-azulOscuro"
          source={foto ? { uri: foto } : FOTO_POR_DEFECTO}
          style={{ width: tamano, height: tamano, borderRadius: tamano * 0.4 }}
        />
        <View
          className="absolute bg-azulClaro rounded-full items-center justify-center"
          style={{ width: 30, height: 30, bottom: -4, right: -4 }}
        >
          <Ionicons name="pencil" size={14} color={colors.blanco} />
        </View>
      </TouchableOpacity>

      {/* menú de opciones */}
      <Modal visible={menuAbierto} transparent animationType="fade" onRequestClose={() => setMenuAbierto(false)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setMenuAbierto(false)}>
          <Pressable className="bg-grafito rounded-t-3xl px-5 pt-5 pb-8">
            <Text className="text-blanco text-base font-bold mb-4 text-center">Foto de perfil</Text>

            <TouchableOpacity onPress={elegirDeGaleria} className="flex-row items-center bg-carbon rounded-xl px-4 py-4 mb-2">
              <Ionicons name="images-outline" size={20} color={colors.azulClaro} />
              <Text className="text-blanco text-sm ml-3">Elegir de la galería</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={tomarFoto} className="flex-row items-center bg-carbon rounded-xl px-4 py-4 mb-2">
              <Ionicons name="camera-outline" size={20} color={colors.azulClaro} />
              <Text className="text-blanco text-sm ml-3">Tomar foto</Text>
            </TouchableOpacity>

            {foto && (
              <TouchableOpacity onPress={quitarFoto} className="flex-row items-center bg-carbon rounded-xl px-4 py-4 mb-2">
                <Ionicons name="trash-outline" size={20} color={colors.rojo} />
                <Text className="text-sm ml-3" style={{ color: colors.rojo }}>Quitar foto</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setMenuAbierto(false)} className="items-center py-3 mt-1">
              <Text className="text-blanco/60 text-sm">Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
