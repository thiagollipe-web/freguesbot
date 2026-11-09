"""Lead scoring por regras explícitas (cada ponto tem um motivo legível)."""
RULES = [
    (lambda l: bool(l.phone), 3, "tem telefone público (dá para contatar)"),
    (lambda l: not l.website, 3, "sem site (oportunidade de presença digital)"),
    (lambda l: not l.hours, 1, "sem horário informado"),
    (lambda l: bool(l.instagram), 1, "tem Instagram (já investe em divulgação)"),
    (lambda l: bool(l.address), 1, "endereço identificado"),
]
MAX = sum(w for _, w, _ in RULES)


def score(lead):
    pts, why = 0, []
    for cond, w, reason in RULES:
        if cond(lead):
            pts += w
            why.append(reason)
    lead.score = round(10 * pts / MAX, 1)
    lead.reasons = tuple(why)
    return lead
