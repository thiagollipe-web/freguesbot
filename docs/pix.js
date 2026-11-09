// Gera o "Pix copia e cola" estático (BR Code, EMV) no navegador. Sem servidor, sem taxa, sem intermediário.
(function (root) {
  function crc16(str) { // CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF)
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }
  const f = (id, v) => id + String(v.length).padStart(2, "0") + v;
  const clean = (s, max) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().trim().slice(0, max);

  function pixPayload({ key, name, city, amount, txid }) {
    if (!key) throw new Error("chave Pix obrigatória");
    const account = f("00", "br.gov.bcb.pix") + f("01", key.trim());
    const body =
      f("00", "01") + f("26", account) + f("52", "0000") + f("53", "986") +
      (amount ? f("54", Number(amount).toFixed(2)) : "") +
      f("58", "BR") + f("59", clean(name || "DOACAO", 25) || "DOACAO") + f("60", clean(city || "BRASIL", 15) || "BRASIL") +
      f("62", f("05", clean(txid || "***", 25).replace(/ /g, "") || "***"));
    return body + "6304" + crc16(body + "6304");
  }
  const api = { pixPayload, crc16 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Pix = api;
})(typeof window !== "undefined" ? window : globalThis);
