// server.js  ─ Render free-tier(512 MB) 완전 호환
import http from "http";
import fs   from "fs";
import path from "path";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

/* ───── 공통 CORS / 보안 헤더 ───── */
const setCORS = res => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
};

/* ───── 정적 파일 MIME 테이블 ───── */
const MIME = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".gif":  "image/gif",
  ".css":  "text/css",
  ".js":   "text/javascript",
  ".html": "text/html"
};

/* ───── 하나뿐인 HTTP 서버 ───── */
const server = http.createServer((req, res) => {
  setCORS(res);

  // 1) OPTIONS 프리플라이트
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // 2) /healthz — Render 헬스체크
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }

  // 3) /img/ …  정적 파일 (말 그림 등)
  if (req.url.startsWith("/img/")) {
    const filePath = path.join(process.cwd(), "public", req.url);
    if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end("Not found"); }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    return fs.createReadStream(filePath).pipe(res);
  }

  // 4) /  — 루트 안내
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("♟ WebSocket endpoint only. Open the index.html from your static host.");
  }

  res.writeHead(404); res.end("Not found");
});

/* ───── 같은 포트에 WebSocket 붙이기 ───── */
const wss  = new WebSocketServer({ server });
const rooms = new Map();           // roomId → Set<ws>

const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const cast = (room, o) => {
  const R = rooms.get(room); if (!R) return;
  const m = JSON.stringify(o);
  R.forEach(c => c.readyState === 1 && c.send(m));
};

wss.on("connection", ws => {
  ws.on("message", buf => {
    let m; try { m = JSON.parse(buf); } catch { return; }
    const { type, room, fen } = m;

    if (type === "create") {
      rooms.set(room, new Set([ws]));
      ws.room = room; ws.color = "w";
      send(ws, { type: "created", room });
    }
    else if (type === "join") {
      if (!rooms.has(room) || rooms.get(room).size >= 2)
        return send(ws, { type: "error", msg: "방이 가득 찼습니다" });
      rooms.get(room).add(ws);
      ws.room = room; ws.color = "b";

      const white = [...rooms.get(room)].find(c => c.color === "w");
      if (white?.lastFen) send(ws, { type: "sync_state", fen: white.lastFen, color: "b" });
      cast(room, { type: "peer_joined" });
    }
    else if (type === "sync_state") {
      ws.lastFen = fen;
      cast(room, { type: "sync_state", fen, color: ws.color });
    }
  });

  ws.on("close", () => {
    const { room } = ws; if (!room) return;
    const set = rooms.get(room); if (!set) return;
    set.delete(ws); cast(room, { type: "peer_left" });
    if (set.size === 0) rooms.delete(room);
  });
});

/* ───── 서버 스타트 ───── */
server.listen(PORT, () =>
  console.log(`✅  HTTP + WebSocket listening on :${PORT}`)
);
