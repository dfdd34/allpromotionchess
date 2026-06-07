const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map(); 
// roomId -> { players: [{ws, side}], started: bool }

function send(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function broadcast(roomId, obj, exceptWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const p of room.players) {
    if (p.ws && p.ws.readyState === WebSocket.OPEN && p.ws !== exceptWs) {
      p.ws.send(JSON.stringify(obj));
    }
  }
}

function joinRoom(ws, roomId) {
  if (!roomId || typeof roomId !== "string") {
    send(ws, { type: "error", message: "roomId가 필요합니다." });
    return;
  }

  let room = rooms.get(roomId);
  if (!room) {
    room = { players: [], started: false };
    rooms.set(roomId, room);
  }

  if (room.players.length >= 2) {
    send(ws, { type: "room_full", roomId });
    return;
  }

  const side = room.players.length === 0 ? "w" : "b";
  room.players.push({ ws, side });
  ws.roomId = roomId;
  ws.side = side;

  send(ws, {
    type: "room_joined",
    roomId,
    side,
    message: side === "w" ? "화이트로 입장했습니다." : "블랙으로 입장했습니다."
  });

  if (room.players.length === 2) {
    const p1 = room.players[0];
    const p2 = room.players[1];

    send(p1.ws, { type: "opponent_joined" });
    send(p2.ws, { type: "opponent_joined" });

    room.started = true;
    broadcast(roomId, { type: "start_game" });
  }
}

function removePlayer(ws) {
  const roomId = ws.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.players = room.players.filter(p => p.ws !== ws);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return;
  }

  broadcast(roomId, {
    type: "error",
    message: "상대가 나갔습니다."
  });

  room.started = false;
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", message: "잘못된 JSON" });
      return;
    }

    if (data.type === "join_room") {
      joinRoom(ws, data.roomId);
      return;
    }

    if (data.type === "move") {
      const roomId = data.roomId;
      const room = rooms.get(roomId);
      if (!room) {
        send(ws, { type: "error", message: "룸이 없습니다." });
        return;
      }

      const player = room.players.find(p => p.ws === ws);
      if (!player) {
        send(ws, { type: "error", message: "룸 참가자가 아닙니다." });
        return;
      }

      if (!room.started) {
        send(ws, { type: "error", message: "게임이 아직 시작되지 않았습니다." });
        return;
      }

      broadcast(roomId, {
        type: "move",
        fromR: data.fromR,
        fromC: data.fromC,
        toR: data.toR,
        toC: data.toC,
        promotion: data.promotion || null
      });
      return;
    }

    send(ws, { type: "error", message: "알 수 없는 명령입니다." });
  });

  ws.on("close", () => {
    removePlayer(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
