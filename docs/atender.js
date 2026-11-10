(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const token = window.FREGUES_TOKEN || (location.hash.match(/[#&]c=([\w-]+)/) || [])[1];
  const form = FreguesKit.decodeForm(token);
  const log = $("#log");

  function fail(msg) {
    $("#biz").textContent = "Link inválido";
    $("#av").textContent = "!";
    const d = document.createElement("div");
    d.className = "msg bot";
    d.append(document.createTextNode(msg + " "));
    const a = document.createElement("a");
    a.href = "montar.html"; a.textContent = "Monte o seu atendente";
    d.append(a, document.createTextNode("."));
    log.append(d);
    $("#chips").classList.add("hide");
    $("#form").classList.add("hide");
  }

  if (!form) return fail("Este link está incompleto ou foi cortado ao ser copiado.");
  const { errors } = FreguesKit.validate(form);
  if (errors.length) return fail("Este atendimento ainda não foi configurado direito.");

  const cfg = FreguesKit.buildConfig(form);
  const bot = new FreguesBot.Bot(cfg);
  const whats = FreguesKit.normWhats(form.whats);

  document.title = cfg.business + " · atendimento";
  $("#biz").textContent = cfg.business;
  $("#av").textContent = [...cfg.business][0].toUpperCase();
  if (window.FREGUES_TOKEN) $("#made").href = "https://github.com/thiagollipe-web/freguesbot";
  if (whats) {
    const a = $("#wa-top");
    a.href = FreguesKit.waLink(whats, `Olá! Vim pelo atendimento automático da ${cfg.business}.`);
    a.classList.remove("hide");
  }

  const chat = FreguesChat.create({ log, form: $("#form"), input: $("#msg"), chips: $("#chips") });
  chat.setBot(bot, { nome: cfg.business, whats });
  const ask = [["preco", "Quanto custa?"], ["horario", "Que horas abre?"], ["endereco", "Onde fica?"], ["pagamento", "Aceita Pix?"], ["agendar", "Quero agendar"]];
  chat.setChips(ask.filter(([k]) => cfg.intents[k]).map(([, t]) => t));
})();
