"""Conexión única a MongoDB Atlas para todo el backend.

Uso desde cualquier vista:

    from database import get_db
    db = get_db()

Colecciones:
    -usuarios
    -planes
    -ejercicios
    -alimentos

Prueba rápida de la conexión (desde backend/config):

    python database.py
"""
import os

from pymongo import ASCENDING, MongoClient


class ConfiguracionError(RuntimeError):
    """Falta algún dato en el archivo .env."""


_db = None


def get_db():
    """Devuelve la base de datos de la app. Se conecta solo la primera vez."""
    global _db
    if _db is None:
        uri = os.environ.get("MONGODB_URI")
        if not uri:
            raise ConfiguracionError(
                "Falta MONGODB_URI. Copia backend/config/.env.example como "
                "backend/config/.env y pega ahí la URI de Atlas."
            )
        # tz_aware: las fechas vuelven con zona horaria (UTC)
        # serverSelectionTimeoutMS: si Atlas no responde, falla en 8 s en vez de 30
        client = MongoClient(uri, tz_aware=True, serverSelectionTimeoutMS=8000)
        db = client[os.environ.get("MONGODB_DB", "App")]

        # Índices: correo único por usuario y búsquedas rápidas por usuario + fecha
        db.usuarios.create_index("rut", unique=True)
        db.usuarios.create_index("correo", unique=True)
        # No se crean índices para pesos ni medidas,
        # porque son atributos dentro de usuarios.
        # MongoDB crea automáticamente el índice _id
        # en usuarios, planes, ejercicios y alimentos.
        _db = db
    return _db


if __name__ == "__main__":
    from pathlib import Path

    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
    get_db().command("ping")
    print("Connected successfully")
