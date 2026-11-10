// Janela de conversa usada pelo montador (teste) e pela página do cliente.
// Tudo textContent: nada vindo de config ou de link é interpretado como HTML.
(function (root) {
  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function create(els, opts = {}) {
    const { log, form, input, chips } = els;
    const send = form.querySelector("button[type=submit]");
    let bot = null, session = null, meta = { nome: "", whats: "" }, busy = false;

    function bubble(cls, text, label) {
      const d = document.createElement("div");
      d.className = "msg " + cls;
      if (label) { const s = document.createElement("small"); s.textContent = label; d.append(s); }
      d.append(document.createTextNode(text));
      log.append(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }
    function waButton(host, text, label) {
      const href = FreguesKit.waLink(meta.whats, text);
      if (!href) return;
      const a = document.createElement("a");
      a.className = "btn mini wa"; a.href = href; a.target = "_blank"; a.rel = "noopener";
      a.textContent = label;
      host.append(a);
      log.scrollTop = log.scrollHeight;
    }
    function enable(on) { input.disabled = !on; send.disabled = !on; }

    function setChips(list) {
      if (!chips) return;
      chips.replaceChildren(...list.map((t) => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = t;
        b.addEventListener("click", () => ask(t));
        return b;
      }));
    }

    async function ask(text) {
      text = text.trim().slice(0, 200);
      if (!text || busy || !bot) return;
      busy = true;
      bubble("me", text);
      input.value = "";
      const typing = bubble("bot", "");
      if (reduced()) typing.textContent = "digitando…";
      else { const d = document.createElement("span"); d.className = "dots"; d.setAttribute("aria-label", "digitando"); d.innerHTML = "<i></i><i></i><i></i>"; typing.append(d); }
      const r = bot.reply(text, session);
      await new Promise((ok) => setTimeout(ok, reduced() ? 0 : Math.min(800, 320 + r.text.length * 5)));
      typing.remove();
      if (r.booking) {
        const b = r.booking, resumo = `${b.servico}, ${b.dia} às ${b.hora}`;
        const m = bubble("bot", meta.whats
          ? `Anotei: ${resumo}. Para confirmar a disponibilidade, mande este pedido para a ${meta.nome} pelo WhatsApp:`
          : `Anotei: ${resumo}. Atenção: este atendimento não envia nada sozinho. Fale direto com a ${meta.nome} para confirmar.`);
        waButton(m, `Olá! Quero agendar: ${resumo}. (pedido feito pelo assistente da ${meta.nome})`, "Enviar pedido no WhatsApp");
      } else if (r.handoff) {
        const m = bubble("human", r.text, "chamou uma pessoa");
        waButton(m, `Olá! Vim pelo atendimento automático da ${meta.nome}. Minha dúvida: ${text}`, "Falar no WhatsApp");
      } else bubble("bot", r.text);
      if (opts.onReply) opts.onReply(r, text);
      busy = false;
      if (typeof matchMedia === "function" && matchMedia("(hover:hover)").matches) input.focus();
    }

    form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });

    return {
      // novo bot (ex.: o dono mexeu no formulário); mantém a conversa na tela
      setBot(newBot, m) {
        bot = newBot; meta = m; session = root.FreguesBot.Bot.newSession(); busy = false;
        enable(true);
        if (!log.children.length) bubble("bot", bot.cfg.intents.saudacao.answers[0]);
      },
      off(msg) { bot = null; enable(false); log.replaceChildren(); bubble("sys", msg); },
      setChips, ask,
    };
  }
  root.FreguesChat = { create };
})(typeof window !== "undefined" ? window : globalThis);
