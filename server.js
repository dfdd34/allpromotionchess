// server.js ─ Render 512 MB 플랜 호환: HTTP + WebSocket in one process
import http  from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

// server.js 의 HTTP 핸들러 맨 위에 공통 헤더 추가
const setCORS = res => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Content-Type-Options", "nosniff");
};

// 기존 createServer 콜백 안에서
const server = http.createServer((req, res) => {
  setCORS(res);               // ← 추가!

  if (req.url === "/healthz") { … }
  …
});


/* ───── 1. 아주 얇은 HTTP 서버 ───── */
const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {          // Render 헬스체크용(선택)
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  if (req.url === "/") {                 // 루트 접근 시 안내만
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("♟ WebSocket endpoint only. Use wss:// for chess client.");
  }
  res.writeHead(404); res.end();
});

/* ───── 2. 같은 포트에 WS 붙이기 ───── */
const wss = new WebSocketServer({ server });

/* ───── 3. 방/세션 로직 (변경 없음, 최소 메모리 버전) ───── */
const rooms = new Map();                // roomId → Set<ws>

function send(ws, o){ ws.readyState===1 && ws.send(JSON.stringify(o)); }
function cast(room,o){
  const R=rooms.get(room); if(!R) return;
  const m=JSON.stringify(o); R.forEach(c=>c.readyState===1&&c.send(m));
}

wss.on("connection", ws => {
  ws.on("message", buf => {
    let m; try{ m=JSON.parse(buf); }catch{return;}
    const { type, room, fen } = m;

    if(type==="create"){
      rooms.set(room,new Set([ws]));
      ws.room=room; ws.color="w";
      send(ws,{type:"created",room});
    }

    else if(type==="join"){
      if(!rooms.has(room)||rooms.get(room).size>=2)
        return send(ws,{type:"error",msg:"방이 가득 찼습니다"});
      rooms.get(room).add(ws);
      ws.room=room; ws.color="b";

      const white=[...rooms.get(room)].find(c=>c.color==="w");
      if(white?.lastFen) send(ws,{type:"sync_state",fen:white.lastFen,color:"b"});
      cast(room,{type:"peer_joined"});
    }

    else if(type==="sync_state"){
      ws.lastFen=fen;
      cast(room,{type:"sync_state",fen,color:ws.color});
    }
  });

  ws.on("close",()=>{
    const {room}=ws; if(!room) return;
    const set=rooms.get(room); if(!set) return;
    set.delete(ws); cast(room,{type:"peer_left"});
    if(set.size===0) rooms.delete(room);
  });
});

/* ───── 4. 리슨 시작 ───── */
server.listen(PORT, () => console.log(`✅  HTTP/WS listening on :${PORT}`));
