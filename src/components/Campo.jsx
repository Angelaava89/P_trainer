import { Ionicons } from '@expo/vector-icons';
import { TextInput, View } from 'react-native';
import { colors } from '../constants/theme';

// un input con ícono a la izquierda — lo usan registro e inicio de sesión
// (...props deja pasar keyboardType, autoCapitalize, etc. al TextInput)
export default function Campo({ icon, placeholder, secureTextEntry, value, onChangeText, ...props }) {
  return (
    <View className="flex-row items-center bg-grafito rounded-xl px-4 mb-4" style={{ height: 50 }}>
      <Ionicons name={icon} size={18} color={colors.blanco} style={{ opacity: 0.5 }} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.4)"
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={onChangeText}
        className="text-blanco text-sm ml-3 flex-1"
        {...props}
      />
    </View>
  );
}
