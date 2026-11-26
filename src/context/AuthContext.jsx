import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, CLAVE_SESION, registrarCierreSesion, setToken } from '../api/client';

const AuthContext = createContext(null);

// Claves de versiones anteriores que ya no se usan. "ptrainer_cuentas" guardaba
// contraseñas en texto plano en el teléfono, así que se borra al abrir la app.
const CLAVES_ANTIGUAS = ['ptrainer_cuentas', 'usuario_sesion'];

// Este contexto centraliza la sesión del usuario que usan las pantallas autenticadas de la app.
// La sesión ({ token, usuario }) se guarda en AsyncStorage para que siga abierta al reabrir la app.
export function AuthProvider({ children }) {
  // null = nadie ha iniciado sesión
  const [usuario, setUsuario] = useState(null);
  const [token, setTokenEstado] = useState(null);
  // true mientras se lee la sesión guardada al abrir la app
  const [restaurando, setRestaurando] = useState(true);

  const guardarEnDispositivo = (nuevoToken, nuevoUsuario) => (
    AsyncStorage.setItem(CLAVE_SESION, JSON.stringify({ token: nuevoToken, usuario: nuevoUsuario })).catch(() => {})
  );

  const limpiarSesion = useCallback(() => {
    setToken(null);
    setTokenEstado(null);
    setUsuario(null);
    return AsyncStorage.multiRemove([CLAVE_SESION, 'ptrainer_usuario_actual']).catch(() => {});
  }, []);

  // Al abrir la app: recupera la sesión guardada y la confirma con Django.
  useEffect(() => {
    registrarCierreSesion(limpiarSesion);
    let activo = true;
    (async () => {
      try {
        await AsyncStorage.multiRemove(CLAVES_ANTIGUAS).catch(() => {});
        const guardada = JSON.parse((await AsyncStorage.getItem(CLAVE_SESION)) || 'null');
        if (!guardada?.token) return;
        setToken(guardada.token);
        try {
          const perfil = await api('/perfil/');
          if (!activo) return;
          setTokenEstado(guardada.token);
          setUsuario(perfil);
          guardarEnDispositivo(guardada.token, perfil);
        } catch (error) {
          if (!activo) return;
          if (error.status === 401 || error.status === 403) {
            await limpiarSesion();
          } else {
            // Sin conexión: se mantiene la sesión guardada; Django la valida en la próxima petición.
            setTokenEstado(guardada.token);
            setUsuario(guardada.usuario || null);
          }
        }
      } catch {
        // Si el almacenamiento falla, simplemente no hay sesión guardada.
      } finally {
        if (activo) setRestaurando(false);
      }
    })();
    return () => {
      activo = false;
      registrarCierreSesion(null);
    };
  }, [limpiarSesion]);

  const abrirSesion = async (respuesta) => {
    // Conserva el token en el cliente HTTP, el perfil en memoria y ambos en el dispositivo.
    setToken(respuesta.token);
    setTokenEstado(respuesta.token);
    setUsuario(respuesta.usuario);
    await guardarEnDispositivo(respuesta.token, respuesta.usuario);
  };

  // datos: { nombre, rut, edad, correo, password }
  const registrar = async (datos) => {
    // El registro se crea en Django/Mongo. Como /registro/ no devuelve token,
    // se inicia sesión enseguida con el mismo correo y contraseña.
    await api('/registro/', { method: 'POST', body: datos });
    const sesion = await api('/login/', {
      method: 'POST',
      body: { correo: datos.correo, password: datos.password },
    });
    await abrirSesion(sesion);
    return sesion;
  };

  // datos: { correo, password }
  const iniciarSesion = async (datos) => {
    // El mismo endpoint atiende clientes, profesionales y administradores; el destino se decide por rol.
    const respuesta = await api('/login/', { method: 'POST', body: datos });
    await abrirSesion(respuesta);
    return respuesta;
  };

  // Guarda los campos editables del usuario autenticado y conserva el perfil devuelto por Django.
  const guardarPerfil = async (cambios) => {
    // El servidor envuelve el perfil actualizado dentro de "usuario"; el método PATCH modifica solo lo enviado.
    const respuesta = await api('/perfil/', { method: 'PATCH', body: cambios });
    const usuarioActualizado = respuesta?.usuario || respuesta;
    setUsuario(usuarioActualizado);
    if (token) guardarEnDispositivo(token, usuarioActualizado);
    return usuarioActualizado;
  };

  const cerrarSesion = () => limpiarSesion();

  return (
    <AuthContext.Provider value={{ usuario, token, restaurando, registrar, iniciarSesion, guardarPerfil, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}
