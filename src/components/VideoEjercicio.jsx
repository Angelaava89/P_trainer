import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

// Convierte los links de Cloudinary a un MP4 H.264, que es el formato que el teléfono siempre puede reproducir.
// Acepta el link directo (res.cloudinary.com/.../video/upload/...) y el del reproductor (player.cloudinary.com/embed/?...).
export function prepararUrlVideo(uri) {
  const texto = String(uri || '').trim();
  if (!texto) return texto;

  const embed = texto.match(/player\.cloudinary\.com\/embed\/?\?(.*)$/i);
  if (embed) {
    const params = new URLSearchParams(embed[1]);
    const nube = params.get('cloud_name');
    const publicId = params.get('public_id');
    if (nube && publicId) {
      return `https://res.cloudinary.com/${nube}/video/upload/f_mp4,vc_h264,ac_aac/${publicId}.mp4`;
    }
    return texto;
  }

  const directo = texto.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)$/i);
  if (directo && !/vc_h264/.test(directo[2])) {
    const resto = directo[2].split('?')[0];
    const sinExtension = resto.replace(/\.[a-z0-9]+$/i, '');
    return `${directo[1]}f_mp4,vc_h264,ac_aac/${sinExtension}.mp4`;
  }

  return texto;
}

export default function VideoEjercicio({ uri, onCerrar }) {
  const [error, setError] = useState('');

  const player = useVideoPlayer(prepararUrlVideo(uri));

  useEventListener(player, 'statusChange', ({ status }) => {
    setError(
      status === 'error'
        ? 'No se pudo reproducir este video. Prueba con un MP4 H.264.'
        : ''
    );
  });

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#000',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <VideoView
          player={player}
          nativeControls
          contentFit="contain"
          style={{ width: '100%', height: 280 }}
        />

        {!!error && (
          <Text style={{ color: '#fff', marginTop: 16 }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          onPress={onCerrar}
          style={{ padding: 20, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff' }}>Cerrar video</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}