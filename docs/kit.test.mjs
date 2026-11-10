// Roda com: node --test docs/kit.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const here = (p) => new URL(p, import.meta.url);
const load = (f) => { const sb = { module: { exports: {} }, TextEncoder, TextDecoder, btoa, atob }; vm.runInNewContext(fs.readFileSync(here(f), "utf8"), sb); return sb.module.exports; };
const { Bot } = load("./bot.js");
const K = load("./kit.js");

const bot = (form = K.EXEMPLO()) => new Bot(K.buildConfig(form));
const say = (b, t, s = Bot.newSession()) => b.reply(t, s);

test("preço aceita vírgula, ponto e R$; recusa lixo", () => {
  assert.equal(K.parsePreco("40"), 40);
  assert.equal(K.parsePreco("R$ 30,50"), 30.5);
  assert.equal(K.parsePreco("1.234,50"), 1234.5);
  assert.equal(K.parsePreco("40.5"), 40.5);
  for (const x of ["", "abc", "-5", "10,999", "a combinar"]) assert.equal(K.parsePreco(x), null, x);
  assert.equal(K.brl(40), "R$ 40");
  assert.equal(K.brl(30.5), "R$ 30,50");
});

test("WhatsApp vira número internacional ou vazio", () => {
  assert.equal(K.normWhats("(11) 98645-5390"), "5511986455390");
  assert.equal(K.normWhats("+55 11 98645-5390"), "5511986455390");
  assert.equal(K.normWhats("12345"), "");
  assert.match(K.waLink("11986455390", "oi & tchau"), /^https:\/\/wa\.me\/5511986455390\?text=oi%20%26%20tchau$/);
  assert.equal(K.waLink("", "x"), "");
});

test("validação: erros bloqueiam, avisos não", () => {
  const v = K.validate(K.VAZIO());
  assert.equal(v.errors.length, 2);
  const ok = K.validate(K.EXEMPLO());
  assert.equal(ok.errors.length, 0);
  assert.ok(ok.warnings.some((w) => /WhatsApp/.test(w)));
  const f = K.EXEMPLO(); f.servicos.push({ nome: "peeling", preco: "caro" });
  assert.ok(K.validate(f).warnings.some((w) => /ficou de fora/.test(w)));
});

test("link: ida e volta preserva acentos e quebras de linha; lixo vira null", () => {
  const f = K.EXEMPLO(); f.whats = "11986455390"; f.nome = "Açaí & Cia ✂️";
  const back = K.decodeForm(K.encodeForm(f));
  assert.equal(back.nome, "Açaí & Cia ✂️");
  assert.equal(back.faqs[0].perguntas, f.faqs[0].perguntas);
  assert.equal(back.servicos[3].preco, "30,50");
  for (const bad of ["", "@@@", "e30", K.encodeForm({}).slice(0, 3)]) assert.equal(K.decodeForm(bad), null, bad);
  assert.ok(K.encodeForm(K.EXEMPLO()).length < 700);
});

test("link malicioso não passa dos limites nem vira HTML executável", () => {
  const evil = Buffer.from(JSON.stringify({ v: 1, n: "<img src=x onerror=alert(1)>".repeat(50), s: Array(500).fill(["a", "1"]), f: Array(500).fill(["x", "y"]) })).toString("base64url");
  const f = K.decodeForm(evil);
  assert.ok(f.nome.length <= K.LIM.nome && f.servicos.length <= K.LIM.servicos && f.faqs.length <= K.LIM.faqs);
});

test("config: preços formatados, serviços listados, itens sem dado não viram intenção", () => {
  const cfg = K.buildConfig(K.EXEMPLO());
  assert.match(cfg.intents.preco.answers[0], /design de sobrancelha: R\$ 30,50/);
  assert.ok(cfg.intents.faq_1);
  const f = K.EXEMPLO(); f.horario = ""; f.faqs = [{ perguntas: "só pergunta", resposta: "" }];
  const c2 = K.buildConfig(f);
  assert.ok(!c2.intents.horario && !c2.intents.faq_1);
  assert.equal(Object.keys(K.buildConfig(Object.assign(K.EXEMPLO(), { servicos: [{ nome: "__proto__", preco: "1" }, { nome: "corte", preco: "2" }] })).data.servicos).join(), "corte");
});

