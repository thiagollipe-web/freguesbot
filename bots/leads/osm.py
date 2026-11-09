"""Coleta de estabelecimentos no OpenStreetMap (Overpass). Dados ODbL: cite 'OpenStreetMap contributors'."""
import json
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass

from .niches import NICHES

ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]


@dataclass
class Lead:
    osm_id: str
    name: str
    niche: str
    city: str
    phone: str = ""
    website: str = ""
    instagram: str = ""
    address: str = ""
    hours: str = ""
    score: float = 0.0
    reasons: tuple = ()


def build_query(niche: str, city: str, state: str | None = None, limit: int = 300) -> str:
    if niche not in NICHES:
        raise ValueError(f"nicho desconhecido: {niche}")
    esc = lambda s: s.replace("\\", "").replace('"', "")
    area = (f'area["name"="{esc(state)}"]["admin_level"="4"]->.s;area["name"="{esc(city)}"]["boundary"="administrative"](area.s)->.a;'
            if state else f'area["name"="{esc(city)}"]["boundary"="administrative"]->.a;')
    body = "".join(f"nwr[{f}](area.a);" for f in NICHES[niche])
    return f"[out:json][timeout:50];{area}({body});out tags center {int(limit)};"


def fetch(query: str, endpoints=ENDPOINTS, retries: int = 2, post=None, sleep=time.sleep) -> list[dict]:
    """Tenta cada servidor com recuo exponencial. `post` é injetável para testes."""
    def default_post(url, data):
        req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": data}).encode(), headers={"User-Agent": "freguesbot/0.1"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    post = post or default_post
    last = None
    for attempt in range(retries + 1):
        for ep in endpoints:
            try:
                return post(ep, query)["elements"]
            except Exception as e:  # 502, timeout, JSON inválido
                last = e
        sleep(2 ** attempt)
    raise RuntimeError(f"Overpass indisponível: {last}")


def parse(elements: list[dict], niche: str, city: str) -> list[Lead]:
    out = []
    for e in elements:
        t = e.get("tags", {})
        name = t.get("name", "").strip()
        if not name:
            continue
        addr = " ".join(x for x in [t.get("addr:street", ""), t.get("addr:housenumber", ""), t.get("addr:suburb", "")] if x)
        out.append(Lead(
            osm_id=f"{e.get('type', 'x')}/{e.get('id')}", name=name, niche=niche, city=city,
            phone=t.get("phone") or t.get("contact:phone") or t.get("contact:whatsapp") or "",
            website=t.get("website") or t.get("contact:website") or "",
            instagram=t.get("contact:instagram") or t.get("instagram") or "",
            address=addr, hours=t.get("opening_hours", "")))
    return out
