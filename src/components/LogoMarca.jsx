import { Image, View, useWindowDimensions } from 'react-native';

// El wordmark blanco conserva contraste sobre el fondo oscuro de la aplicación.
const LOGO = require('../../assets/images/logo_tbtf.png');
const PROPORCION = 297 / 600; // alto / ancho de la imagen original

// Logo de marca dentro de la fila del encabezado; su tamaño se adapta al ancho de la pantalla.
// La cabecera del administrador gestiona su propio botón de salida de forma independiente.
export default function LogoMarca({ grande = false }) {
  const { width } = useWindowDimensions();
  const ancho = grande
    ? Math.round(Math.min(96, Math.max(64, width * 0.22)))
    : Math.round(Math.min(76, Math.max(48, width * 0.18)));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12, flexShrink: 0 }}>
      <Image
        source={LOGO}
        resizeMode="contain"
        accessibilityLabel="TBTF"
        style={{ width: ancho, height: ancho * PROPORCION }}
      />
    </View>
  );
}
