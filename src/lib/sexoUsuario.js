import AsyncStorage from '@react-native-async-storage/async-storage';

// Cada cuenta tiene una clave local propia para conservar el dato usado por el cálculo del TMB.
function claveSexoUsuario(usuario) {
  const identificador = usuario?.id ?? usuario?._id ?? usuario?.correo ?? usuario?.email;
  if (!identificador) return null;
  return `ptrainer_sexo_${String(identificador).trim().toLowerCase()}`;
}

// Guarda la selección del registro para poder recalcular el TMB en pantallas posteriores.
export async function guardarSexoUsuario(usuario, sexo) {
  const clave = claveSexoUsuario(usuario);
  if (!clave || !sexo) return;
  await AsyncStorage.setItem(clave, String(sexo).trim().toLowerCase());
}

// Lee el sexo local asociado a la cuenta cuando el backend aún no lo entrega en el perfil.
export async function leerSexoUsuario(usuario) {
  const clave = claveSexoUsuario(usuario);
  return clave ? AsyncStorage.getItem(clave) : null;
}
