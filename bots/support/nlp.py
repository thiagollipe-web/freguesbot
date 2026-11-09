"""Pré-processamento e classificador estatístico (TF-IDF + cosseno). Sem LLM, sem dependências."""
import difflib
import math
import re
import unicodedata
from collections import Counter

ABBR = {"vc": "voce", "vcs": "voces", "qto": "quanto", "qnto": "quanto", "q": "que", "tb": "tambem", "pq": "porque",
        "hj": "hoje", "amanha": "amanha", "blz": "beleza", "obg": "obrigado", "vlw": "valeu", "td": "tudo", "pra": "para",
        "ta": "esta", "tah": "esta", "tô": "estou", "to": "estou", "pix": "pix", "msg": "mensagem", "hr": "hora", "hrs": "horas"}
STOP = {"o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "e", "eh", "em", "no", "na", "para", "por", "me", "meu", "minha", "ai", "la", "voce", "voces"}


# Conceitos de comércio em pt-BR: variações viram um token canônico (c_...). Vale para qualquer negócio.
_CONCEPTS = {
    "c_preco": "preco valor valores custa custo custos cobra cobram cobrar tabela quanto",
    "c_horario": "horario horarios abre abrem fecha fecham funciona funcionam funcionamento aberto aberta expediente",
    "c_endereco": "endereco onde fica ficam localizacao rua chego chegar mapa",
    "c_pagamento": "pagamento pagamentos pagar paga pague cartao pix credito debito dinheiro parcela parcelar aceita aceitam",
    "c_servico": "servico servicos fazem fazer oferece oferecem trabalham",
    "c_agendar": "agendar agendamento marcar marca reservar vaga vagas",
}
CONCEPT = {w: c for c, ws in _CONCEPTS.items() for w in ws.split()}


def stem(t: str) -> str:
    return t[:-1] if len(t) > 4 and t.endswith("s") and not t.endswith("ss") else t


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def normalize(text: str) -> list[str]:
    t = strip_accents(text.lower())
    t = re.sub(r"(.)\1{2,}", r"\1", t)  # "oiiii" -> "oi"
    toks = re.findall(r"[a-z0-9]+", t)
    toks = [ABBR.get(x, x) for x in toks]
    toks = [CONCEPT.get(x) or CONCEPT.get(stem(x)) or stem(x) for x in toks]
    return [x for x in toks if x not in STOP]


class Classifier:
    def __init__(self, examples: dict[str, list[str]]):
        self.docs = [(intent, self._feat(normalize(e))) for intent, es in examples.items() for e in es]
        self.vocab = {t for _, toks in self.docs for t in toks}
        df = Counter(t for _, toks in self.docs for t in set(toks))
        n = len(self.docs)
        self.idf = {t: math.log(1 + n / f) for t, f in df.items()}
        self.vecs = [(i, self._vec(toks)) for i, toks in self.docs]

    @staticmethod
    def _feat(toks):  # unigramas + bigramas
        return toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]

    def _fix(self, toks):  # corrige erros de digitação contra o vocabulário conhecido
        uni = {v for v in self.vocab if "_" not in v}
        out = []
        for t in toks:
            if t in uni or len(t) < 4:
                out.append(t)
            else:
                m = difflib.get_close_matches(t, uni, n=1, cutoff=0.8)
                out.append(m[0] if m else t)
        return out

    def _vec(self, feats):
        c = Counter(feats)
        v = {t: (1 + math.log(f)) * self.idf.get(t, 0.0) for t, f in c.items() if t in self.idf}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {t: x / norm for t, x in v.items()}

    def rank(self, text: str) -> list[tuple[str, float]]:
        """[(intenção, confiança 0..1)] em ordem decrescente. Confiança = melhor cosseno com um exemplo da intenção."""
        q = self._vec(self._feat(self._fix(normalize(text))))
        best: dict[str, float] = {}
        for intent, v in self.vecs:
            s = sum(w * v.get(t, 0.0) for t, w in q.items())
            if s > best.get(intent, 0.0):
                best[intent] = s
        return sorted(best.items(), key=lambda x: -x[1])
