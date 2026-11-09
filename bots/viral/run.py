"""Uso: python -m bots.viral.run --csv dados.csv [--pct 0.05] [--shorten] [--sync]"""
import argparse
import json
import os

from core import apiindex, db, donate
from . import shortener, sources
from .scoring import select_top


def main(argv=None):
    ap = argparse.ArgumentParser(prog="viral")
    ap.add_argument("--db", default="freguesbot.db")
    ap.add_argument("--csv")
    ap.add_argument("--reddit", help="subreddits separados por vírgula (usa REDDIT_ID/REDDIT_SECRET)")
    ap.add_argument("--youtube", help="termo de busca (usa YOUTUBE_KEY)")
    ap.add_argument("--pct", type=float, default=0.05)
    ap.add_argument("--min-followers", type=float, default=100)
    ap.add_argument("--shorten", action="store_true")
    ap.add_argument("--sync", action="store_true", help="atualiza o índice public-apis")
    a = ap.parse_args(argv)

    con = db.connect(a.db)
    if a.sync or not con.execute("SELECT 1 FROM apis LIMIT 1").fetchone():
        print(f"índice public-apis: {apiindex.sync(con)} APIs")

    items = []
    if a.csv:
        items += sources.from_csv(a.csv)
    if a.reddit:
        items += sources.from_reddit(os.environ["REDDIT_ID"], os.environ["REDDIT_SECRET"], a.reddit.split(","))
    if a.youtube:
        items += sources.from_youtube(os.environ["YOUTUBE_KEY"], a.youtube)
    if not items:
        raise SystemExit("nenhuma fonte informada (--csv, --reddit ou --youtube)")

    top = select_top(items, a.pct, a.min_followers)
    run_id = con.execute("INSERT INTO runs(bot, params) VALUES('viral', ?)", (json.dumps(vars(a)),)).lastrowid
    for i in top:
        short = shortener.shorten(con, i.url) if a.shorten else None
        con.execute("INSERT INTO items(run_id,source,title,url,engagement,followers,rate,short_url) VALUES(?,?,?,?,?,?,?,?)",
                    (run_id, i.source, i.title, i.url, i.engagement, i.followers, i.rate, short))
        print(f"{i.rate:7.2%}  {i.title[:70]}  {short or i.url}")
    con.commit()
    print(f"{len(top)} de {len(items)} itens (top {a.pct:.0%})")
    print(donate.footer(), end='')


if __name__ == "__main__":
    main()
