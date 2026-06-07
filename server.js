import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const rooms = {};             // roomId -> [ws, ws]

function broadcast(room, obj){
  rooms[room]?.forEach(c => c.readyState===1 && c.send(JSON.stringify(obj)));
}

wss.on("connection", ws => {
  ws.on("message", raw => {
    let msg; try{msg=JSON.parse(raw);}catch{return;}
    const { type, room, fen } = msg;

    if(type==="create"){
      rooms[room] = [ws];
      ws.room = room;
      ws.color = "w";
    }

    if(type==="join"){
      if(!rooms[room] || rooms[room].length>=2){
        ws.send(JSON.stringify({type:"error",msg:"방이 가득 찼습니다"}));
        return;
      }
      rooms[room].push(ws);
      ws.room = room;
      ws.color = "b";
      // 두 플레이어 모두에게 상대 입장 알림
      broadcast(room,{type:"peer_joined"});
      // 초기 동기화 (백색이 원본 보드 전송)
      const white = rooms[room].find(c => c.color==="w");
      if(white?.lastFen) broadcast(room,{type:"sync_state",fen:white.lastFen,color:"w"});
    }

    if(type==="sync_state"){
      ws.lastFen = fen;                 // 직전 FEN 저장
      broadcast(room,{type:"sync_state",fen,color:ws.color});
    }
  });

  ws.on("close", () => {
    const room = ws.room;
    if(!room) return;
    rooms[room] = rooms[room].filter(c => c!==ws);
    broadcast(room,{type:"peer_left"});
    if(rooms[room].length===0) delete rooms[room];
  });
});

console.log("WebSocket 서버 실행 중 : ws://localhost:8080");
