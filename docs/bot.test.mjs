// Roda com: node --test docs/bot.test.mjs  (compara o JavaScript com o Python)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const here = (p) => new URL(p, import.meta.url);
const sandbox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(here("./bot.js"), "utf8"), sandbox);
const { Bot, normalize, ratio } = sandbox.module.exports;
const cfg = () => JSON.parse(fs.readFileSync(here("./barbearia.json"), "utf8"));
const fx = JSON.parse(fs.readFileSync(here("../tests/parity_fixture.json"), "utf8"));
const RANDOM_TEXT = new Set(["agradecimento"]); // respostas sorteadas entre variações
const same = (js, py, ctx) => {
  assert.equal(js.intent, py.intent, `${ctx}: intenção`);
  assert.equal(js.handoff, py.handoff, `${ctx}: transbordo`);
  assert.equal(JSON.stringify(js.booking), JSON.stringify(py.booking), `${ctx}: agendamento`);
  assert.ok(Math.abs(js.confidence - py.confidence) < 1e-5, `${ctx}: confiança ${js.confidence} vs ${py.confidence}`);
  if (!RANDOM_TEXT.has(py.intent)) assert.equal(js.text, py.text, `${ctx}: texto`);
};

test("a config do site é idêntica à do Python", () => {
  const py = JSON.parse(fs.readFileSync(here("../bots/support/configs/barbearia.json"), "utf8"));
  assert.deepEqual(cfg(), py);
});
test("normalize e ratio seguem o Python", () => {
  assert.equal(JSON.stringify(normalize("Qto é o corte??")), '["c_preco","corte"]');
  assert.equal(JSON.stringify(normalize("oiiii")), '["oi"]');
  assert.ok(Math.abs(ratio("sombrancelha", "sobrancelha") - 0.9565217391304348) < 1e-12);
});
test(`frases isoladas iguais ao Python (${fx.singles.length})`, () => {
  const bot = new Bot(cfg());
  for (const p of fx.singles) same(bot.reply(p.input, Bot.newSession()), p, `"${p.input}"`);
});
test(`conversas completas iguais ao Python (${fx.dialogs.length})`, () => {
  for (const d of fx.dialogs) {
    const bot = new Bot(cfg()), s = Bot.newSession();
    d.forEach((p, i) => same(bot.reply(p.input, s), p, `"${d[0].input}" turno ${i + 1} "${p.input}"`));
  }
});
test("o painel recebe tokens e ranking", () => {
  const r = new Bot(cfg()).reply("qto é o corte?", Bot.newSession());
  assert.ok(r.tokens.length && r.ranked.length && r.decision === "answer");
});
