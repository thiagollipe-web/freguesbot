// Porta em JavaScript do atendimento (bots/support): mesmo método, roda no navegador. Sem LLM, sem rede.
// A equivalência com o Python é verificada por docs/bot.test.mjs contra tests/parity_fixture.json.
(function (root) {
  const ABBR = { vc: "voce", vcs: "voces", qto: "quanto", qnto: "quanto", q: "que", tb: "tambem", pq: "porque", hj: "hoje", amanha: "amanha", blz: "beleza", obg: "obrigado", vlw: "valeu", td: "tudo", pra: "para", ta: "esta", tah: "esta", to: "estou", pix: "pix", msg: "mensagem", hr: "hora", hrs: "horas" };
  const STOP = new Set("o a os as um uma de do da dos das e eh em no na para por me meu minha ai la voce voces".split(" "));
  const CONCEPTS = {
    c_preco: "preco valor valores custa custo custos cobra cobram cobrar tabela quanto",
    c_horario: "horario horarios abre abrem fecha fecham funciona funcionam funcionamento aberto aberta expediente",
    c_endereco: "endereco onde fica ficam localizacao rua chego chegar mapa",
    c_pagamento: "pagamento pagamentos pagar paga pague cartao pix credito debito dinheiro parcela parcelar aceita aceitam",
    c_servico: "servico servicos fazem fazer oferece oferecem trabalham",
    c_agendar: "agendar agendamento marcar marca reservar vaga vagas",
  };
  const CONCEPT = {};
  for (const [c, ws] of Object.entries(CONCEPTS)) for (const w of ws.split(" ")) CONCEPT[w] = c;

  const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const stem = (t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);

  function normalize(text) {
    let t = stripAccents(text.toLowerCase()).replace(/(.)\1{2,}/g, "$1");
    let toks = t.match(/[a-z0-9]+/g) || [];
    toks = toks.map((x) => (Object.prototype.hasOwnProperty.call(ABBR, x) ? ABBR[x] : x));
    toks = toks.map((x) => CONCEPT[x] || CONCEPT[stem(x)] || stem(x));
    return toks.filter((x) => !STOP.has(x));
  }

  // ---- difflib.SequenceMatcher.ratio (Ratcliff/Obershelp), para corrigir erros de digitação ----
  function ratio(a, b) {
    let matched = 0;
    (function walk(alo, ahi, blo, bhi) {
      let bi = alo, bj = blo, bk = 0;
      for (let i = alo; i < ahi; i++)
        for (let j = blo; j < bhi; j++) {
          let k = 0;
          while (i + k < ahi && j + k < bhi && a[i + k] === b[j + k]) k++;
          if (k > bk) { bi = i; bj = j; bk = k; }
        }
      if (!bk) return;
      matched += bk;
      if (alo < bi && blo < bj) walk(alo, bi, blo, bj);
      if (bi + bk < ahi && bj + bk < bhi) walk(bi + bk, ahi, bj + bk, bhi);
    })(0, a.length, 0, b.length);
    return a.length + b.length ? (2 * matched) / (a.length + b.length) : 1;
  }
  function closest(word, candidates, cutoff) {
    let best = null;
    for (const x of candidates) {
      const s = ratio(x, word);
      if (s >= cutoff && (!best || s > best[0] || (s === best[0] && x > best[1]))) best = [s, x];
    }
    return best && best[1];
  }

  const feat = (toks) => toks.concat(toks.slice(1).map((b, i) => toks[i] + "_" + b));

  class Classifier {
    constructor(examples) {
      this.docs = [];
      for (const intent of Object.keys(examples)) for (const e of examples[intent]) this.docs.push([intent, feat(normalize(e))]);
      this.vocab = new Set();
      const df = new Map();
      for (const [, toks] of this.docs) {
        toks.forEach((t) => this.vocab.add(t));
        new Set(toks).forEach((t) => df.set(t, (df.get(t) || 0) + 1));
      }
      this.uni = [...this.vocab].filter((v) => !v.includes("_"));
      this.uniSet = new Set(this.uni);
      const n = this.docs.length;
      this.idf = new Map([...df].map(([t, f]) => [t, Math.log(1 + n / f)]));
      this.vecs = this.docs.map(([i, toks]) => [i, this.vec(toks)]);
    }
    fix(toks) {
      return toks.map((t) => (this.uniSet.has(t) || t.length < 4 ? t : closest(t, this.uni, 0.8) || t));
    }
    vec(feats) {
      const c = new Map();
      feats.forEach((t) => c.set(t, (c.get(t) || 0) + 1));
      const v = new Map();
      for (const [t, f] of c) if (this.idf.has(t)) v.set(t, (1 + Math.log(f)) * this.idf.get(t));
      let sum = 0;
      for (const x of v.values()) sum += x * x;
      const norm = Math.sqrt(sum) || 1;
      for (const [t, x] of v) v.set(t, x / norm);
      return v;
    }
    tokens(text) { return this.fix(normalize(text)); }
    rank(text) {
      const q = this.vec(feat(this.tokens(text)));
      const best = new Map();
      for (const [intent, v] of this.vecs) {
        let s = 0;
        for (const [t, w] of q) s += w * (v.get(t) || 0);
        if (s > (best.get(intent) || 0)) best.set(intent, s);
      }
      return [...best].sort((a, b) => b[1] - a[1]);
    }
  }

  // ---- extração de dados da mensagem ----
  const DAYS = { hoje: "hoje", amanha: "amanhã", segunda: "segunda", terca: "terça", quarta: "quarta", quinta: "quinta", sexta: "sexta", sabado: "sábado", domingo: "domingo" };
  function extractDay(text) {
    const t = stripAccents(text.toLowerCase());
    for (const [k, v] of Object.entries(DAYS)) if (new RegExp("\\b" + k + "\\b").test(t)) return v;
    const m = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    return m ? String(+m[1]).padStart(2, "0") + "/" + String(+m[2]).padStart(2, "0") : null;
  }
  function extractTime(text) {
    const t = stripAccents(text.toLowerCase());
    const m = t.match(/\b([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)?\b/) || t.match(/\bas\s+([01]?\d|2[0-3])\b(?!\/)/);
    if (!m) return null;
    return String(+m[1]).padStart(2, "0") + ":" + String(m[2] ? +m[2] : 0).padStart(2, "0");
  }
  function extractService(text, services) {
    const t = stripAccents(text.toLowerCase());
    for (const s of [...services].sort((a, b) => b.length - a.length)) if (t.includes(stripAccents(s))) return s;
    const singles = services.filter((s) => !s.includes(" ")).map(stripAccents);
    for (const w of t.match(/[a-z]+/g) || []) {
      const m = closest(w, singles, 0.8);
      if (m) return services.find((s) => stripAccents(s) === m);
    }
    return null;
  }

  // ---- motor de conversa ----
  const COMPLAINT = /reclam|ruim|pessim|horrivel|insatisf|decepcion|absurd|problema|errado|reembolso|procon|processo|nunca mais|demor/i;
  const REQUIRED = ["servico", "dia", "hora"];
  const ASK = { servico: "Qual serviço você quer? ({lista})", dia: "Para qual dia?", hora: "Qual horário prefere?" };

  class Bot {
    constructor(config, opts = {}) {
      this.cfg = config;
      this.threshold = opts.threshold ?? 0.55; this.margin = opts.margin ?? 0.08;
      this.minConf = opts.minConf ?? 0.35; this.minGap = opts.minGap ?? 0.15;
      this.cls = new Classifier(Object.fromEntries(Object.entries(config.intents).map(([k, v]) => [k, v.examples])));
      this.services = Object.keys(config.data.servicos);
      this.onUnanswered = opts.onUnanswered || (() => {});
    }
    static newSession() { return { state: "idle", slots: {} }; }
    fmt(text) {
      const d = this.cfg.data;
      const tabela = "Nossos preços: " + Object.entries(d.servicos).map(([k, v]) => `${k}: R$ ${v}`).join("; ") + ".";
      return text.replace("{business}", this.cfg.business).replace("{tabela}", tabela).replace("{lista_servicos}", this.services.join(", "))
        .replace("{horario}", d.horario).replace("{endereco}", d.endereco).replace("{pagamento}", d.pagamento);
    }
    intentText(text) {
      const t = stripAccents(text);
      return t.replace(/\b(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/gi, " ")
        .replace(/\b(?:as)?\s*\d{1,2}\s*(?::|h)\s*\d{0,2}|\b\d{1,2}\/\d{1,2}\b/gi, " ");
    }
    confident(ranked) {
      if (!ranked.length) return false;
      const conf = ranked[0][1], gap = conf - (ranked[1] ? ranked[1][1] : 0);
      return conf >= this.threshold || (conf >= this.minConf && gap >= this.minGap);
    }
    handoff(question, why, conf, dbg) {
      this.onUnanswered(question);
      return { text: this.cfg.owner_handoff, intent: why, confidence: conf, handoff: true, booking: null, decision: "handoff", ...dbg };
    }
    fill(text, s) {
      const found = { servico: extractService(text, this.services), dia: extractDay(text), hora: extractTime(text) };
      for (const [k, v] of Object.entries(found)) if (v) s.slots[k] = v;
    }
    bookingStep(s, conf, dbg) {
      const missing = REQUIRED.filter((k) => !(k in s.slots));
      if (missing.length) return { text: ASK[missing[0]].replace("{lista}", this.services.join(", ")), intent: "agendar", confidence: conf, handoff: false, booking: null, decision: "booking-step", ...dbg };
      const b = { ...s.slots };
      s.state = "idle"; s.slots = {};
      return { text: `Pedido de agendamento: ${b.servico}, ${b.dia} às ${b.hora}. Um atendente vai confirmar a disponibilidade por aqui.`, intent: "agendar", confidence: conf, handoff: false, booking: b, decision: "booking-done", ...dbg };
    }
    reply(text, s) {
      const dbg = { tokens: this.cls.tokens(this.intentText(text)), ranked: [] };
      if (COMPLAINT.test(stripAccents(text))) { s.state = "idle"; s.slots = {}; return this.handoff(text, "reclamacao", 1.0, dbg); }
      const ranked = this.cls.rank(this.intentText(text));
      dbg.ranked = ranked.slice(0, 3);
      const [top, conf] = ranked[0] || ["", 0.0];
      if (s.state === "booking") {
        this.fill(text, s);
        if ((top === "cancelar" || top === "humano") && conf >= this.threshold) { s.state = "idle"; s.slots = {}; }
        else if (REQUIRED.some((k) => k in s.slots) && (!this.confident(ranked) || top === "agendar")) return this.bookingStep(s, conf, dbg);
      }
      if (!ranked.length || !this.confident(ranked)) return this.handoff(text, "desconhecido", conf, dbg);
      if (ranked.length > 1 && ranked[1][1] >= conf - this.margin && ranked[1][0] !== top && conf < 0.8)
        return { text: `Só para entender: você quer saber sobre ${top} ou ${ranked[1][0]}?`, intent: "ambiguo", confidence: conf, handoff: false, booking: null, decision: "clarify", ...dbg };
      if (top === "agendar") { s.state = "booking"; this.fill(text, s); return this.bookingStep(s, conf, dbg); }
      if (top === "humano" || top === "cancelar") return this.handoff(text, top, conf, dbg);
      const answers = this.cfg.intents[top].answers;
      return { text: this.fmt(answers[Math.floor(Math.random() * answers.length)]), intent: top, confidence: conf, handoff: false, booking: null, decision: "answer", ...dbg };
    }
  }

  const api = { Bot, Classifier, normalize, ratio, extractDay, extractTime, extractService };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FreguesBot = api;
})(typeof window !== "undefined" ? window : globalThis);
