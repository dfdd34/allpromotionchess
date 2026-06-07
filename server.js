// server.js – Render(또는 Heroku, Vercel Function)용 초경량 WS 서버
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;
const wss  = new WebSocketServer({ port: PORT });

const rooms = new Map();                 // roomId → Set<ws>

function send(ws, obj){
  ws.readyState === 1 && ws.send(JSON.stringify(obj));
}
function broadcast(roomId, obj){
  const room = rooms.get(roomId);
  if(!room) return;
  const msg = JSON.stringify(obj);
  room.forEach(c => c.readyState === 1 && c.send(msg));
}

wss.on("connection", ws => {
  ws.on("message", raw => {
    let m; try{ m = JSON.parse(raw); } catch { return; }
    const { type, room, fen } = m;

    // 1) 방 만들기 ----------------------------------------------------------
    if(type === "create"){
      rooms.set(room, new Set([ws]));
      ws.room  = room;
      ws.color = "w";
      send(ws, { type: "created", room });
      return;
    }

    // 2) 방 입장 ------------------------------------------------------------
    if(type === "join"){
      if(!rooms.has(room) || rooms.get(room).size >= 2){
        return send(ws, { type: "error", msg: "방이 가득 찼습니다" });
      }
      rooms.get(room).add(ws);
      ws.room  = room;
      ws.color = "b";

      // 새 참가자에게 현재 FEN 전달
      const white = [...rooms.get(room)].find(c => c.color === "w");
      if(white?.lastFen){
        send(ws, { type: "sync_state", fen: white.lastFen, color: "b" });
      }

      // 양쪽 모두에게 알림
      broadcast(room, { type: "peer_joined" });
      return;
    }

    // 3) 보드 상태 동기화 ---------------------------------------------------
    if(type === "sync_state"){
      ws.lastFen = fen;
      broadcast(room, { type: "sync_state", fen, color: ws.color });
    }
  });

  // 연결 종료 ---------------------------------------------------------------
  ws.on("close", () => {
    const { room } = ws;
    if(!room) return;
    const set = rooms.get(room);
    if(!set) return;

    set.delete(ws);
    broadcast(room, { type: "peer_left" });
    if(set.size === 0) rooms.delete(room);
  });
});

console.log(`♟  WebSocket server running on :${PORT}`);
