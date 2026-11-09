"""Extração de dados da mensagem por regex: dia, hora e serviço."""
import difflib
import re

from .nlp import strip_accents

DAYS = {"hoje": "hoje", "amanha": "amanhã", "segunda": "segunda", "terca": "terça", "quarta": "quarta", "quinta": "quinta",
        "sexta": "sexta", "sabado": "sábado", "domingo": "domingo"}


def extract_day(text: str):
    t = strip_accents(text.lower())
    for k, v in DAYS.items():
        if re.search(rf"\b{k}\b", t):
            return v
    m = re.search(r"\b(\d{1,2})/(\d{1,2})\b", t)
    return f"{int(m[1]):02d}/{int(m[2]):02d}" if m else None


def extract_time(text: str):
    t = strip_accents(text.lower())
    m = re.search(r"\b([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)?\b", t) or re.search(r"\bas\s+([01]?\d|2[0-3])\b(?!/)", t)
    if not m:
        return None
    h, mi = int(m[1]), int(m[2]) if m.lastindex and m.lastindex >= 2 and m[2] else 0
    return f"{h:02d}:{mi:02d}"


def extract_service(text: str, services: list[str]):
    t = strip_accents(text.lower())
    for s in sorted(services, key=len, reverse=True):  # "corte e barba" antes de "corte"
        if strip_accents(s) in t:
            return s
    words = re.findall(r"[a-z]+", t)
    for w in words:
        m = difflib.get_close_matches(w, [strip_accents(s) for s in services if " " not in s], n=1, cutoff=0.8)
        if m:
            return next(s for s in services if strip_accents(s) == m[0])
    return None
