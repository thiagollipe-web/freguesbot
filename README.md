# freguesbot

Bots clássicos em Python para pequenos negócios: **sem LLM, sem IA generativa, sem mensalidade.**
Regras, estatística (BM25/TF-IDF), regex e SQLite. Roda localmente e não envia seus dados a ninguém.

> Projeto gratuito e aberto. Se ele te ajudou, veja [como apoiar](#apoie-o-projeto). Sem obrigação.

## O que tem
| Bot | O que faz | Estado |
|---|---|---|
| `bots/leads` | Nicho + cidade → estabelecimentos do OpenStreetMap, nota por regras explicáveis, dica de abordagem. **Não dispara mensagens.** | Lógica testada; coleta ao vivo não validada (veja Limitações) |
| `bots/support` | Atendimento: intenção (TF-IDF), gírias e erros de digitação, agendamento, transbordo para humano, reclamação sempre vai para pessoa | Testado com FAQ de exemplo |
| `bots/viral` | `engajamento ÷ seguidores`, top N% | Testado com CSV; Reddit/YouTube exigem suas credenciais |
| `core/` | BM25, SQLite e índice local do repositório [public-apis](https://github.com/public-apis/public-apis) | Testado |

## Uso
Requer Python 3.11+. Nenhuma dependência externa.

```bash
python3 -m bots.leads.run --niche barbearia --city "Goiânia" --state "Goiás" --csv leads.csv
python3 -m bots.viral.run --csv dados.csv --pct 0.05
PYTHONPATH=. python3 -m unittest discover -s tests -t .      # testes do Python
node --test docs/pix.test.mjs docs/bot.test.mjs               # Pix e equivalência JS↔Python
```
Para atender outro negócio, copie `bots/support/configs/barbearia.json` e troque horários, preços e perguntas.

## Site (`docs/`)
Vitrine estática, sem build e sem dependências: uma "comanda de balcão" com o **bot de atendimento rodando no navegador** (`docs/bot.js`, porta do Python). A equivalência é testada: `tests/make_parity_fixture.py` gera as respostas do Python e `docs/bot.test.mjs` exige que o JavaScript repita todas. Se mudar o Python, regenere o arquivo (um teste avisa).
Para ver localmente: `python3 -m http.server -d docs 8000`. Respeita `prefers-reduced-motion`.

## Limitações (medidas, não maquiadas)
- **Atendimento:** 75% de acerto em 28 frases novas escritas depois dos ajustes; 4 respostas erradas antes da trava de reclamações. Com o FAQ real do negócio melhora, mas não é um chat aberto: o que não entende vai para um humano.
- **Leads:** usa o Overpass público do OpenStreetMap, que é instável (respondeu 502 em testes). O código tenta de novo e usa servidor alternativo. A cobertura de telefone/site nos dados do OSM **não foi medida**.
- **Pesquisa viral:** o Reddit bloqueia acesso anônimo (403); use a API oficial. Respeite os termos de cada plataforma.
- **Contato com leads:** o projeto só sugere a abordagem. Disparo em massa viola termos de WhatsApp/e-mail e pode violar a LGPD.
- Os 2.377 itens do índice `public-apis` são só uma lista; só chamamos APIs com adaptador testado.

## Apoie o projeto
Gratuito e continuará sendo. Se te poupou tempo, qualquer valor via Pix ajuda. Chave Pix: `+5511986455390` (Thiago Fillipe Soares).
A mensagem no terminal pode ser desligada com `FREGUESBOT_NO_DONATE=1`.

## Licença
MIT. Dados de estabelecimentos © OpenStreetMap contributors (ODbL). Fontes Bricolage Grotesque e IBM Plex Mono sob a SIL Open Font License.
