import { Alert, Linking, Platform } from 'react-native';
import { api } from '../api/client';

// Abre la app de WhatsApp tal cual (en la lista de chats), sin elegir a nadie.
// Así el profesional busca ahí la conversación del cliente que le escribió y le responde.
export async function abrirAppWhatsApp() {
  try {
    await Linking.openURL('whatsapp://');
  } catch (error) {
    // WhatsApp no está instalado: se ofrece descargarlo
    const tienda = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/whatsapp-messenger/id310633997'
      : 'https://play.google.com/store/apps/details?id=com.whatsapp';
    Alert.alert('WhatsApp no está instalado', 'Instálalo para poder conversar con tus clientes.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descargar', onPress: () => Linking.openURL(tienda) },
    ]);
  }
}

// El profesional abre WhatsApp para escribirle a un cliente: al cliente le llega el aviso
// "Tu entrenador te escribió" (solo si es un alumno real de Atlas, con id de Mongo).
export async function escribirleAlCliente(alumnoId) {
  if (/^[0-9a-f]{24}$/i.test(String(alumnoId ?? ''))) {
    api('/avisos/mensaje-profesor/', { method: 'POST', body: { alumno_id: alumnoId } }).catch(() => {});
  }
  return abrirAppWhatsApp();
}
