(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cfg = window.FREGUESBOT || {};

  /* ---------- links do GitHub ---------- */
  ["gh-top", "gh-hero", "gh-pay", "gh-foot"].forEach((id) => {
    const a = document.getElementById(id);
    if (!a) return;
    if (cfg.repoUrl) { a.href = cfg.repoUrl; a.target = "_blank"; a.rel = "noopener"; } else a.classList.add("hide");
  });

  /* ---------- barra de progresso ---------- */
  const bar = $("#bar");
  /* ---------- afirmação palavra por palavra ---------- */
  const say = $("#say"), sayText = $("#saytext");
  const TOMATO = new Set(["preço.", "pessoa."]);
  const words = sayText.dataset.words.split(" ");
  sayText.replaceChildren(...words.map((w, i) => {
    const s = document.createElement("span");
    s.className = "w" + (TOMATO.has(w) ? " t" : "");
    s.textContent = w + (i < words.length - 1 ? " " : "");
    return s;
  }));
  const wordEls = [...sayText.children];
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty("--p", max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
      const r = say.getBoundingClientRect(), vh = innerHeight;
      const p = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (vh * 0.35 + r.height)));
      const n = Math.ceil(p * wordEls.length * 1.05);
      wordEls.forEach((el, i) => el.classList.toggle("on", reduced || i < n));
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------- reveal ---------- */
  const hero = $(".hero");
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("in")));
  const targets = document.querySelectorAll(".rv, .ticket");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.2, rootMargin: "0px 0px -6% 0px" });
    targets.forEach((t) => io.observe(t));
  } else targets.forEach((t) => t.classList.add("in"));

  /* ---------- botões magnéticos ---------- */
  if (!reduced && matchMedia("(hover:hover) and (pointer:fine)").matches) {
    document.querySelectorAll("[data-magnet]").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 12}px, ${((e.clientY - r.top) / r.height - 0.5) * 10}px)`;
      });
      b.addEventListener("pointerleave", () => { b.style.transform = ""; });
    });
  }

  /* ---------- demonstração do bot ---------- */
  const phone = $("#phone"), log = $("#log"), chips = $("#chips"), form = $("#form"), input = $("#msg");
  const sendBtn = form.querySelector("button");
  const tokEl = $("#toks"), barsEl = $("#bars"), verdict = $("#verdict"), queue = $("#queue");
  const VERDICT = { answer: "Responde: ele sabe", clarify: "Pergunta de volta", "booking-step": "Agendando: pede o que falta", "booking-done": "Agendamento pedido" };
  const WHY = { reclamacao: "reclamação", desconhecido: "ele não sabe", humano: "você pediu", cancelar: "cancelamento" };
  const SUGGEST = [
    ["qto é o corte?"], ["vcs abrem sábado?"], ["quero agendar corte sexta às 15h"], ["aceita pix?"],
    ["o corte ficou ruim, quero reclamar", true], ["qual a previsão do tempo?", true], ["vendem shampoo?", true],
  ];
  let bot = null, session = null, unanswered = [], busy = false;

  const bubble = (cls, text, label) => {
    const d = document.createElement("div");
    d.className = "msg " + cls;
    if (label) { const s = document.createElement("small"); s.textContent = label; d.append(s); }
    d.append(document.createTextNode(text));
    log.append(d);
    log.scrollTop = log.scrollHeight;
    return d;
  };

  function renderPanel(r) {
    tokEl.replaceChildren();
    if (r.tokens && r.tokens.length) r.tokens.forEach((t) => { const s = document.createElement("span"); s.textContent = t; tokEl.append(s); });
    else { const e = document.createElement("em"); e.textContent = r.decision.startsWith("booking") ? "(só dia/hora/serviço: dados do agendamento)" : "(nada que ele reconheça)"; tokEl.append(e); }
    barsEl.replaceChildren();
    if (r.ranked && r.ranked.length) r.ranked.forEach(([name, v], i) => {
      const row = document.createElement("div");
      row.className = "bar-row" + (i === 0 ? " top1" : "");
      row.innerHTML = '<span></span><div class="tr"><div class="fl"></div></div><b></b>';
      row.children[0].textContent = name;
      row.children[2].textContent = v.toFixed(2);
      barsEl.append(row);
      requestAnimationFrame(() => requestAnimationFrame(() => row.querySelector(".fl").style.setProperty("--v", Math.min(1, v))));
    });
    else { const e = document.createElement("em"); e.className = "mono"; e.style.cssText = "color:#efe9dc88;font-size:.82rem"; e.textContent = r.decision.startsWith("booking") ? "(continua o agendamento em andamento)" : "(nenhuma intenção se aproximou)"; barsEl.append(e); }
    verdict.dataset.d = r.decision;
    verdict.textContent = r.decision === "handoff" ? "Chama uma pessoa: " + (WHY[r.intent] || "ele não sabe") : VERDICT[r.decision];
  }

  function renderQueue() {
    queue.replaceChildren();
    if (!unanswered.length) { const li = document.createElement("li"); li.style.cssText = "list-style:none;margin-left:-1.1rem;color:#efe9dc88"; li.textContent = "vazia"; queue.append(li); return; }
    unanswered.slice(-4).forEach((q) => { const li = document.createElement("li"); li.textContent = q; queue.append(li); });
  }

  async function ask(text) {
    text = text.trim();
    if (!text || busy || !bot) return;
    busy = true;
    bubble("me", text);
    input.value = "";
    const typing = bubble("bot", "");
    if (reduced) typing.textContent = "digitando…"; else typing.innerHTML = '<span class="dots" aria-label="digitando"><i></i><i></i><i></i></span>';
    const r = bot.reply(text, session);
    await new Promise((ok) => setTimeout(ok, reduced ? 0 : Math.min(900, 380 + r.text.length * 6)));
    typing.remove();
    if (r.handoff) { bubble("human", r.text, "chamou um humano"); renderQueue(); }
    else bubble("bot", r.text);
    if (r.booking) bubble("sys", "✓ pedido de agendamento registrado (simulação)");
    renderPanel(r);
    busy = false;
    if (matchMedia("(hover:hover)").matches) input.focus();
  }

  function enable() {
    phone.dataset.state = "ready";
    input.disabled = false; sendBtn.disabled = false;
    chips.replaceChildren(...SUGGEST.map(([t, risk]) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = t; if (risk) b.className = "risk";
      b.addEventListener("click", () => ask(t));
      return b;
    }));
  }

  async function loadBot() {
    phone.dataset.state = "loading";
    log.replaceChildren();
    try {
      const res = await fetch("barbearia.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      const config = await res.json();
      bot = new FreguesBot.Bot(config, { onUnanswered: (q) => unanswered.push(q) });
      session = FreguesBot.Bot.newSession();
      bubble("bot", bot.fmt(config.intents.saudacao.answers[0]));
      bubble("sys", "toque numa frase abaixo ou escreva a sua");
      enable();
    } catch (e) {
      phone.dataset.state = "error";
      const f = document.createElement("div");
      f.className = "fail";
      f.innerHTML = "<p>Não consegui carregar o bot (se você abriu o arquivo direto do computador, use um servidor local).</p>";
      const b = document.createElement("button");
      b.className = "btn gold mini"; b.type = "button"; b.textContent = "Tentar de novo";
      b.addEventListener("click", loadBot);
      f.append(b); log.append(f);
    }
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  loadBot();

  /* ---------- Pix ---------- */
  const pixbox = $("#pixbox");
  if (!cfg.pixKey || !window.Pix) { pixbox.classList.add("hide"); }
  else {
    const status = $("#pixstatus"), area = $("#pixtext");
    const k = $("#pixkey");
    [["Chave Pix: " + cfg.pixKey], cfg.pixName ? [cfg.pixName] : null].filter(Boolean).forEach(([t]) => { const s = document.createElement("span"); s.textContent = t; k.append(s); });
    $("#pixbtn").addEventListener("click", async () => {
      const code = Pix.pixPayload({ key: cfg.pixKey, name: cfg.pixName, city: cfg.pixCity });
      status.className = "status";
      try {
        await navigator.clipboard.writeText(code);
        status.textContent = "Copiado! Cole no app do seu banco em Pix > Copia e Cola. Obrigado!";
      } catch (e) {
        area.value = code; area.classList.remove("hide"); area.focus(); area.select();
        status.className = "status err";
        status.textContent = "Não consegui copiar sozinho. Selecione o código abaixo e copie.";
      }
    });
  }
})();
