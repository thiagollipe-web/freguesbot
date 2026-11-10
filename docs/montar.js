(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const KEY = "freguesbot:montar:v1";
  const K = FreguesKit;

  // ---- estado: link com #c= (editar), senão o que ficou salvo neste aparelho, senão vazio ----
  let form = K.VAZIO();
  const fromHash = K.decodeForm((location.hash.match(/[#&]c=([\w-]+)/) || [])[1]);
  try { form = fromHash || JSON.parse(localStorage.getItem(KEY)) || form; } catch (e) { /* storage bloqueado: segue sem salvar */ }
  form = Object.assign(K.VAZIO(), form);
  if (!form.servicos.length) form.servicos = [{ nome: "", preco: "" }];

  const fields = document.querySelectorAll("[data-f]");
  const servEl = $("#serv"), faqEl = $("#faqs");
  const unanswered = [];
  let timer = 0, lastKey = "";

  const chat = FreguesChat.create({ log: $("#log"), form: $("#form"), input: $("#msg"), chips: $("#chips") }, { onReply: () => {} });

  // ---- formulário ----
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) k in e ? (e[k] = v) : e.setAttribute(k, v);
    e.append(...kids);
    return e;
  }
  function renderServ(focusLast) {
    servEl.replaceChildren(...form.servicos.map((s, i) => {
      const n = el("input", { className: "field", value: s.nome, placeholder: "Ex.: manicure", maxLength: 60 });
      n.setAttribute("aria-label", `Nome do serviço ${i + 1}`);
      const p = el("input", { className: "field", value: s.preco, placeholder: "Preço", inputMode: "decimal", maxLength: 12 });
      p.setAttribute("aria-label", `Preço do serviço ${i + 1}`);
      n.addEventListener("input", () => { s.nome = n.value; changed(); });
      p.addEventListener("input", () => { s.preco = p.value; changed(); });
      const rm = el("button", { className: "rm", type: "button", textContent: "×" });
      rm.setAttribute("aria-label", `Remover serviço ${i + 1}`);
      rm.addEventListener("click", () => { form.servicos.splice(i, 1); if (!form.servicos.length) form.servicos.push({ nome: "", preco: "" }); renderServ(); $("#addserv").focus(); changed(); });
      return el("div", { className: "rowx" }, n, p, rm);
    }));
    if (focusLast) servEl.lastElementChild.querySelector("input").focus();
  }
  function renderFaqs(focus) {
    faqEl.replaceChildren(...form.faqs.map((f, i) => {
      const q = el("textarea", { value: f.perguntas, placeholder: "tem estacionamento\nonde estaciono\ntem vaga de carro", maxLength: K.LIM.perg, id: `fq${i}` });
      const a = el("textarea", { value: f.resposta, placeholder: "Temos estacionamento gratuito na frente.", maxLength: K.LIM.resp, id: `fa${i}` });
      q.addEventListener("input", () => { f.perguntas = q.value; changed(); });
      a.addEventListener("input", () => { f.resposta = a.value; changed(); });
      const rm = el("button", { className: "rm", type: "button", textContent: "×" });
      rm.setAttribute("aria-label", `Remover pergunta extra ${i + 1}`);
      rm.addEventListener("click", () => { form.faqs.splice(i, 1); renderFaqs(); $("#addfaq").focus(); changed(); });
      return el("div", { className: "faq" }, el("label", { htmlFor: q.id, textContent: "Jeitos de perguntar (um por linha)" }), q, el("label", { htmlFor: a.id, textContent: "Resposta" }), a, rm);
    }));
    if (focus === "answer") $(`#fa${form.faqs.length - 1}`).focus();
    else if (focus) $(`#fq${form.faqs.length - 1}`).focus();
  }
  fields.forEach((f) => { f.value = form[f.dataset.f] || ""; f.addEventListener("input", () => { form[f.dataset.f] = f.value; changed(); }); });
  $("#addserv").addEventListener("click", () => { form.servicos.push({ nome: "", preco: "" }); renderServ(true); });
  $("#addfaq").addEventListener("click", () => { form.faqs.push({ perguntas: "", resposta: "" }); renderFaqs(true); });
  function loadAll(next) {
    form = Object.assign(K.VAZIO(), next);
    if (!form.servicos.length) form.servicos = [{ nome: "", preco: "" }];
    fields.forEach((f) => { f.value = form[f.dataset.f] || ""; });
    unanswered.length = 0; lastKey = ""; renderServ(); renderFaqs(); renderQueue(); $("#log").replaceChildren(); changed(true);
  }
  $("#ex").addEventListener("click", () => {
    const sujo = form.nome || form.servicos.some((s) => s.nome);
    if (!sujo || confirm("Trocar o que você escreveu pelo exemplo?")) loadAll(K.EXEMPLO());
  });
  $("#clear").addEventListener("click", () => { if (confirm("Apagar tudo que você preencheu?")) loadAll(K.VAZIO()); });

  // ---- recalcula tudo (com um pequeno atraso enquanto o dono digita) ----
  function changed(now) { clearTimeout(timer); timer = setTimeout(refresh, now ? 0 : 200); }

  function refresh() {
    try { localStorage.setItem(KEY, JSON.stringify(form)); } catch (e) { /* sem armazenamento */ }
    const { errors, warnings } = K.validate(form);
    const ul = $("#issues");
    ul.replaceChildren(...[...errors.map((t) => [t, ""]), ...warnings.map((t) => [t, "w"])].map(([t, c]) => el("li", { className: c, textContent: t })));
    if (!errors.length && !warnings.length) ul.append(el("li", { className: "ok", textContent: "Tudo preenchido. Teste ao lado e copie o link." }));
    else if (!errors.length) ul.prepend(el("li", { className: "ok", textContent: "Já dá para usar. Os avisos abaixo melhoram o resultado." }));

    $("#biz").textContent = form.nome.trim() || "Seu negócio";
    $("#av").textContent = form.nome.trim() ? [...form.nome.trim()][0].toUpperCase() : "?";

    const ok = !errors.length;
    ["copy", "dl"].forEach((id) => { $("#" + id).disabled = !ok; });
    const open = $("#open"), link = $("#link");
    if (!ok) {
      link.value = ""; open.removeAttribute("href"); open.setAttribute("aria-disabled", "true"); open.classList.add("hide");
      chat.off("Preencha o nome e pelo menos um serviço com preço para testar.");
      lastKey = ""; setChips([]); return;
    }
    open.classList.remove("hide"); open.removeAttribute("aria-disabled");
    const url = new URL("atender.html", location.href); url.hash = "c=" + K.encodeForm(form);
    link.value = url.href; open.href = url.href;
    $("#st").className = "status";
    $("#st").textContent = url.href.length > 4000 ? "Link muito longo: no WhatsApp pode ser cortado. Use “Baixar como arquivo” ou encurte as respostas." : "";
    if (url.href.length > 4000) $("#st").className = "status err";

    const cfgKey = JSON.stringify(K.buildConfig(form));
    if (cfgKey === lastKey) return;                 // só mexeu em algo que não muda o bot
    lastKey = cfgKey;
    const cfg = JSON.parse(cfgKey);
    const bot = new FreguesBot.Bot(cfg, { onUnanswered: (q) => { if (!unanswered.includes(q)) { unanswered.push(q); renderQueue(); } } });
    chat.setBot(bot, { nome: cfg.business, whats: K.normWhats(form.whats) });
    setChips(["preco", "horario", "endereco", "pagamento", "agendar"].filter((k) => cfg.intents[k]).map((k) => ({ preco: "Quanto custa?", horario: "Que horas abre?", endereco: "Onde fica?", pagamento: "Aceita Pix?", agendar: "Quero agendar" })[k])
      .concat(["Qual a previsão do tempo?"]));
  }
  function setChips(list) { chat.setChips(list); }

  function renderQueue() {
    $("#queuebox").hidden = !unanswered.length;
    $("#queue").replaceChildren(...unanswered.slice(-5).map((q) => {
      const b = el("button", { className: "btn ghost mini", type: "button", textContent: "Ensinar" });
      b.setAttribute("aria-label", `Ensinar a responder: ${q}`);
      b.addEventListener("click", () => {
        form.faqs.push({ perguntas: q, resposta: "" });
        unanswered.splice(unanswered.indexOf(q), 1);
        renderFaqs("answer"); renderQueue(); changed();
      });
      return el("li", {}, el("span", { textContent: q }), b);
    }));
  }

  // ---- link e arquivo ----
  $("#copy").addEventListener("click", async () => {
    const st = $("#st"), link = $("#link");
    try { await navigator.clipboard.writeText(link.value); st.className = "status"; st.textContent = "Link copiado! Cole na bio do Instagram ou no WhatsApp."; }
    catch (e) { link.focus(); link.select(); st.className = "status err"; st.textContent = "Não consegui copiar sozinho. O link está selecionado: copie com o dedo."; }
  });
  const esc = (js) => js.replace(/<\/script/gi, "<\\/script");
  async function standalone() {
    const get = async (u) => { const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) throw new Error(u); return r.text(); };
    const names = ["tool.css", "kit.js", "bot.js", "chat.js", "atender.js"];
    const [html0, ...src] = await Promise.all(["atender.html", ...names].map(get));
    const by = Object.fromEntries(names.map((n, i) => [n, src[i]]));
    return html0
      .replace('<link rel="stylesheet" href="tool.css">', () => "<style>" + by["tool.css"].replace(/@font-face\{[^}]*\}/g, "") + "</style>")
      .replace('<script id="embed"></script>', () => "<script>window.FREGUES_TOKEN=" + JSON.stringify(K.encodeForm(form)) + "</script>")
      .replace(/<script src="([^"]+)"><\/script>/g, (m, s) => "<script>" + esc(by[s]) + "</script>");
  }
  $("#dl").addEventListener("click", async () => {
    const st = $("#st");
    try {
      const html = await standalone();
      const slug = (form.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) || "meu-negocio";
      const a = el("a", { href: URL.createObjectURL(new Blob([html], { type: "text/html" })), download: `atendimento-${slug}.html` });
      document.body.append(a); a.click(); a.remove();
      st.className = "status"; st.textContent = "Arquivo baixado. Ele funciona sozinho: hospede onde quiser ou abra no celular.";
    } catch (e) { st.className = "status err"; st.textContent = "Não consegui montar o arquivo (abra esta página pelo endereço do site, não direto do computador)."; }
  });

  renderServ(); renderFaqs(); refresh();
})();
