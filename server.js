// ───────── All-Promotion-Chess WebSocket 서버 ─────────
const WebSocket = require("ws");
const PORT = process.env.PORT || 3000;
const wss  = new WebSocket.Server({ port: PORT });

/* ── 방/유틸 ─────────────────────────────────────── */
const ROOMS = new Map();                         // roomId → {clients, state}
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rid   = () => Array.from({length:6},_=>CHARS[Math.random()*CHARS.length|0]).join("");
const norm  = id=>String(id||"").trim().toUpperCase();
const send  = (ws,o)=> ws.readyState===1 && ws.send(JSON.stringify(o));
const cast  = (room,o,ex)=> room.clients.forEach(c=> c!==ex && c.readyState===1 && c.send(JSON.stringify(o)));

function join(ws, want=""){                      // 방 생성/입장
  let room = want && ROOMS.get(norm(want));
  let created=false;
  if(!room){ created=true; do{ room={roomId:rid(),clients:new Set(),state:null}; }while(ROOMS.has(room.roomId)); ROOMS.set(room.roomId,room);}
  if(room.clients.size>=2){ send(ws,{type:"room_full"}); return; }
  room.clients.add(ws); ws.roomId=room.roomId; ws.side= room.clients.size===1?"w":"b";
  send(ws,{type:"room_joined",roomId:room.roomId,side:ws.side,created,state:room.state});
  if(room.clients.size===2) cast(room,{type:"start_game"});
}
function leave(ws){ const room=ROOMS.get(ws.roomId); if(!room)return;
  room.clients.delete(ws); cast(room,{type:"opponent_left"},ws);
  if(!room.clients.size) ROOMS.delete(room.roomId);
}

/* ── WS 핸들러 ───────────────────────────────────── */
wss.on("connection", ws=>{
  send(ws,{type:"connected"});
  ws.on("message", raw=>{
    let m; try{m=JSON.parse(raw);}catch{return;}
    switch(m.type){
      case"create_room": join(ws); break;
      case"join_room"  : join(ws,m.roomId); break;
      case"sync_state" : { const r=ROOMS.get(ws.roomId); if(!r)break;
        r.state=m.state; cast(r,{type:"sync_state",state:r.state},ws);} break;
      case"move"       : { const r=ROOMS.get(ws.roomId); if(!r)break;
        cast(r,m,ws);} break;
    }
  });
  ws.on("close", ()=>leave(ws));
});
console.log("♟  WebSocket server on :",PORT);
