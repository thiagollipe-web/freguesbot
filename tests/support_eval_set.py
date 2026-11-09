# (frase, intenção esperada). "handoff" = o bot deve encaminhar para humano. Frases escritas à parte dos exemplos de treino.
EVAL = [
 ("bom diaa", "saudacao"), ("oii tudo bem?", "saudacao"), ("boa noite pessoal", "saudacao"),
 ("qto é o corte?", "preco"), ("quanto ta a barba", "preco"), ("qual valor do corte e barba?", "preco"), ("me manda a tabela de valores", "preco"), ("cobram quanto pela sobrancelha", "preco"),
 ("vcs abrem aos sabados?", "horario"), ("até q horas vcs ficam abertos", "horario"), ("qual horario voces funcionam", "horario"), ("hj esta aberto?", "horario"),
 ("onde vcs ficam?", "endereco"), ("qual é o endereço de vocês", "endereco"), ("como faço pra chegar ai", "endereco"), ("manda a localização",  "endereco"),
 ("aceitam cartão?", "pagamento"), ("posso pagar no pix", "pagamento"), ("quais as formas de pagamento", "pagamento"),
 ("o que vcs fazem?", "servicos"), ("fazem sobrancelha ai?", "servicos"), ("quais serviços tem", "servicos"),
 ("queria marcar um horario", "agendar"), ("tem vaga amanha?", "agendar"), ("quero agendar corte sexta as 15h", "agendar"),
 ("preciso cancelar meu horario", "handoff"), ("quero falar com o dono", "handoff"), ("me chama um atendente", "handoff"),
 ("valeu!", "agradecimento"), ("muito obrigado", "agradecimento"), ("obg", "agradecimento"),
 # fora do domínio: o certo é NÃO inventar resposta
 ("vocês vendem pomada importada de cabelo?", "handoff"), ("meu cabelo caiu depois do corte, o que faço", "handoff"),
 ("vocês trabalham com noivos no casamento", "handoff"), ("qual a previsão do tempo", "handoff"), ("posso levar meu cachorro", "handoff"),
 ("estou muito insatisfeito com o atendimento", "handoff"),
]
