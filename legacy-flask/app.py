#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FOOTBALL DRAFT · 足球分队系统
================================
一个本地运行的 Flask 小应用：
  * 录入球员姓名（支持批量粘贴、自动去重）
  * 自定义球队数量（2 - 12 支）
  * 用拖拽把球员分进各支球队
  * 球队阵容自动保存到 data/state.json，同时浏览器也会留一份备份

运行：
    python app.py
然后浏览器打开 http://127.0.0.1:5000
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
import threading
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from flask import Flask, jsonify, render_template, request
except ModuleNotFoundError:  # pragma: no cover
    sys.exit(
        "缺少 Flask 依赖。\n"
        "请先安装：pip install flask\n"
        "或者：pip install -r requirements.txt"
    )

# Windows 控制台输出中文时更稳一点
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
STATE_FILE = DATA_DIR / "state.json"

MAX_PLAYERS = 300
MAX_TEAMS = 12
MAX_BODY_BYTES = 512 * 1024

ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_BODY_BYTES
try:
    app.json.ensure_ascii = False  # Flask >= 2.2
except AttributeError:  # pragma: no cover
    app.config["JSON_AS_ASCII"] = False

_state_lock = threading.Lock()


# --------------------------------------------------------------------------- #
# 状态校验
# --------------------------------------------------------------------------- #
def empty_state() -> dict[str, Any]:
    return {
        "version": 1,
        "updatedAt": None,
        "seq": {"player": 0, "team": 0},
        "players": {},
        "pool": [],
        "teams": [],
    }


def _clean_text(value: Any, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = "".join(ch for ch in value if ch.isprintable())
    return cleaned.strip()[:limit]


def _safe_int(value: Any) -> int:
    try:
        return max(0, min(int(value), 10**7))
    except (TypeError, ValueError):
        return 0


def _max_suffix(ids: list[str]) -> int:
    biggest = 0
    for item in ids:
        match = re.search(r"(\d+)$", item)
        if match:
            biggest = max(biggest, int(match.group(1)))
    return biggest


def sanitize_state(raw: Any) -> dict[str, Any]:
    """把前端传来的状态整理成干净、可信的结构。"""
    if not isinstance(raw, dict):
        raise ValueError("数据格式不正确")

    players_raw = raw.get("players")
    if not isinstance(players_raw, dict):
        raise ValueError("players 必须是对象")

    players: dict[str, dict[str, str]] = {}
    for pid, payload in list(players_raw.items())[:MAX_PLAYERS]:
        if not isinstance(pid, str) or not ID_RE.match(pid):
            continue
        if not isinstance(payload, dict):
            continue
        name = _clean_text(payload.get("name"), 24)
        if not name:
            continue
        players[pid] = {"id": pid, "name": name}

    teams_raw = raw.get("teams")
    if not isinstance(teams_raw, list):
        raise ValueError("teams 必须是数组")

    teams: list[dict[str, Any]] = []
    used: set[str] = set()
    seen_team_ids: set[str] = set()

    for item in teams_raw[:MAX_TEAMS]:
        if not isinstance(item, dict):
            continue
        tid = item.get("id")
        if not isinstance(tid, str) or not ID_RE.match(tid) or tid in seen_team_ids:
            continue
        seen_team_ids.add(tid)

        name = _clean_text(item.get("name"), 16) or f"球队{len(teams) + 1}"
        color = item.get("color")
        if not isinstance(color, str) or not COLOR_RE.match(color):
            color = "#22c55e"

        members: list[str] = []
        for pid in item.get("players") if isinstance(item.get("players"), list) else []:
            if isinstance(pid, str) and pid in players and pid not in used:
                used.add(pid)
                members.append(pid)

        teams.append(
            {
                "id": tid,
                "name": name,
                "color": color.lower(),
                "players": members,
            }
        )

    pool: list[str] = []
    for pid in raw.get("pool") if isinstance(raw.get("pool"), list) else []:
        if isinstance(pid, str) and pid in players and pid not in used:
            used.add(pid)
            pool.append(pid)

    # 没有归属的球员统一放进替补席，避免数据丢失
    for pid in players:
        if pid not in used:
            used.add(pid)
            pool.append(pid)

    seq_raw = raw.get("seq") if isinstance(raw.get("seq"), dict) else {}
    seq = {
        "player": max(
            _safe_int(seq_raw.get("player")),
            _max_suffix(list(players.keys())),
        ),
        "team": max(
            _safe_int(seq_raw.get("team")),
            _max_suffix([t["id"] for t in teams]),
        ),
    }

    return {
        "version": 1,
        "updatedAt": _clean_text(raw.get("updatedAt"), 40) or None,
        "seq": seq,
        "players": players,
        "pool": pool,
        "teams": teams,
    }


def read_state() -> dict[str, Any] | None:
    if not STATE_FILE.exists():
        return None
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        app.logger.warning("读取状态失败：%s", exc)
        return None
    return data if isinstance(data, dict) else None


def write_state(state: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(tmp, STATE_FILE)


# --------------------------------------------------------------------------- #
# 路由
# --------------------------------------------------------------------------- #
@app.after_request
def _headers(response):
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify(
        {
            "ok": True,
            "app": "football-draft",
            "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
    )


@app.get("/api/state")
def get_state():
    with _state_lock:
        state = read_state()
    return jsonify({"state": state})


@app.post("/api/state")
def save_state():
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"ok": False, "error": "需要 JSON 数据"}), 400

    try:
        state = sanitize_state(payload)
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    state["updatedAt"] = (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )

    try:
        with _state_lock:
            write_state(state)
    except OSError as exc:
        app.logger.exception("保存状态失败")
        return jsonify({"ok": False, "error": f"保存失败：{exc}"}), 500

    return jsonify({"ok": True, "savedAt": state["updatedAt"]})


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"ok": False, "error": "提交的数据太大了"}), 413


# --------------------------------------------------------------------------- #
# 启动
# --------------------------------------------------------------------------- #
def port_in_use(host: str, port: int) -> bool:
    check_host = "127.0.0.1" if host in ("0.0.0.0", "::", "") else host
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex((check_host, port)) == 0


def pick_port(host: str, start: int) -> int:
    for candidate in range(start, start + 30):
        if not port_in_use(host, candidate):
            return candidate
    return start


def main() -> None:
    parser = argparse.ArgumentParser(description="FOOTBALL DRAFT · 足球分队系统")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1")
    parser.add_argument("--port", type=int, default=5000, help="端口，默认 5000（被占用时自动 +1）")
    parser.add_argument("--no-browser", action="store_true", help="启动后不自动打开浏览器")
    parser.add_argument("--debug", action="store_true", help="开启调试模式")
    args = parser.parse_args()

    port = pick_port(args.host, args.port)
    if port != args.port:
        print(f"[提示] 端口 {args.port} 已被占用，改用 {port}")

    browser_host = "127.0.0.1" if args.host in ("0.0.0.0", "::", "") else args.host
    url = f"http://{browser_host}:{port}"

    print("=" * 52)
    print("  FOOTBALL DRAFT · 足球分队系统")
    print(f"  本地地址 : {url}")
    print(f"  数据文件 : {STATE_FILE}")
    print("  停止服务 : Ctrl + C")
    print("=" * 52)

    if not args.no_browser:
        threading.Timer(1.1, lambda: webbrowser.open(url)).start()

    app.run(
        host=args.host,
        port=port,
        debug=args.debug,
        use_reloader=False,
        threaded=True,
    )


if __name__ == "__main__":
    main()
