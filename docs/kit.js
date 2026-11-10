// Kit do atendente: transforma o formulário do dono numa config para o bot (bot.js),
// e leva essa config dentro do link (#c=...), sem servidor. Testado em docs/kit.test.mjs.
(function (root) {
  const LIM = { nome: 60, texto: 300, resp: 500, perg: 400, servicos: 30, faqs: 20, linhas: 8 };
  const VAZIO = () => ({ nome: "", horario: "", endereco: "", pagamento: "", whats: "", handoff: "", servicos: [], faqs: [] });

  const EXEMPLO = () => ({
    nome: "Studio Bela",
    horario: "Terça a sábado, das 9h às 19h. Domingo e segunda fechado.",
    endereco: "Rua das Palmeiras, 85, Centro",
    pagamento: "Aceitamos Pix, cartão de débito e crédito e dinheiro.",
    whats: "",
    handoff: "",
    servicos: [{ nome: "manicure", preco: "35" }, { nome: "pedicure", preco: "40" }, { nome: "unha em gel", preco: "120" }, { nome: "design de sobrancelha", preco: "30,50" }],
    faqs: [{ perguntas: "tem estacionamento\nonde estaciono\ntem vaga de carro", resposta: "Temos estacionamento gratuito na frente do studio." }],
  });

  const clamp = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

  function parsePreco(v) {
    let s = String(v == null ? "" : v).replace(/R\$|\s/gi, "");
    if (!s) return null;
    s = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const n = parseFloat(s);
    return n >= 0 && n < 1e6 ? n : null;
  }
  const brl = (n) => "R$ " + (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

  function normWhats(v) {
    const d = String(v || "").replace(/\D/g, "");
    if (/^\d{10,11}$/.test(d)) return "55" + d;
    if (/^55\d{10,11}$/.test(d)) return d;
    return "";
  }
  const waLink = (whats, texto) => {
    const n = normWhats(whats);
    return n ? "https://wa.me/" + n + "?text=" + encodeURIComponent(texto) : "";
  };

  function servicosValidos(form) {
    const vistos = new Set(), out = [];
    for (const s of form.servicos || []) {
      const nome = clamp(s && s.nome, LIM.nome).toLowerCase(), p = parsePreco(s && s.preco);
      if (!nome || p === null || nome === "__proto__" || vistos.has(nome)) continue;
      vistos.add(nome); out.push([nome, p]);
    }
    return out.slice(0, LIM.servicos);
  }
  const linhas = (t) => String(t || "").split(/\n/).map((x) => clamp(x, 120)).filter(Boolean).slice(0, LIM.linhas);

  function validate(form) {
    const errors = [], warnings = [];
    if (!clamp(form.nome, LIM.nome)) errors.push("Falta o nome do negócio.");
    const dadosServ = (form.servicos || []).filter((s) => s && (clamp(s.nome, 5) || clamp(s.preco, 5)));
    const validos = servicosValidos(form);
    if (!validos.length) errors.push("Cadastre pelo menos um serviço com nome e preço (ex.: corte, 40).");
    else if (validos.length < dadosServ.length) warnings.push("Algum serviço ficou de fora: confira se tem nome, preço em números e se não repete.");
    if (!normWhats(form.whats)) warnings.push(clamp(form.whats, 20) ? "O WhatsApp parece incompleto (use DDD + número)." : "Sem WhatsApp, o cliente não tem como chegar até você quando o bot não souber. Coloque o seu.");
    if (!clamp(form.horario, LIM.texto)) warnings.push("Sem horário: perguntas sobre horário vão direto para você.");
    if (!clamp(form.endereco, LIM.texto)) warnings.push("Sem endereço: perguntas sobre onde fica vão direto para você.");
    (form.faqs || []).forEach((f, i) => {
      const ex = linhas(f && f.perguntas).length, tem = clamp(f && f.resposta, LIM.resp);
      if ((ex || tem) && (!ex || !tem)) warnings.push(`Pergunta extra ${i + 1}: faltou ${ex ? "a resposta" : "escrever como o cliente pergunta"}.`);
      else if (ex === 1) warnings.push(`Pergunta extra ${i + 1}: com 3 jeitos de perguntar o bot acerta mais.`);
    });
    return { errors, warnings };
  }

  const comServico = (serv, moldes) => serv.flatMap(([nome]) => moldes.map((m) => m.replace("{s}", nome)));

  function buildConfig(form) {
    const serv = servicosValidos(form);
    const nome = clamp(form.nome, LIM.nome);
    const whats = normWhats(form.whats);
    const handoff = clamp(form.handoff, 200) ||
      (whats ? "Essa eu prefiro deixar com uma pessoa da equipe. Toque em “Falar no WhatsApp” que eu já levo a sua dúvida."
             : `Essa eu não sei responder. Fale direto com a equipe da ${nome}.`);
    const horario = clamp(form.horario, LIM.texto), endereco = clamp(form.endereco, LIM.texto), pagamento = clamp(form.pagamento, LIM.texto);
    const tabela = "Nossos preços: " + serv.map(([n, p]) => `${n}: ${brl(p)}`).join("; ") + ".";

    const intents = {
      saudacao: { examples: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "e ai", "opa tudo bem", "tudo bem", "oi tudo bem", "ola tudo bem"],
                  answers: [`Olá! Sou o assistente da ${nome}. Posso ajudar com preços, horários, endereço ou agendamento.`] },
      preco: { examples: ["quanto custa", "o valor", "o preco", "quanto cobra", "os precos", "valores", "tabela de precos", "quanto fica", "quanto sai", "preco dos servicos"]
                 .concat(comServico(serv, ["quanto custa {s}", "valor do {s}", "quanto fica {s}"])),
               answers: [tabela] },
      servicos: { examples: ["quais servicos voces fazem", "o que voces oferecem", "o que voces fazem", "quais os servicos"].concat(comServico(serv, ["fazem {s}", "tem {s}", "voces fazem {s}"])),
                  answers: [`Nossos serviços: ${serv.map(([n]) => n).join(", ")}.`] },
      agendar: { examples: ["quero agendar", "quero marcar", "tem vaga hoje", "da pra marcar para amanha", "queria agendar", "tem vaga livre", "quero reservar", "queria marcar um atendimento", "tem encaixe"]
                   .concat(comServico(serv, ["quero marcar {s}", "quero agendar {s}"])),
                 answers: [] },
      cancelar: { examples: ["quero cancelar meu horario", "preciso desmarcar", "nao vou poder ir", "remarcar meu horario", "cancelar agendamento"], answers: [] },
      humano: { examples: ["quero falar com atendente", "falar com uma pessoa", "chama o dono", "preciso de um humano", "quero falar com alguem"], answers: [] },
      agradecimento: { examples: ["obrigado", "valeu", "muito obrigado", "obrigada pela ajuda", "show valeu", "ok obrigado"], answers: ["Por nada! Qualquer coisa é só chamar.", "Disponha! Até a próxima."] },
    };
    if (horario) intents.horario = { examples: ["que horas abre", "horario de funcionamento", "ate que horas funciona", "voces abrem sabado", "abre domingo", "esta aberto agora", "horario de atendimento", "que horas fecha", "abre hoje", "abrem feriado"], answers: [`Nosso horário: ${horario}`] };
    if (endereco) intents.endereco = { examples: ["onde fica", "o endereco", "chego ai", "a localizacao", "em que rua fica", "localizacao de voces", "onde voces ficam", "endereco de voces"], answers: [`Estamos na ${endereco}`] };
    if (pagamento) intents.pagamento = { examples: ["aceita pix", "aceita cartao", "formas de pagamento", "pode pagar no cartao", "tem pix", "parcela no credito", "aceita dinheiro", "aceita debito", "formas de pagar"], answers: [pagamento] };

    let n = 0;
    for (const f of form.faqs || []) {
      const ex = linhas(f && f.perguntas), resp = clamp(f && f.resposta, LIM.resp);
      if (ex.length && resp && n < LIM.faqs) intents["faq_" + ++n] = { examples: ex, answers: [resp] };
    }

    const labels = { saudacao: "cumprimento", preco: "preços", servicos: "serviços", agendar: "agendamento", cancelar: "cancelamento", humano: "falar com uma pessoa", agradecimento: "agradecimento", horario: "horário", endereco: "endereço", pagamento: "formas de pagamento" };
    Object.keys(intents).filter((k) => k.startsWith("faq_")).forEach((k) => { labels[k] = intents[k].examples[0]; });

    const data = { horario, endereco, pagamento, servicos: Object.fromEntries(serv) };
    return { business: nome, owner_handoff: handoff, labels, data, intents };
  }

  // ---- link: formulário → texto curto → formulário ----
  function pack(form) {
    const o = { v: 1, n: clamp(form.nome, LIM.nome) };
    for (const [k, c, lim] of [["h", "horario", LIM.texto], ["e", "endereco", LIM.texto], ["p", "pagamento", LIM.texto], ["w", "whats", 20], ["o", "handoff", 200]]) {
      const v = clamp(form[c], lim); if (v) o[k] = v;
    }
    o.s = (form.servicos || []).filter((s) => s && clamp(s.nome, 1)).slice(0, LIM.servicos).map((s) => [clamp(s.nome, LIM.nome), clamp(s.preco, 12)]);
    const f = (form.faqs || []).map((q) => [linhas(q && q.perguntas).join("\n"), clamp(q && q.resposta, LIM.resp)]).filter((q) => q[0] && q[1]).slice(0, LIM.faqs);
    if (f.length) o.f = f;
    return o;
  }
  function unpack(o) {
    if (!o || typeof o !== "object" || o.v !== 1) return null;
    const f = VAZIO();
    f.nome = clamp(o.n, LIM.nome); f.horario = clamp(o.h, LIM.texto); f.endereco = clamp(o.e, LIM.texto);
    f.pagamento = clamp(o.p, LIM.texto); f.whats = clamp(o.w, 20); f.handoff = clamp(o.o, 200);
    f.servicos = (Array.isArray(o.s) ? o.s : []).slice(0, LIM.servicos).map((s) => ({ nome: clamp(s && s[0], LIM.nome), preco: clamp(s && s[1], 12) }));
    f.faqs = (Array.isArray(o.f) ? o.f : []).slice(0, LIM.faqs).map((q) => ({ perguntas: linhas(q && q[0]).join("\n"), resposta: clamp(q && q[1], LIM.resp) }));
    return f;
  }
  const b64 = {
    enc(str) { const by = new TextEncoder().encode(str); let s = ""; by.forEach((b) => (s += String.fromCharCode(b))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
    dec(t) { const s = atob(t.replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0))); },
  };
  const encodeForm = (form) => b64.enc(JSON.stringify(pack(form)));
  function decodeForm(token) {
    try { return unpack(JSON.parse(b64.dec(String(token || "")))); } catch (e) { return null; }
  }

  const api = { LIM, VAZIO, EXEMPLO, parsePreco, brl, normWhats, waLink, validate, buildConfig, encodeForm, decodeForm };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FreguesKit = api;
})(typeof window !== "undefined" ? window : globalThis);
