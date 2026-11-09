"""Pedido de apoio, discreto: uma linha no fim da execução, desligável com FREGUESBOT_NO_DONATE=1."""
import os

PIX_KEY = "+5511986455390"  # preencha com a sua chave Pix; vazio = nenhuma mensagem

def footer() -> str:
    if not PIX_KEY or os.environ.get("FREGUESBOT_NO_DONATE"):
        return ""
    return f"\nAjudou? O freguesbot é gratuito. Se quiser apoiar, Pix: {PIX_KEY}  (silenciar: FREGUESBOT_NO_DONATE=1)"
