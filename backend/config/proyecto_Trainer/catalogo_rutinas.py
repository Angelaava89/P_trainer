"""Adaptadores entre la forma histórica de Mongo y la API del catálogo."""

import re

from bson import ObjectId
from bson.errors import InvalidId

from .serializers import AbdomenSerializer, CardioSerializer, DiasRutinasPredeterminadasSerializer, SplitSerializer

NIVELES_RUTINA = {"Basico", "Intermedio", "Avanzado"}


def _parsear_reps(valor):
    """'8-12' -> (8, 12); '10' -> (10, 10); 'fallo' o vacío -> (None, None)."""
    texto = _texto(valor)
    m = re.match(r"^(\d+)\s*[-–]\s*(\d+)$", texto)
    if m:
        return int(m[1]), int(m[2])
    return (int(texto), int(texto)) if texto.isdigit() else (None, None)

def _parsear_segundos(valor):
    """'2 min' -> 120, '1:30' -> 90, '90 s' -> 90 (sin unidad, asume minutos)."""
    texto = _texto(valor).lower()
    m = re.match(r"^(\d+):(\d{2})$", texto)
    if m:
        return int(m[1]) * 60 + int(m[2])
    m = re.match(r"^(\d+)\s*(min|m|seg|s)?", texto)
    if not m:
        return None
    return int(m[1]) * (1 if m[2] in ("seg", "s") else 60)

def _validar(serializer_cls, datos, many=False):
    serializer = serializer_cls(data=datos, many=many)
    if not serializer.is_valid():
        raise ValueError(f"Datos inválidos: {serializer.errors}")
    return list(serializer.validated_data) if many else dict(serializer.validated_data)

def _armar_ejercicio(ej, orden, por_id, por_nombre):
    """Acepta un ejercicio viejo (nombre/repeticiones/descanso) o nuevo (reps_min/descanso_seg)."""
    nombre = _texto(ej.get("nombre_ejercicio") or ej.get("nombre"))
    id_ej = _texto(ej.get("idEjercicio"))
    glob = por_id.get(id_ej) if id_ej else None
    if not glob and nombre:
        glob = por_nombre.get(nombre.casefold())
    if not id_ej and glob:
        id_ej = _texto(glob.get("idEjercicio")) or str(glob.get("_id", ""))

    if "reps_min" in ej or "reps_max" in ej:
        rmin, rmax = ej.get("reps_min"), ej.get("reps_max")
    else:
        rmin, rmax = _parsear_reps(ej.get("repeticiones") or "8-12")

    try:
        series = int(ej.get("series") or 3)
    except (TypeError, ValueError):
        raise ValueError("Las series deben ser un número.")

    return {
        "idEjercicio": id_ej,
        "orden": orden,
        "nombre_ejercicio": nombre or _texto(glob.get("nombre") if glob else "Ejercicio"),
        "equipo": _texto(ej.get("equipo")) or _texto(glob.get("equipo") if glob else ""),
        "series": series,
        "reps_min": rmin,
        "reps_max": rmax,
        "rer": int(ej.get("rer") or 0),
        "al_fallo": bool(ej.get("al_fallo")) or (rmin is None and rmax is None),
        "unilateral": bool(ej.get("unilateral")),
        "tempo": _texto(ej.get("tempo")),
        "superset_grupo": _texto(ej.get("superset_grupo")),
        "descanso_seg": ej["descanso_seg"] if "descanso_seg" in ej
                        else _parsear_segundos(ej.get("descanso") or "2 min"),
        "detalle": _texto(ej.get("detalle")),
        "series_especiales": ej.get("series_especiales") or [],
    }

# --- Variantes de claves que aparecen en documentos cargados a mano en Atlas -------------
# Los modelos embebidos (CardioModel, AbdomenModel, SerieEspecialModel...) fallan con
# TypeError si reciben una clave que no tienen, así que antes de armar la copia del
# alumno se traducen las variantes conocidas a los nombres de los modelos.

_TECNICAS = {
    "dropset": "drop_set", "drop_set": "drop_set", "drop set": "drop_set",
    "rest_pause": "rest_pause", "rest pause": "rest_pause", "restpause": "rest_pause",
    "negativos": "negativos", "negativo": "negativos",
}


def _nivel(valor):
    """'intermedio' / 'BÁSICO' -> 'Intermedio' / 'Basico' (las opciones de NIVEL)."""
    texto = _texto(valor).casefold().replace("á", "a")
    for nivel in NIVELES_RUTINA:
        if nivel.casefold() == texto:
            return nivel
    return _texto(valor)


