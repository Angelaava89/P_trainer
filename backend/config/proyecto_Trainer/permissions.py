from rest_framework.permissions import BasePermission


def _tipo_autenticado(request):
    """Devuelve el tipo_usuario si la petición trae un token válido; si no, None.

    Con UNAUTHENTICATED_USER = None, request.user es None cuando no hay token,
    así que nunca se debe leer request.user.<algo> sin revisar esto antes.
    """
    usuario = request.user
    if usuario is None or request.auth is None:
        return None
    if not getattr(usuario, "is_authenticated", False):
        return None
    return getattr(usuario, "tipo_usuario", None)


class UsuarioAutenticado(BasePermission):

    def has_permission(self, request, view):
        return _tipo_autenticado(request) is not None


class SoloProfesor(BasePermission):

    def has_permission(self, request, view):
        return _tipo_autenticado(request) == "Profesor"


class SoloAdmin(BasePermission):

    def has_permission(self, request, view):
        return _tipo_autenticado(request) == "Admin"


class SoloProfesorOAdmin(BasePermission):

    def has_permission(self, request, view):
        return _tipo_autenticado(request) in ("Profesor", "Admin")


class SoloProfesorOAlumno(BasePermission):

    def has_permission(self, request, view):
        return _tipo_autenticado(request) in ("Profesor", "Alumno")


class SoloAlumno(BasePermission):

    def has_permission(self, request, view):
        return _tipo_autenticado(request) == "Alumno"
