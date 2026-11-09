"""Adaptadores de fonte. Cada um devolve list[Item]. O Reddit anônimo responde 403, então só há acesso por OAuth."""
import base64
import csv
import json
import urllib.parse
import urllib.request

from .scoring import Item

UA = "freguesbot-viral/0.1"


def _json(req: urllib.request.Request) -> dict:
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def from_csv(path: str) -> list[Item]:
    """Colunas: title,url,engagement,followers[,source]. Serve para dados exportados de qualquer plataforma."""
    out = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out.append(Item(row.get("source") or "csv", row["title"], row["url"], float(row["engagement"]), float(row["followers"])))
    return out


def from_reddit(client_id: str, client_secret: str, subreddits: list[str], limit: int = 50) -> list[Item]:
    """API oficial (OAuth app-only). Engajamento = score + comentários; seguidores = assinantes do subreddit."""
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    tok = _json(urllib.request.Request("https://www.reddit.com/api/v1/access_token", data=b"grant_type=client_credentials",
                                      headers={"Authorization": f"Basic {auth}", "User-Agent": UA}))["access_token"]
    h = {"Authorization": f"bearer {tok}", "User-Agent": UA}
    out = []
    for sub in subreddits:
        subs = _json(urllib.request.Request(f"https://oauth.reddit.com/r/{sub}/about", headers=h))["data"].get("subscribers") or 0
        posts = _json(urllib.request.Request(f"https://oauth.reddit.com/r/{sub}/top?t=week&limit={limit}", headers=h))["data"]["children"]
        for p in posts:
            d = p["data"]
            out.append(Item(f"reddit/r/{sub}", d["title"], "https://reddit.com" + d["permalink"], d["score"] + d["num_comments"], subs))
    return out


def from_youtube(api_key: str, query: str, limit: int = 25) -> list[Item]:
    """YouTube Data API v3 (chave gratuita com cota diária). Engajamento = curtidas + comentários; seguidores = inscritos do canal."""
    q = urllib.parse.urlencode({"part": "snippet", "q": query, "type": "video", "order": "viewCount", "maxResults": limit, "key": api_key})
    ids = [i["id"]["videoId"] for i in _json(urllib.request.Request("https://www.googleapis.com/youtube/v3/search?" + q))["items"]]
    if not ids:
        return []
    vq = urllib.parse.urlencode({"part": "snippet,statistics", "id": ",".join(ids), "key": api_key})
    vids = _json(urllib.request.Request("https://www.googleapis.com/youtube/v3/videos?" + vq))["items"]
    ch = {v["snippet"]["channelId"] for v in vids}
    cq = urllib.parse.urlencode({"part": "statistics", "id": ",".join(ch), "key": api_key})
    subs = {c["id"]: int(c["statistics"].get("subscriberCount", 0)) for c in _json(urllib.request.Request("https://www.googleapis.com/youtube/v3/channels?" + cq))["items"]}
    out = []
    for v in vids:
        st = v["statistics"]
        out.append(Item("youtube", v["snippet"]["title"], f"https://youtu.be/{v['id']}",
                        int(st.get("likeCount", 0)) + int(st.get("commentCount", 0)), subs.get(v["snippet"]["channelId"], 0)))
    return out
