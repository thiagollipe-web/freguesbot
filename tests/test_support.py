import os, unittest
from core import db
from bots.support import slots
from bots.support.engine import Bot, Session
from bots.support.nlp import normalize
from tests.support_eval_set import EVAL

CFG = os.path.join(os.path.dirname(__file__), "..", "bots", "support", "configs", "barbearia.json")

def verdict(bot, text):
    r = bot.reply(text, Session())
    return "handoff" if r.handoff else r.intent

class Nlp(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(normalize("Qto é o corte??"), ["c_preco", "corte"])
        self.assertEqual(normalize("oiiii"), ["oi"])

class Slots(unittest.TestCase):
    def test_time_and_day(self):
        self.assertEqual(slots.extract_time("sexta as 15h"), "15:00")
        self.assertEqual(slots.extract_time("às 9:30"), "09:30")
        self.assertIsNone(slots.extract_time("dia 12/05"))
        self.assertEqual(slots.extract_day("amanhã"), "amanhã")
        self.assertEqual(slots.extract_day("dia 12/5"), "12/05")
    def test_service_fuzzy_and_longest(self):
        sv = ["corte", "barba", "corte e barba", "sobrancelha"]
        self.assertEqual(slots.extract_service("quero corte e barba", sv), "corte e barba")
        self.assertEqual(slots.extract_service("faz sombrancelha?", sv), "sobrancelha")

class Dialog(unittest.TestCase):
    def setUp(self): self.bot = Bot.from_file(CFG)
    def test_price_answer_uses_real_data(self):
        r = self.bot.reply("quanto custa o corte", Session())
        self.assertIn("R$ 40", r.text); self.assertFalse(r.handoff)
    def test_booking_flow_collects_missing_slots(self):
        s = Session()
        r1 = self.bot.reply("quero agendar corte", s); self.assertIn("dia", r1.text.lower())
        r2 = self.bot.reply("sexta", s); self.assertIn("horário", r2.text.lower())
        r3 = self.bot.reply("15h", s)
        self.assertEqual(r3.booking, {"servico": "corte", "dia": "sexta", "hora": "15:00"})
        self.assertEqual(s.state, "idle")
    def test_booking_in_one_message(self):
        r = self.bot.reply("quero agendar corte e barba amanhã às 10h", Session())
        self.assertEqual(r.booking, {"servico": "corte e barba", "dia": "amanhã", "hora": "10:00"})
    def test_unknown_is_logged_for_owner(self):
        con = db.connect(":memory:"); bot = Bot.from_file(CFG, con=con)
        self.assertTrue(bot.reply("qual a previsão do tempo", Session()).handoff)
        self.assertEqual(con.execute("SELECT question FROM unanswered").fetchone()[0], "qual a previsão do tempo")
    def test_teach_changes_behavior(self):
        q = "vocês fazem pigmentação de barba"
        self.assertTrue(self.bot.reply(q, Session()).handoff)
        self.bot.teach(q, "servicos")
        self.assertEqual(self.bot.reply(q, Session()).intent, "servicos")
    def test_never_invents_price_for_unknown_service(self):
        r = self.bot.reply("quanto custa luzes no cabelo", Session())
        self.assertNotIn("luzes", r.text.lower())

class Safety(unittest.TestCase):
    def test_complaint_always_goes_to_human(self):
        bot = Bot.from_file(CFG)
        for msg in ["o corte ficou ruim, quero reclamar", "estou muito insatisfeito", "vou chamar o procon", "atendimento péssimo"]:
            r = bot.reply(msg, Session()); self.assertTrue(r.handoff, msg); self.assertEqual(r.intent, "reclamacao")
    def test_complaint_interrupts_booking(self):
        bot = Bot.from_file(CFG); s = Session()
        bot.reply("quero agendar corte", s)
        self.assertTrue(bot.reply("na verdade o último corte foi horrível", s).handoff)
        self.assertEqual(s.state, "idle")

class Eval(unittest.TestCase):
    def test_accuracy_report(self):
        bot = Bot.from_file(CFG)
        wrong = [(t, e, verdict(bot, t)) for t, e in EVAL if verdict(bot, t) != e]
        acc = 1 - len(wrong) / len(EVAL)
        print(f"\nACERTO: {acc:.0%} ({len(EVAL) - len(wrong)}/{len(EVAL)})")
        for w in wrong: print("  errou:", w)
        self.assertGreaterEqual(acc, 0.80)

if __name__ == "__main__":
    unittest.main()
