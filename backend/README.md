# Backend P Trainer (Django + MongoDB Atlas)

La app nunca habla directo con Mongo. El camino es:

    App (React Native)  →  HTTP  →  Django (este backend)  →  pymongo  →  MongoDB Atlas

## Primera vez

Desde la carpeta `backend/`:

```bash
python -m venv venv
venv\Scripts\activate            # Windows  (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
```

Después, en `backend/config/`:

1. Copia `.env.example` como `.env` y pega la URI de Atlas con la contraseña del usuario.
2. Prueba la conexión: `python database.py` → debe decir `Connected successfully`.
3. Crea las tablas internas de Django (solo una vez): `python manage.py migrate`

## Levantar el servidor

```bash
cd backend/config
python manage.py runserver 0.0.0.0:8000
```

El `0.0.0.0` es lo que permite que el teléfono o el emulador lleguen al PC.
Para comprobar que todo está conectado abre http://localhost:8000/api/salud/ — debe responder
`{"estado": "ok", "mongo": "conectado"}`.

## Rutas

| Método | Ruta | Para qué | ¿Token? |
|---|---|---|---|
| GET | `/api/salud/` | Comprobar que Django llega a Atlas | No |
| POST | `/api/registro/` | Crear cuenta: `nombre`, `correo`, `password` | No |
| POST | `/api/login/` | Iniciar sesión: `correo`, `password` | No |
| GET / PATCH | `/api/perfil/` | Ver o guardar `altura_cm`, `objetivo`, `nivel`, `antecedentes` | Sí |
| GET / POST | `/api/peso/` | Historial de peso / nuevo registro: `kg` | Sí |
| GET / POST | `/api/medidas/` | Historial de medidas / nuevo registro: `pecho`, `cintura`, `brazo`, `pierna` | Sí |

Registro y login devuelven un `token`. Las rutas con token esperan el encabezado
`Authorization: Bearer <token>` (la app lo agrega sola en `src/api/client.js`).

En Atlas los datos quedan en la base `ptrainer`, colecciones `usuarios`, `pesos` y `medidas`.

## Si la app no conecta

- **Atlas → Network Access:** tu IP actual tiene que estar autorizada.
- **Teléfono físico:** debe estar en el mismo wifi que el PC, y el Firewall de Windows debe
  permitir conexiones entrantes a Python en el puerto 8000.
- **La app no encuentra el servidor:** copia `.env.example` de la raíz del proyecto como `.env`,
  pon la IP de tu PC en `EXPO_PUBLIC_API_URL` y reinicia Expo con `npx expo start -c`.
