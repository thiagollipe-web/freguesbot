"""Motor de busca central: baixa o README do public-apis, indexa no SQLite e busca por BM25."""
import re
import sqlite3
import urllib.request

from .bm25 import BM25, tokenize

README_URL = "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md"
_ROW = re.compile(r"^\|\s*\[(?P<name>[^\]]+)\]\((?P<url>[^)]+)\)\s*\|(?P<rest>.*)\|\s*$")


def parse_readme(md: str) -> list[dict]:
    """Extrai linhas de tabela '| [Nome](url) | descrição | auth | https | cors |' com a categoria '### X'."""
    category, rows = "", []
    for line in md.splitlines():
        if line.startswith("### "):
            category = line[4:].strip()
            continue
        m = _ROW.match(line.strip())
        if not m or not category:
            continue
        cols = [c.strip() for c in m["rest"].split("|")]
        if len(cols) < 4:
            continue
        desc, auth, https, cors = cols[0], cols[1].strip("`"), cols[2], cols[3]
        rows.append({"name": m["name"], "url": m["url"], "description": desc, "auth": auth,
                     "https": 1 if https.lower() == "yes" else 0, "cors": cors, "category": category})
    return rows


def sync(con: sqlite3.Connection, fetch=None) -> int:
    """Baixa e recarrega o índice. `fetch` é injetável para testes."""
    md = (fetch or (lambda: urllib.request.urlopen(urllib.request.Request(README_URL, headers={"User-Agent": "freguesbot/0.1"}), timeout=30).read().decode("utf-8")))()
    rows = parse_readme(md)
    if not rows:
        raise RuntimeError("README sem tabelas reconhecíveis; índice anterior mantido")
    with con:
        con.execute("DELETE FROM apis")
        con.executemany("INSERT OR REPLACE INTO apis VALUES(:name,:url,:description,:auth,:https,:cors,:category)", rows)
    return len(rows)


def search(con: sqlite3.Connection, query: str, k: int = 5, no_auth_only: bool = False) -> list[dict]:
    rows = [dict(r) for r in con.execute("SELECT * FROM apis")]
    if no_auth_only:
        rows = [r for r in rows if r["auth"].lower() == "no"]
    if not rows:
        return []
    # categoria e nome pesam mais: aparecem repetidos no documento
    docs = [tokenize(f"{r['name']} {r['name']} {r['category']} {r['category']} {r['description']}") for r in rows]
    scores = BM25(docs).scores(tokenize(query))
    ranked = sorted(zip(scores, rows), key=lambda x: -x[0])
    return [{**r, "score": round(s, 3)} for s, r in ranked[:k] if s > 0]