// Negócio diferente da barbearia do exemplo, para ver se o método generaliza.
// Frases escritas depois dos modelos de intenção e sem ajustar o código a elas.
const CASOS = [
  ["oi, boa tarde", "saudacao"], ["quanto é a manicure?", "preco"], ["qto custa pedicure", "preco"], ["qual o valor da unha em gel", "preco"],
  ["me manda os preços", "preco"], ["que horas vcs abrem?", "horario"], ["abre segunda?", "horario"], ["funciona domingo", "horario"],
  ["onde fica o studio?", "endereco"], ["qual o endereço de vcs", "endereco"], ["aceitam cartão?", "pagamento"], ["dá pra pagar no pix", "pagamento"],
  ["vocês fazem design de sobrancelha?", "servicos"], ["quais serviços tem", "servicos"], ["quero marcar manicure sexta às 15h", "agendar"],
  ["tem vaga amanhã?", "agendar"], ["preciso desmarcar", "cancelar"], ["quero falar com a dona", "humano"], ["valeu!", "agradecimento"],
  ["tem estacionamento?", "faq_1"], ["onde estaciono o carro", "faq_1"],
  // o que NÃO deve responder sozinho
  ["a manicure ficou horrível, quero reembolso", "reclamacao"], ["vocês vendem esmalte?", "desconhecido"], ["qual a previsão do tempo", "desconhecido"],
  ["asdkjh qwe", "desconhecido"], ["vcs fazem depilação a laser?", "desconhecido"],
];

test("negócio novo: acerto em frases novas (medido, não prometido)", () => {
  const b = bot(), erros = [];
  for (const [t, esperado] of CASOS) {
    const r = say(b, t);
    const got = r.handoff ? r.intent : r.intent;
    const ok = got === esperado || (esperado === "agendar" && r.intent === "agendar");
    if (!ok) erros.push(`${t} → ${got} (esperado ${esperado})`);
  }
  const acertos = CASOS.length - erros.length;
  console.log(`      acertos: ${acertos}/${CASOS.length}${erros.length ? "\n      " + erros.join("\n      ") : ""}`);
  // reclamação e fora de assunto NUNCA podem ser respondidos como se soubesse
  for (const [t, esperado] of CASOS.filter((c) => ["reclamacao", "desconhecido"].includes(c[1]))) assert.notEqual(say(b, t).decision, "answer", t);
  assert.ok(acertos / CASOS.length >= 0.8, `acerto ${acertos}/${CASOS.length}`);
});