def _lista_textos(valor):
    if isinstance(valor, list):
        return [_texto(v) for v in valor if _texto(v)]
    return [_texto(valor)] if _texto(valor) else []


def _normalizar_series_especiales(lista, series):
    """{tipo, ultima_serie, hasta_fallo} -> {serie, tecnica, al_fallo, rer}."""
    salida = []
    for item in lista or []:
        if not isinstance(item, dict):
            continue
        tecnica = _TECNICAS.get(_texto(item.get("tecnica") or item.get("tipo")).casefold(), "")
        serie = item.get("serie")
        if serie is None:
            serie = series if item.get("ultima_serie") else 1
        salida.append({
            "serie": max(1, int(serie or 1)),
            "tecnica": tecnica,
            "al_fallo": bool(item.get("al_fallo") or item.get("hasta_fallo")),
            "rer": item.get("rer"),
        })
    return salida


def _normalizar_ejercicio(ej, orden):
    """Acepta 'nombre' en vez de 'nombre_ejercicio', orden faltante y series especiales con otras claves."""
    series = int(ej.get("series") or 1)
    campos = {
        "idEjercicio": _texto(ej.get("idEjercicio")),
        "orden": int(ej.get("orden") or orden),
        "nombre_ejercicio": _texto(ej.get("nombre_ejercicio") or ej.get("nombre")) or "Ejercicio",
        "equipo": _texto(ej.get("equipo")),
        "series": series,
        "reps_min": ej.get("reps_min"),
        "reps_max": ej.get("reps_max"),
        "rer": int(ej.get("rer") or 0),
        "al_fallo": bool(ej.get("al_fallo")),
        "unilateral": bool(ej.get("unilateral")),
        "tempo": _texto(ej.get("tempo")),
        "superset_grupo": _texto(ej.get("superset_grupo")),
        "descanso_seg": ej.get("descanso_seg"),
        "detalle": _texto(ej.get("detalle")),
        "series_especiales": _normalizar_series_especiales(ej.get("series_especiales"), series),
    }
    if campos["reps_min"] is None and campos["reps_max"] is None:
        campos["al_fallo"] = True
    return campos


def _normalizar_cardio(cardio):
    """{incluido, tipo, duracion_min, intensidad, detalle} -> campos de CardioModel."""
    if not isinstance(cardio, dict) or cardio.get("incluido") is False:
        return None
    indicaciones = " ".join(
        parte for parte in (
            _texto(cardio.get("indicaciones") or cardio.get("detalle")),
            f"Intensidad: {_texto(cardio.get('intensidad'))}." if _texto(cardio.get("intensidad")) else "",
        ) if parte
    )
    return {
        "sesiones_semana": int(cardio.get("sesiones_semana") or 0),
        "tipo": _texto(cardio.get("tipo")),
        "duracion_min": cardio.get("duracion_min"),
        "en_ayunas": bool(cardio.get("en_ayunas")),
        "indicaciones": indicaciones[:250],
    }


def _normalizar_abdomen(abdomen, dias):
    """{incluido, frecuencia, ejercicios[nombre]} -> campos de AbdomenModel."""
    if not isinstance(abdomen, dict) or abdomen.get("incluido") is False:
        return None
    aplica = _lista_textos(abdomen.get("aplica_despues_de_dias"))
    if not aplica:
        # Si no se indica, se aplica después de los días marcados con incluye_abdomen.
        aplica = [d["id_dia"] for d in dias if d.get("incluye_abdomen")]
    return {
        "aplica_despues_de_dias": aplica,
        "excluye_dias": _lista_textos(abdomen.get("excluye_dias")),
        "ejercicios": [
            _normalizar_ejercicio(ej, indice)
            for indice, ej in enumerate(abdomen.get("ejercicios") or [], start=1)
            if isinstance(ej, dict)
        ],
    }


