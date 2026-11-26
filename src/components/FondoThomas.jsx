import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../constants/theme';
import { claveDeFondo, useApariencia } from '../lib/apariencia';

// Foto de Thomas como fondo de pantalla, detrás de todo el contenido.
// Usa el mismo oscurecido que la pantalla de inicio (index.jsx): más claro arriba
// y color carbón abajo, para que textos y tarjetas se sigan leyendo bien.
// pointerEvents="none": el fondo nunca bloquea los toques en botones o tarjetas.
// Si el admin puso otro fondo para esta imagen (Apariencia), se muestra el link de Cloudinary;
// si no hay o no carga, se queda la imagen original de la app.
export default function FondoThomas({ imagen }) {
  const apariencia = useApariencia();
  const urlNube = apariencia.fondos[claveDeFondo(imagen)];
  const [falloNube, setFalloNube] = useState(null);
  const usarNube = !!urlNube && falloNube !== urlNube;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={usarNube ? { uri: urlNube } : imagen}
        onError={() => { if (usarNube) setFalloNube(urlNube); }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(8, 10, 13, 0.56)', colors.carbon]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  );
}
