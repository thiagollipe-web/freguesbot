// Gera docs/atendimento-exemplo.html: o atendente de exemplo (Studio Bela) num arquivo só.
// Uso: node tools/build_exemplo.mjs   (refaça sempre que mudar bot.js, kit.js, chat.js, atender.js, atender.html ou tool.css)
import fs from "node:fs";
import vm from "node:vm";
const d = (f) => new URL("../docs/" + f, import.meta.url);
const read = (f) => fs.readFileSync(d(f), "utf8");
const sb = { module: { exports: {} }, TextEncoder, TextDecoder, btoa, atob };
vm.runInNewContext(read("kit.js"), sb);
const K = sb.module.exports;
const form = K.EXEMPLO(); form.whats = "";
const names = ["tool.css", "kit.js", "bot.js", "chat.js", "atender.js"];
const by = Object.fromEntries(names.map((n) => [n, read(n)]));
const esc = (js) => js.replace(/<\/script/gi, "<\\/script");
const html = read("atender.html")
  .replace('<link rel="stylesheet" href="tool.css">', () => "<style>" + by["tool.css"].replace(/@font-face\{[^}]*\}/g, "") + "</style>")
  .replace('<script id="embed"></script>', () => "<script>window.FREGUES_TOKEN=" + JSON.stringify(K.encodeForm(form)) + "</script>")
  .replace(/<script src="([^"]+)"><\/script>/g, (m, s) => "<script>" + esc(by[s]) + "</script>");
fs.writeFileSync(d("atendimento-exemplo.html"), html);
console.log("docs/atendimento-exemplo.html", Buffer.byteLength(html), "bytes");