def _normalizar_formato_nuevo(rutina):
    """Uniforma una rutina que ya tiene split como objeto (formato nuevo)."""
    split = rutina.get("split") or {}
    dias = []
    for indice, dia in enumerate(rutina.get("dias") or [], start=1):
        if not isinstance(dia, dict):
            continue
        orden = _numero_dia(dia.get("orden") or indice)
        dias.append({
            "id_dia": _texto(dia.get("id_dia")) or f"dia{orden}",
            "orden": orden,
            "nombre": _texto(dia.get("nombre")) or f"Día {orden}",
            "grupo_muscular": _lista_textos(dia.get("grupo_muscular")),   # "Piernas" -> ["Piernas"]
            "tipo_intensidad": _texto(dia.get("tipo_intensidad")),
            "intensidad": _texto(dia.get("intensidad")),                  # 10 -> "10"
            "incluye_abdomen": bool(dia.get("incluye_abdomen", True)),
            "ejercicios": [
                _normalizar_ejercicio(ej, posicion)
                for posicion, ej in enumerate(dia.get("ejercicios") or [], start=1)
                if isinstance(ej, dict)
            ],
        })
    return {
        "_id": rutina.get("_id"),
        "nombre": _texto(rutina.get("nombre") or rutina.get("Rutina")),
        "nivel": _nivel(rutina.get("nivel")),
        "descripcion": _texto(rutina.get("descripcion")),
        "split": {
            "dias_entrenamiento": int(split.get("dias_entrenamiento") or len(dias)),
            "secuencia": _lista_textos(split.get("secuencia")),
            "repetir": bool(split.get("repetir", True)),
            "descripcion": _texto(split.get("descripcion")),
        },
        "cardio": _normalizar_cardio(rutina.get("cardio")),
        "abdomen": _normalizar_abdomen(rutina.get("abdomen"), dias),
        "notas_generales": _lista_textos(rutina.get("notas_generales")),
        "dias": dias,
        "activa": bool(rutina.get("activa", True)),
    }


def _normalizar_rutina(rutina, db):
    """Devuelve la rutina en la estructura nueva, sea cual sea el formato guardado."""
    if isinstance(rutina.get("split"), dict):
        return _normalizar_formato_nuevo(rutina)

    por_id, por_nombre = _indice_ejercicios(db)
    grupos = {}
    for detalle in rutina.get("detalles") or rutina.get("dias") or []:
        numero = _numero_dia(detalle.get("dia"))
        ejercicios = detalle.get("ejercicios")
        if not isinstance(ejercicios, list):
            ejercicios = [detalle] if (detalle.get("nombre") or detalle.get("nombre_ejercicio")) else []
        lista = grupos.setdefault(numero, [])
        for ej in ejercicios:
            lista.append(_armar_ejercicio(ej, len(lista) + 1, por_id, por_nombre))

    enfoque = _texto(rutina.get("enfoqueRutina") or rutina.get("split"))
    return {
        "_id": rutina.get("_id"),
        "nombre": _texto(rutina.get("Rutina") or rutina.get("nombre")),
        "nivel": _texto(rutina.get("nivel")),
        "descripcion": "",
        "split": {"dias_entrenamiento": len(grupos), "secuencia": [], "repetir": True, "descripcion": enfoque},
        "cardio": None,
        "abdomen": None,
        "notas_generales": [],
        "dias": [
            {"id_dia": f"dia{n}", "orden": n, "nombre": f"Día {n}", "grupo_muscular": [],
             "tipo_intensidad": "", "intensidad": "", "incluye_abdomen": True, "ejercicios": ejs}
            for n, ejs in sorted(grupos.items())
        ],
        "activa": True,
    }

def rutina_a_api(rutina, db):
    n = _normalizar_rutina(rutina, db)
    salida = {k: v for k, v in n.items() if k not in ("_id", "detalles", "Rutina", "enfoqueRutina")}
    salida["id"] = str(n["_id"])
    return salida

