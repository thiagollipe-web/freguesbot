import csv, math, os, tempfile, unittest
from core import apiindex, db
from core.bm25 import BM25, tokenize
from bots.viral import scoring, shortener, run
from bots.viral.scoring import Item

SNAP = open(os.path.join(os.path.dirname(__file__), "public-apis-snapshot.md"), encoding="utf-8").read()

class Bm25(unittest.TestCase):
    def test_ranks_relevant_doc_first(self):
        docs = [tokenize(t) for t in ["currency exchange rates", "weather forecast", "url shortener"]]
        s = BM25(docs).scores(tokenize("moeda exchange"))
        self.assertEqual(s.index(max(s)), 0)
    def test_no_match_is_zero(self):
        self.assertEqual(BM25([tokenize("weather")]).scores(tokenize("xyz")), [0.0])

class Index(unittest.TestCase):
    def setUp(self):
        self.con = db.connect(":memory:")
        self.n = apiindex.sync(self.con, fetch=lambda: SNAP)
    def test_parses_many_rows(self):
        self.assertGreater(self.n, 1000)
    def test_row_fields(self):
        r = self.con.execute("SELECT * FROM apis WHERE name='CleanURI'").fetchone()
        self.assertEqual((r["auth"], r["https"], r["category"]), ("No", 1, "URL Shorteners"))
    def test_shortener_search_finds_url_shorteners(self):
        names = [c["name"] for c in apiindex.search(self.con, "url shortener", k=10)]
        self.assertIn("CleanURI", names)
    def test_no_auth_filter(self):
        self.assertTrue(all(c["auth"] == "No" for c in apiindex.search(self.con, "url shortener", k=10, no_auth_only=True)))
    def test_empty_readme_keeps_old_index(self):
        with self.assertRaises(RuntimeError):
            apiindex.sync(self.con, fetch=lambda: "nada aqui")
        self.assertGreater(self.con.execute("SELECT COUNT(*) FROM apis").fetchone()[0], 1000)

class Scoring(unittest.TestCase):
    def mk(self, n): return [Item("t", f"p{i}", f"u{i}", engagement=i, followers=1000) for i in range(1, n + 1)]
    def test_top_5pct_of_100_is_5(self):
        top = scoring.select_top(self.mk(100))
        self.assertEqual(len(top), 5); self.assertEqual(top[0].title, "p100")
    def test_at_least_one(self):
        self.assertEqual(len(scoring.select_top(self.mk(3))), 1)
    def test_min_followers_blocks_tiny_accounts(self):
        items = [Item("t", "tiny", "u", 5, 2), Item("t", "real", "u", 50, 1000)]
        self.assertEqual(scoring.select_top(items, pct=1)[0].title, "real")
    def test_zero_followers_is_safe(self):
        self.assertEqual(scoring.rate(10, 0), 0.0); self.assertEqual(scoring.select_top([Item("t","a","u",1,0)]), [])
    def test_rate_value(self):
        self.assertTrue(math.isclose(scoring.rate(50, 1000), 0.05))
    def test_invalid_pct(self):
        with self.assertRaises(ValueError): scoring.select_top([], pct=0)

class Shorten(unittest.TestCase):
    def setUp(self):
        self.con = db.connect(":memory:"); apiindex.sync(self.con, fetch=lambda: SNAP)
    def test_picks_approved_adapter_only(self):
        name, _ = shortener.pick(self.con, {"CleanURI": lambda u: "x"})
        self.assertEqual(name, "CleanURI")
        self.assertIsNone(shortener.pick(self.con, {}))
    def test_success_is_logged(self):
        self.assertEqual(shortener.shorten(self.con, "http://a", {"CleanURI": lambda u: "https://s/1"}), "https://s/1")
        self.assertEqual(self.con.execute("SELECT ok FROM api_logs").fetchone()[0], 1)
    def test_failure_returns_none_and_logs(self):
        def boom(u): raise OSError("rede")
        self.assertIsNone(shortener.shorten(self.con, "http://a", {"CleanURI": boom}))
        self.assertEqual(self.con.execute("SELECT ok FROM api_logs").fetchone()[0], 0)

class Cli(unittest.TestCase):
    def test_csv_end_to_end(self):
        d = tempfile.mkdtemp(); p = os.path.join(d, "x.csv"); dbp = os.path.join(d, "b.db")
        with open(p, "w", newline="") as f:
            w = csv.writer(f); w.writerow(["title", "url", "engagement", "followers"])
            for i in range(1, 41): w.writerow([f"post{i}", f"http://x/{i}", i * 10, 1000])
        # índice pré-carregado para não depender de rede
        con = db.connect(dbp); apiindex.sync(con, fetch=lambda: SNAP); con.close()
        run.main(["--db", dbp, "--csv", p])
        con = db.connect(dbp)
        self.assertEqual(con.execute("SELECT COUNT(*) FROM items").fetchone()[0], 2)  # ceil(40*5%)
        self.assertEqual(con.execute("SELECT title FROM items ORDER BY rate DESC").fetchone()[0], "post40")

class Parity(unittest.TestCase):
    def test_js_fixture_is_fresh(self):
        """Se o Python mudou, rode tests/make_parity_fixture.py: o JavaScript (docs/bot.js) é testado contra esse arquivo."""
        import json
        from tests import make_parity_fixture
        path = os.path.join(os.path.dirname(__file__), "parity_fixture.json")
        self.assertEqual(make_parity_fixture.build(), json.load(open(path, encoding="utf-8")))

if __name__ == "__main__":
    unittest.main()