// Segunda rodada: frases escritas DEPOIS dos ajustes acima, sem mexer em nada para elas.
const CASOS2 = [
  ["boa noite!", "saudacao"], ["e aí, tudo certo?", "saudacao"], ["qual o preço do pedicure?", "preco"], ["tá quanto a unha em gel", "preco"],
  ["quanto custa fazer a sobrancelha", "preco"], ["valor da manicure por favor", "preco"], ["vcs tão abertos hj?", "horario"], ["até que horas posso ir sábado", "horario"],
  ["qual horário de vcs", "horario"], ["em que rua vocês ficam", "endereco"], ["como faço pra chegar aí", "endereco"], ["vocês passam cartão?", "pagamento"],
  ["tem como parcelar", "pagamento"], ["fazem pedicure também?", "servicos"], ["que tipo de serviço vocês têm", "servicos"], ["queria marcar uma manicure quinta 10h", "agendar"],
  ["dá pra agendar pra semana que vem", "agendar"], ["não vou conseguir ir amanhã, posso remarcar", "cancelar"], ["me passa pra uma atendente", "humano"], ["brigadão", "agradecimento"],
  ["posso deixar o carro na frente?", "faq_1"], ["tem estacionamento próprio", "faq_1"],
  ["péssimo atendimento, vou reclamar", "reclamacao"], ["vocês trabalham com maquiagem?", "desconhecido"], ["qual o seu nome", "desconhecido"],
  ["quanto tá o dólar", "desconhecido"], ["12345", "desconhecido"], ["vocês têm vaga de emprego?", "desconhecido"],
];
test("segunda rodada (frases novas, sem ajuste): acerto medido", () => {
  const b = bot(), erros = [], inseguros = [];
  for (const [t, esperado] of CASOS2) {
    const r = say(b, t);
    if (r.intent !== esperado) erros.push(`${t} → ${r.intent}${r.handoff ? " (humano)" : ""} (esperado ${esperado})`);
    if (["reclamacao", "desconhecido"].includes(esperado) && r.decision === "answer") inseguros.push(t);
  }
  console.log(`      acertos: ${CASOS2.length - erros.length}/${CASOS2.length}${erros.length ? "\n      " + erros.join("\n      ") : ""}`);
  assert.deepEqual([...inseguros], [], "respondeu sozinho o que devia passar para uma pessoa");
});

// Terceira rodada: frases ainda não vistas por quem ajustou os modelos (esta é a medida honesta).
const CASOS3 = [
  ["olá, bom dia", "saudacao"], ["quanto cobram pela manicure", "preco"], ["preciso saber o valor do gel", "preco"], ["tabela de valores", "preco"],
  ["quanto fica manicure e pedicure", "preco"], ["vcs funcionam aos sábados?", "horario"], ["a que horas fecham hoje", "horario"], ["horário de segunda a sexta", "horario"],
  ["me diz o endereço", "endereco"], ["fica perto de onde?", "endereco"], ["aceita cartão de crédito", "pagamento"], ["faz no pix?", "pagamento"],
  ["tem pedicure?", "servicos"], ["quais tratamentos vocês fazem", "servicos"], ["quero marcar pedicure amanhã às 9", "agendar"],
  ["tem horário disponível sexta?", "agendar"], ["quero cancelar o horário de amanhã", "cancelar"], ["posso falar com a dona?", "humano"], ["muito obrigada", "agradecimento"],
  ["onde posso estacionar", "faq_1"], ["tem estacionamento aí?", "faq_1"],
  ["fui mal atendida, absurdo", "reclamacao"], ["vocês vendem produtos de cabelo?", "desconhecido"], ["que dia é hoje", "desconhecido"],
  ["quem é a dona", "desconhecido"], ["aceitam animais de estimação", "desconhecido"], ["hmm", "desconhecido"], ["quanto custa um carro", "desconhecido"],
];
test("terceira rodada (frases inéditas): acerto medido", () => {
  const b = bot(), erros = [], errados = [];
  for (const [t, esperado] of CASOS3) {
    const r = say(b, t);
    if (r.intent !== esperado) { erros.push(`${t} → ${r.intent}${r.handoff ? " (humano)" : ""} (esperado ${esperado})`); if (r.decision === "answer") errados.push(t); }
  }
  console.log(`      acertos: ${CASOS3.length - erros.length}/${CASOS3.length}; respostas ERRADAS dadas com confiança: ${errados.length}${erros.length ? "\n      " + erros.join("\n      ") : ""}`);
});

test("agendamento completo gera pedido com os dados", () => {
  const b = bot(), s = Bot.newSession();
  let r = b.reply("quero agendar", s); assert.equal(r.decision, "booking-step");
  r = b.reply("pedicure", s); r = b.reply("sábado", s); r = b.reply("14h", s);
  assert.equal(JSON.stringify(r.booking), JSON.stringify({ servico: "pedicure", dia: "sábado", hora: "14:00" }));
});