def rutina_desde_api(payload, db):
    nombre = _texto(payload.get("nombre") or payload.get("Rutina"))
    nivel = _texto(payload.get("nivel"))
    if not nombre:
        raise ValueError("Indica el nombre de la rutina.")
    nivel = _nivel(nivel)
    if nivel not in NIVELES_RUTINA:
        raise ValueError("Selecciona el nivel de experiencia de la rutina.")

    split = payload.get("split")
    if not isinstance(split, dict):  # el cliente actual manda texto
        split = {"descripcion": _texto(split or payload.get("enfoqueRutina"))}
    if not _texto(split.get("descripcion")):
        raise ValueError("Indica el enfoque de la rutina.")

    filas = payload.get("dias")
    if not isinstance(filas, list) or not filas:
        raise ValueError("Agrega al menos un ejercicio global a la rutina.")

    por_id, por_nombre = _indice_ejercicios(db)
    grupos, meta = {}, {}
    for fila in filas:
        if isinstance(fila.get("ejercicios"), list):      # formato nuevo: un día con sus ejercicios
            numero = _numero_dia(fila.get("orden") or fila.get("dia"))
            meta[numero] = fila
            lista_entrada = fila["ejercicios"]
        else:                                             # formato antiguo: una fila por ejercicio
            numero = _numero_dia(fila.get("dia"))
            lista_entrada = [fila]

        destino = grupos.setdefault(numero, [])
        for ej in lista_entrada:
            nombre_propio = _texto(ej.get("nombre_ejercicio") or ej.get("nombre"))
            glob = buscar_ejercicio_global(db, _texto(ej.get("idEjercicio")))
            if not glob and nombre_propio:
                glob = por_nombre.get(nombre_propio.casefold())
            if glob:
                ej = {**ej,
                      "idEjercicio": _texto(glob.get("idEjercicio")) or str(glob.get("_id", "")),
                      "nombre_ejercicio": _texto(glob.get("nombre"))}
            elif not nombre_propio:
                raise ValueError("Cada ejercicio debe existir en el catálogo global.")
            # Si no está en el catálogo pero tiene nombre (rutinas cargadas a mano en Atlas),
            # se conserva tal cual en vez de impedir guardar la rutina.
            destino.append(_armar_ejercicio(ej, len(destino) + 1, por_id, por_nombre))

    dias = []
    for numero, ejercicios in sorted(grupos.items()):
        m = meta.get(numero, {})
        dias.append({
            "id_dia": _texto(m.get("id_dia")) or f"dia{numero}",
            "orden": numero,
            "nombre": _texto(m.get("nombre")) or f"Día {numero}",
            "grupo_muscular": m.get("grupo_muscular") or [],
            "tipo_intensidad": _texto(m.get("tipo_intensidad")),
            "intensidad": _texto(m.get("intensidad")),
            "incluye_abdomen": m.get("incluye_abdomen", True),
            "ejercicios": ejercicios,
        })

    split_doc = _validar(SplitSerializer, {
        "dias_entrenamiento": split.get("dias_entrenamiento") or len(dias),
        "secuencia": split.get("secuencia") or [],
        "repetir": split.get("repetir", True),
        "descripcion": _texto(split.get("descripcion")),
    })

    return {
        "nombre": nombre,
        "nivel": nivel,
        "descripcion": _texto(payload.get("descripcion")),
        "split": split_doc,
        "cardio": _validar(CardioSerializer, payload["cardio"]) if payload.get("cardio") else None,
        "abdomen": _validar(AbdomenSerializer, payload["abdomen"]) if payload.get("abdomen") else None,
        "notas_generales": payload.get("notas_generales") or [],
        "dias": _validar(DiasRutinasPredeterminadasSerializer, dias, many=True),
        "activa": bool(payload.get("activa", True)),
        # Alias legado: quitar cuando nada más lea Rutina / enfoqueRutina
        "Rutina": nombre,
        "enfoqueRutina": _texto(split.get("descripcion")),
    }

def ejercicio_a_api(ejercicio):
    """Entrega los nombres de API que ya consume la app usando los campos guardados."""
    if not ejercicio:
        return None
    return {
        "id": _texto(ejercicio.get("idEjercicio")) or str(ejercicio.get("_id", "")),
        "nombreEjercicio": _texto(ejercicio.get("nombre")),
        "equipo": _texto(ejercicio.get("equipo")),
        "video": _texto(ejercicio.get("videoTutorial")),
    }

def buscar_ejercicio_global(db, identificador):
    """Busca el ejercicio global por el ID público existente o por su _id de Mongo."""
    identificador = _texto(identificador)
    if not identificador:
        return None
    encontrado = db.ejercicios.find_one({"idEjercicio": identificador})
    if encontrado:
        return encontrado
    try:
        return db.ejercicios.find_one({"_id": ObjectId(identificador)})
    except (InvalidId, TypeError):
        return None

def _indice_ejercicios(db):
    """Indexa ejercicios existentes por sus identificadores y nombres únicos."""
    por_id = {}
    por_nombre = {}
    nombres_repetidos = set()

    for ejercicio in db.ejercicios.find({}, {"_id": 1, "idEjercicio": 1, "nombre": 1, "equipo": 1, "videoTutorial": 1}):
        identificador = _texto(ejercicio.get("idEjercicio")) or str(ejercicio.get("_id", ""))
        if identificador:
            por_id[identificador] = ejercicio
        nombre = _texto(ejercicio.get("nombre")).casefold()
        if nombre:
            if nombre in por_nombre:
                nombres_repetidos.add(nombre)
            else:
                por_nombre[nombre] = ejercicio

    for nombre in nombres_repetidos:
        por_nombre.pop(nombre, None)
    return por_id, por_nombre

def _numero_dia(valor):
    """Obtiene el número de día aunque los registros antiguos guarden texto."""
    if isinstance(valor, int):
        return max(1, valor)
    coincidencia = re.search(r"\d+", _texto(valor))
    return int(coincidencia.group()) if coincidencia else 1

def _texto(valor):
    return str(valor or "").strip()