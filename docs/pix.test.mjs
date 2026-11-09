// Roda com: node --test docs/pix.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sandbox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL("./pix.js", import.meta.url), "utf8"), sandbox);
const { pixPayload, crc16 } = sandbox.module.exports;

test("CRC16/CCITT-FALSE bate com o vetor padrão", () => assert.equal(crc16("123456789"), "29B1"));
test("payload tem estrutura e CRC válidos", () => {
  const p = pixPayload({ key: "teste@exemplo.com", name: "João da Silva", city: "São Paulo" });
  assert.match(p, /^000201/);
  assert.ok(p.includes("br.gov.bcb.pix0117teste@exemplo.com"));
  assert.ok(p.includes("5802BR") && p.includes("5303986"));
  assert.ok(p.includes("5913JOAO DA SILVA") && p.includes("6009SAO PAULO"));
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
});
test("valor opcional entra com duas casas", () => assert.ok(pixPayload({ key: "k", amount: 5 }).includes("54045.00")));
test("sem chave dá erro claro", () => assert.throws(() => pixPayload({}), /chave/));
test("nome longo é truncado em 25", () => assert.ok(pixPayload({ key: "k", name: "A".repeat(60) }).includes("5925" + "A".repeat(25))));
