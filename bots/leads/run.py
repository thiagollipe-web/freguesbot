"""Uso: python -m bots.leads.run --niche barbearia --city Goiânia --state Goiás [--csv saida.csv]"""
import argparse
import csv
import json

from core import db, donate
from . import osm, playbook, scoring


def tip_stats(con) -> dict:
    rows = con.execute("SELECT tip_id, SUM(outcome='won'), COUNT(*) FROM tips_log WHERE outcome IS NOT NULL GROUP BY tip_id").fetchall()
    return {r[0]: (r[1] or 0, r[2]) for r in rows}


def run(con, niche, city, state=None, limit=300, fetcher=osm.fetch, top=20):
    query = osm.build_query(niche, city, state, limit)
    leads = [scoring.score(l) for l in osm.parse(fetcher(query), niche, city)]
    leads.sort(key=lambda l: l.score, reverse=True)
    run_id = con.execute("INSERT INTO runs(bot, params) VALUES('leads', ?)", (json.dumps({"niche": niche, "city": city, "state": state}),)).lastrowid
    for l in leads:
        con.execute("""INSERT INTO leads(run_id,osm_id,name,niche,city,phone,website,instagram,address,hours,score,reasons)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(osm_id) DO UPDATE SET score=excluded.score, reasons=excluded.reasons""",
                    (run_id, l.osm_id, l.name, l.niche, l.city, l.phone, l.website, l.instagram, l.address, l.hours, l.score, "; ".join(l.reasons)))
    con.commit()
    stats = tip_stats(con)
    return [(l, playbook.rank_tips(l, stats)) for l in leads[:top]], len(leads)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="leads")
    ap.add_argument("--db", default="freguesbot.db")
    ap.add_argument("--niche", required=True, choices=sorted(osm.NICHES))
    ap.add_argument("--city", required=True)
    ap.add_argument("--state")
    ap.add_argument("--top", type=int, default=20)
    ap.add_argument("--csv")
    a = ap.parse_args(argv)
    con = db.connect(a.db)
    ranked, total = run(con, a.niche, a.city, a.state, top=a.top)
    for l, tips in ranked:
        print(f"{l.score:4.1f}  {l.name} | {l.phone or 'sem telefone'} | {'; '.join(l.reasons)}")
        print(f"      → {tips[0][1]}")
    print(f"{total} estabelecimentos encontrados. Dados © OpenStreetMap contributors (ODbL).")
    print(donate.footer(), end='')
    if a.csv:
        with open(a.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["score", "nome", "telefone", "site", "instagram", "endereco", "motivos", "dica"])
            for l, tips in ranked:
                w.writerow([l.score, l.name, l.phone, l.website, l.instagram, l.address, "; ".join(l.reasons), tips[0][1]])


if __name__ == "__main__":
    main()
