"""Motor de atendimento: intenção -> resposta, com dados da conversa e transbordo para humano."""
import json
import random
import re
from dataclasses import dataclass, field

from . import slots
from .nlp import Classifier, strip_accents

REQUIRED = ["servico", "dia", "hora"]
ASK = {"servico": "Qual serviço você quer? ({lista})", "dia": "Para qual dia?", "hora": "Qual horário prefere?"}


@dataclass
class Reply:
    text: str
    intent: str = ""
    confidence: float = 0.0
    handoff: bool = False
    booking: dict | None = None


@dataclass
class Session:
    state: str = "idle"
    slots: dict = field(default_factory=dict)


# Cliente insatisfeito nunca é atendido por fluxo automático: vai direto para uma pessoa.
COMPLAINT = re.compile(r"reclam|ruim|pessim|horrivel|insatisf|decepcion|absurd|problema|errado|reembolso|procon|processo|nunca mais|demor", re.I)


class Bot:
    def __init__(self, config: dict, threshold: float = 0.55, margin: float = 0.08, con=None, seed: int = 0,
                 min_conf: float = 0.35, min_gap: float = 0.15):
        self.cfg, self.threshold, self.margin, self.con = config, threshold, margin, con
        self.min_conf, self.min_gap = min_conf, min_gap
        self.cls = Classifier({k: v["examples"] for k, v in config["intents"].items()})
        self.rng = random.Random(seed)
        self.services = list(config["data"]["servicos"])

    @classmethod
    def from_file(cls, path, **kw):
        return cls(json.load(open(path, encoding="utf-8")), **kw)

    def _fmt(self, text: str) -> str:
        d = self.cfg["data"]
        tabela = "; ".join(f"{k}: R$ {v}" for k, v in d["servicos"].items())
        return text.format(business=self.cfg["business"], tabela="Nossos preços: " + tabela + ".", lista_servicos=", ".join(d["servicos"]),
                           horario=d["horario"], endereco=d["endereco"], pagamento=d["pagamento"])

    def _handoff(self, question: str, why: str, conf: float = 0.0) -> Reply:
        if self.con is not None:
            self.con.execute("INSERT INTO unanswered(business, question) VALUES(?,?)", (self.cfg["business"], question))
            self.con.commit()
        return Reply(self.cfg["owner_handoff"], why, conf, handoff=True)

    def _fill(self, text: str, s: Session):
        for k, v in (("servico", slots.extract_service(text, self.services)), ("dia", slots.extract_day(text)), ("hora", slots.extract_time(text))):
            if v:
                s.slots[k] = v

    def _booking_step(self, s: Session, conf: float) -> Reply:
        missing = [k for k in REQUIRED if k not in s.slots]
        if missing:
            return Reply(ASK[missing[0]].format(lista=", ".join(self.services)), "agendar", conf)
        b = dict(s.slots)
        s.state, s.slots = "idle", {}
        return Reply(f"Pedido de agendamento: {b['servico']}, {b['dia']} às {b['hora']}. Um atendente vai confirmar a disponibilidade por aqui.", "agendar", conf, booking=b)

    @staticmethod
    def _intent_text(text: str) -> str:
        """Tira dia e hora antes de classificar: 'amanhã às 10h' não diz qual é a intenção."""
        t = re.sub(r"\b(hoje|amanha|amanhã|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b", " ", text, flags=re.I)
        return re.sub(r"\b(?:as|às)?\s*\d{1,2}\s*(?::|h)\s*\d{0,2}|\b\d{1,2}/\d{1,2}\b", " ", t, flags=re.I)

    def _confident(self, ranked) -> bool:
        if not ranked:
            return False
        conf = ranked[0][1]
        gap = conf - (ranked[1][1] if len(ranked) > 1 else 0.0)
        return conf >= self.threshold or (conf >= self.min_conf and gap >= self.min_gap)

    def reply(self, text: str, s: Session) -> Reply:
        if COMPLAINT.search(strip_accents(text)):
            s.state, s.slots = "idle", {}
            return self._handoff(text, "reclamacao", 1.0)
        ranked = self.cls.rank(self._intent_text(text))
        top, conf = ranked[0] if ranked else ("", 0.0)
        # continuação de agendamento: respostas curtas ("sexta", "15h") não têm intenção própria
        if s.state == "booking":
            self._fill(text, s)
            if top in ("cancelar", "humano") and conf >= self.threshold:
                s.state, s.slots = "idle", {}
            elif any(k in s.slots for k in REQUIRED) and (not self._confident(ranked) or top == "agendar"):
                return self._booking_step(s, conf)
        if not ranked or not self._confident(ranked):
            return self._handoff(text, "desconhecido", conf)
        if len(ranked) > 1 and ranked[1][1] >= conf - self.margin and ranked[1][0] != top and conf < 0.8:
            return Reply(f"Só para entender: você quer saber sobre {top} ou {ranked[1][0]}?", "ambiguo", conf)
        if top == "agendar":
            s.state = "booking"
            self._fill(text, s)
            return self._booking_step(s, conf)
        if top in ("humano", "cancelar"):
            return self._handoff(text, top, conf)
        answers = self.cfg["intents"][top]["answers"]
        return Reply(self._fmt(self.rng.choice(answers)), top, conf)

    def teach(self, question: str, intent: str):
        """O dono ensina: a pergunta sem resposta vira exemplo de uma intenção existente e o classificador é refeito."""
        self.cfg["intents"][intent]["examples"].append(question)
        self.cls = Classifier({k: v["examples"] for k, v in self.cfg["intents"].items()})
