"""Sesiones de la app: un token firmado que la app manda en cada petición.

    Authorization: Bearer <token>

El token lo firma Django con SECRET_KEY (django.core.signing), así que no hay
que guardarlo en ninguna tabla: basta con verificar la firma y buscar al usuario.
"""
from bson import ObjectId
from bson.errors import InvalidId
from django.core import signing
from rest_framework import authentication, exceptions

from .models import UsuarioModel

from database import get_db

SALT = "ptrainer.sesion"
DURACION_SEGUNDOS = 60 * 60 * 24 * 30


class Usuario:
    """Envuelve el documento de Mongo para que DRF lo trate como usuario logueado."""

    is_authenticated = True

    def __init__(self, doc):
        self.doc = doc
        self.id = doc["_id"]


def crear_token(usuario_id):
    return signing.dumps({"uid": str(usuario_id)}, salt=SALT)


class TokenAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        partes = authentication.get_authorization_header(request).split()
        if not partes or partes[0].lower() != b"bearer":
            return None  # sin token: la vista decide si deja pasar o no

        try:
            datos = signing.loads(partes[1].decode(), salt=SALT, max_age=DURACION_SEGUNDOS)
            usuario_id = ObjectId(datos["uid"])
        except (IndexError, UnicodeError, KeyError, TypeError, InvalidId, signing.BadSignature):
            raise exceptions.AuthenticationFailed("Sesión inválida o vencida. Inicia sesión de nuevo.")

        # Se devuelve el modelo de Django (no el documento crudo de Mongo)
        # porque las vistas usan request.user.datos, request.user.tipo_usuario, .save(), etc.
        usuario = UsuarioModel.objects.filter(pk=usuario_id).first()
        if usuario is None:
            raise exceptions.AuthenticationFailed("La cuenta ya no existe.")
        usuario.is_authenticated = True
        # El segundo valor queda en request.auth; los permisos (UsuarioAutenticado,
        # SoloProfesor) exigen que no sea None, así que se devuelve el token.
        return (usuario, partes[1].decode())

    def authenticate_header(self, request):
        return "Bearer"  # hace que la respuesta sea 401 en vez de 403
