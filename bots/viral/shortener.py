"""Escolhe um encurtador via índice public-apis (BM25), mas só chama adaptadores curados e aprovados."""
import json
import sqlite3
import urllib.parse
import urllib.request

from core import apiindex


def _cleanuri(url: str) -> str:
    data = urllib.parse.urlencode({"url": url}).encode()
    with urllib.request.urlopen(urllib.request.Request("https://cleanuri.com/api/v1/shorten", data=data, headers={"User-Agent": "freguesbot/0.1"}), timeout=20) as r:
        return json.loads(r.read().decode())["result_url"]


# Nome no índice -> função. Só entra aqui o que foi testado e não exige chave.
ADAPTERS = {"CleanURI": _cleanuri}


def pick(con: sqlite3.Connection, adapters: dict = ADAPTERS):
    """Retorna (nome, função) do melhor candidato do índice que tenha adaptador aprovado, ou None."""
    for c in apiindex.search(con, "url shortener link shorten", k=15, no_auth_only=True):
        if c["name"] in adapters:
            return c["name"], adapters[c["name"]]
    return None


def shorten(con: sqlite3.Connection, url: str, adapters: dict = ADAPTERS) -> str | None:
    chosen = pick(con, adapters)
    if not chosen:
        return None
    name, fn = chosen
    try:
        short = fn(url)
        con.execute("INSERT INTO api_logs(api, ok, detail) VALUES(?,?,?)", (name, 1, short))
        con.commit()
        return short
    except Exception as e:  # rede, JSON inesperado, limite
        con.execute("INSERT INTO api_logs(api, ok, detail) VALUES(?,?,?)", (name, 0, str(e)[:200]))
        con.commit()
        return None
