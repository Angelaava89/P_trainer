// Agenda local compartida entre las pantallas del entrenador y del cliente.
export const CLAVE_AGENDA = 'ptrainer_agenda_asesorias_v2';
export const CLAVE_NOTIFICACIONES_AGENDA = 'ptrainer_notificaciones_agenda_v2';
export const CLAVE_USUARIO_ACTUAL = 'ptrainer_usuario_actual';

export const idClienteDesdeUsuario = (usuario) => {
  const identificador = usuario?.id ?? usuario?._id ?? usuario?.correo ?? usuario?.email ?? usuario?.nombre ?? 'cliente';
  return `cliente:${String(identificador).trim().toLowerCase()}`;
};

export const nombreDesdeUsuario = (usuario) => (
  String(usuario?.nombre ?? usuario?.name ?? usuario?.correo ?? usuario?.email ?? 'Cliente').trim()
);
