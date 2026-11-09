"""Matemática do Bot de Pesquisa Viral: taxa = engajamento / seguidores, filtro top N%."""
import math
from dataclasses import dataclass, field


@dataclass
class Item:
    source: str
    title: str
    url: str
    engagement: float          # curtidas + comentários + compartilhamentos (somados pela fonte)
    followers: float           # base de seguidores/inscritos do autor ou da comunidade
    rate: float = field(default=0.0)


def rate(engagement: float, followers: float) -> float:
    return engagement / followers if followers > 0 else 0.0


def select_top(items: list[Item], pct: float = 0.05, min_followers: float = 100) -> list[Item]:
    """Calcula a taxa de cada item e devolve os top `pct` (mín. 1).
    `min_followers` evita que contas minúsculas dominem o ranking (1 curtida / 1 seguidor = 100%)."""
    if not 0 < pct <= 1:
        raise ValueError("pct deve estar em (0, 1]")
    pool = [i for i in items if i.followers >= min_followers and i.engagement >= 0]
    for i in pool:
        i.rate = rate(i.engagement, i.followers)
    pool.sort(key=lambda i: i.rate, reverse=True)
    return pool[: max(1, math.ceil(len(pool) * pct))] if pool else []
