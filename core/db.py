"""Camada de Memória: SQLite com histórico, logs de API, feedback e índice de APIs."""
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS apis(
  name TEXT, url TEXT, description TEXT, auth TEXT, https INTEGER, cors TEXT, category TEXT,
  PRIMARY KEY(name, category));
CREATE TABLE IF NOT EXISTS runs(
  id INTEGER PRIMARY KEY, bot TEXT NOT NULL, started_at TEXT DEFAULT CURRENT_TIMESTAMP, params TEXT);
CREATE TABLE IF NOT EXISTS items(
  id INTEGER PRIMARY KEY, run_id INTEGER REFERENCES runs(id), source TEXT, title TEXT, url TEXT,
  engagement REAL, followers REAL, rate REAL, short_url TEXT);
CREATE TABLE IF NOT EXISTS api_logs(
  id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, api TEXT, ok INTEGER, detail TEXT);
CREATE TABLE IF NOT EXISTS leads(
  id INTEGER PRIMARY KEY, run_id INTEGER, osm_id TEXT UNIQUE, name TEXT, niche TEXT, city TEXT,
  phone TEXT, website TEXT, instagram TEXT, address TEXT, hours TEXT, score REAL, reasons TEXT);
CREATE TABLE IF NOT EXISTS tips_log(
  id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, lead_id INTEGER, tip_id TEXT, outcome TEXT);
CREATE TABLE IF NOT EXISTS unanswered(
  id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, business TEXT, question TEXT, answer TEXT);
CREATE TABLE IF NOT EXISTS feedback(
  id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, run_id INTEGER, note TEXT);
"""


def connect(path: str = "freguesbot.db") -> sqlite3.Connection:
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con
