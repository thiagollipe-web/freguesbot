"""Base de conhecimento de vendas (escrita por nós, em regras). Cada dica tem condição e modelo de texto.
O bot não 'aprende' sozinho o que vender: ele aplica estas regras e prioriza as que mais deram resultado (tips_log)."""
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Tip:
    id: str
    when: Callable
    text: str  # usa {nome}


TIPS = [
    Tip("sem_site", lambda l: not l.website and not l.instagram,
        "{nome} não aparece com site nem Instagram. Abordagem: mostrar o quanto de cliente se perde por não ser achado online e oferecer uma página simples + perfil com bio pronta."),
    Tip("so_instagram", lambda l: l.instagram and not l.website,
        "{nome} tem Instagram mas não tem site. Abordagem: oferecer legendas e anúncios prontos e um link único (WhatsApp) na bio."),
    Tip("sem_horario", lambda l: not l.hours,
        "{nome} não informa horário de funcionamento no mapa. Abordagem: começar por esse quick win (corrigir o perfil) para ganhar confiança antes de vender algo maior."),
    Tip("tem_whatsapp", lambda l: bool(l.phone),
        "{nome} tem telefone público. Abordagem: UMA mensagem personalizada, citando algo específico do negócio, perguntando se faz sentido conversar. Sem disparo em massa."),
    Tip("atendimento", lambda l: True,
        "Pergunte a {nome} quantas mensagens repetidas (preço, horário, endereço) recebe por dia. Se for muito, apresente o atendimento automático com transbordo para humano."),
]


def rank_tips(lead, stats: dict[str, tuple[int, int]] | None = None, k: int = 3):
    """Dicas aplicáveis, ordenadas pela taxa de sucesso suavizada (wins+1)/(shown+2). stats: tip_id -> (wins, shown)."""
    stats = stats or {}
    ok = [t for t in TIPS if t.when(lead)]
    score = lambda t: (stats.get(t.id, (0, 0))[0] + 1) / (stats.get(t.id, (0, 0))[1] + 2)
    ok.sort(key=score, reverse=True)
    return [(t.id, t.text.format(nome=lead.name)) for t in ok[:k]]
