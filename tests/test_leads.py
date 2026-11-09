import unittest
from core import db
from bots.leads import osm, scoring, playbook, run
from bots.leads.osm import Lead

# Fixture: formato de tags típico do OSM (premissa minha; a cobertura real de tags não foi medida).
ELS = [
    {"type": "node", "id": 1, "tags": {"name": "Barbearia A", "phone": "+55 62 3000-0001", "addr:street": "Rua 1", "addr:housenumber": "10"}},
    {"type": "node", "id": 2, "tags": {"name": "Barbearia B", "contact:phone": "+55 62 3000-0002", "website": "https://b.com", "opening_hours": "Mo-Sa 09:00-19:00", "contact:instagram": "b"}},
    {"type": "way", "id": 3, "tags": {"shop": "hairdresser"}},                       # sem nome: descartar
    {"type": "node", "id": 4, "tags": {"name": "Barbearia D"}},                        # sem contato
]

class Leads(unittest.TestCase):
    def test_parse_skips_unnamed_and_reads_alt_tags(self):
        ls = osm.parse(ELS, "barbearia", "Goiânia")
        self.assertEqual([l.name for l in ls], ["Barbearia A", "Barbearia B", "Barbearia D"])
        self.assertEqual(ls[1].phone, "+55 62 3000-0002")
        self.assertEqual(ls[0].address, "Rua 1 10")
    def test_score_prefers_reachable_without_site(self):
        a, b, d = [scoring.score(l) for l in osm.parse(ELS, "barbearia", "G")]
        self.assertGreater(a.score, b.score); self.assertGreater(a.score, d.score)
        self.assertTrue(a.reasons)
    def test_query_has_state_and_filters(self):
        q = osm.build_query("barbearia", "Goiânia", "Goiás")
        self.assertIn('"admin_level"="4"', q); self.assertIn("hairdresser", q)
    def test_query_blocks_injection(self):
        q = osm.build_query("barbearia", 'X"];out;', None)
        self.assertNotIn('X"]', q)
    def test_unknown_niche(self):
        with self.assertRaises(ValueError): osm.build_query("x", "y")
    def test_fetch_retries_then_uses_mirror(self):
        calls = []
        def post(ep, q):
            calls.append(ep)
            if len(calls) < 3: raise OSError("502")
            return {"elements": ELS}
        self.assertEqual(len(osm.fetch("q", endpoints=["e1", "e2"], post=post, sleep=lambda s: None)), 4)
    def test_fetch_gives_clear_error(self):
        def post(ep, q): raise OSError("502")
        with self.assertRaises(RuntimeError): osm.fetch("q", post=post, sleep=lambda s: None, retries=1)
    def test_tips_are_ranked_by_results(self):
        l = scoring.score(osm.parse(ELS, "barbearia", "G")[0])
        base = [t for t, _ in playbook.rank_tips(l, {}, k=5)]
        learned = [t for t, _ in playbook.rank_tips(l, {"atendimento": (9, 10)}, k=5)]
        self.assertEqual(learned[0], "atendimento"); self.assertNotEqual(base[0], "atendimento")
    def test_end_to_end_persists_and_dedupes(self):
        con = db.connect(":memory:")
        ranked, total = run.run(con, "barbearia", "Goiânia", fetcher=lambda q: ELS)
        run.run(con, "barbearia", "Goiânia", fetcher=lambda q: ELS)
        self.assertEqual(total, 3); self.assertEqual(con.execute("SELECT COUNT(*) FROM leads").fetchone()[0], 3)
        self.assertEqual(ranked[0][0].name, "Barbearia A")

if __name__ == "__main__":
    unittest.main()
