// server.js  ─ Render free tier / HTTP + WS + CORS (CORB 해결판)
import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

/* ───── CORS & 보안 헤더 ───── */
const setCORS = res => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
};

/* ───── 하나뿐인 HTTP 핸들러 ───── */
const server = http.createServer((req, res) => {
  setCORS(res);

  // 브라우저가 보내는 OPTIONS 프리플라이트 대응
  if (req.method === "OPTIONS") {
    res.writeHead(204);         // No Content
    return res.end();
  }

  if (req.url === "/healthz") { // Render 헬스체크
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }

  if (req.url === "/") {        // 루트 접근 안내
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("♟ WebSocket endpoint only. Use wss:// for chess client.");
  }

  res.writeHead(404); res.end();
});

/* ───── 같은 포트에 WebSocket 붙이기 ───── */
const wss = new WebSocketServer({ server });

/* ───── 방/세션 로직 ───── */
const rooms = new Map();             // roomId → Set<ws>

function send(ws, obj)  { ws.readyState === 1 && ws.send(JSON.stringify(obj)); }
function cast(room, obj){
  const R = rooms.get(room); if (!R) return;
  const m = JSON.stringify(obj);
  R.forEach(c => c.readyState === 1 && c.send(m));
}

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

/* ───── 서버 시작 ───── */
server.listen(PORT, () =>
  console.log(`✅  HTTP + WebSocket listening on :${PORT}`)
);
