"""Convierte los errores de conexión con Mongo en una respuesta JSON clara."""
import logging

from pymongo.errors import PyMongoError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from database import ConfiguracionError

logger = logging.getLogger(__name__)


def manejador_errores(exc, context):
    if isinstance(exc, ConfiguracionError):
        logger.error("%s", exc)
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    if isinstance(exc, PyMongoError):
        # El detalle queda en la consola de runserver, no se le manda a la app
        logger.exception("Error de MongoDB")
        return Response(
            {"detail": "No se pudo conectar con la base de datos. Intenta de nuevo en un momento."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return exception_handler(exc, context)
