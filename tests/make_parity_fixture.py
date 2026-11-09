"""Gera tests/parity_fixture.json: respostas do bot em Python, que o bot em JavaScript (docs/bot.js) deve repetir.
Uso: PYTHONPATH=. python3 tests/make_parity_fixture.py"""
import json, os
from bots.support.engine import Bot, Session
from tests.support_eval_set import EVAL
from tests.support_heldout_set import HELDOUT

CFG = os.path.join(os.path.dirname(__file__), "..", "bots", "support", "configs", "barbearia.json")
EXTRA = ["oi", "OIIIII", "qto custa o corte e barba", "vcs aceitam pix ou cartão", "q horas vcs abrem", "onde ficaa a barbearia",
         "tem horário pra sexta?", "quero cortar o cabelo", "quero agendar barba terça às 9:30", "marcar corte dia 12/05",
         "sombrancelha quanto é", "atendimento péssimo", "vou chamar o procon", "preciso falar com humano", "cancelar meu horário",
         "kkkkk", "123", "", "quero agendar", "valeu, obrigado!", "tem desconto?", "vocês fazem tatuagem",
         "qual o valor da sobrancelha e da barba", "que dia vcs fecham", "boa noite, tudo bem?", "me manda o endereço por favor"]
DIALOGS = [
    ["quero agendar corte", "sexta", "15h"],
    ["quero marcar barba amanhã", "às 10h"],
    ["agendar corte e barba", "sábado", "9:30", "obrigado"],
    ["quero agendar corte", "na verdade o último corte foi horrível"],
    ["quero agendar", "corte", "quanto custa?", "hoje", "14h"],
    ["quero agendar corte sexta", "quero falar com atendente"],
]

def row(r):
    return {"intent": r.intent, "handoff": r.handoff, "booking": r.booking, "confidence": round(r.confidence, 6), "text": r.text}

def build():
    bot = Bot.from_file(CFG)
    phrases = list(dict.fromkeys([t for t, _ in EVAL + HELDOUT] + EXTRA))
    singles = [{"input": t, **row(bot.reply(t, Session()))} for t in phrases]
    dialogs = []
    for turns in DIALOGS:
        b, s, out = Bot.from_file(CFG), Session(), []
        for t in turns:
            out.append({"input": t, **row(b.reply(t, s))})
        dialogs.append(out)
    return {"singles": singles, "dialogs": dialogs}

if __name__ == "__main__":
    path = os.path.join(os.path.dirname(__file__), "parity_fixture.json")
    json.dump(build(), open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("fixture:", len(build()["singles"]), "frases,", len(DIALOGS), "conversas")
