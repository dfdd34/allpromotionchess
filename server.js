const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map();

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(roomId, data) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const p of room.players) send(p.ws, data);
}

function normalizeRoomId(roomId) {
  if (typeof roomId !== "string") return "";
  return roomId.trim().toUpperCase();
}

function makeRoomId() {
  let id = "";
  do {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(id));
  return id;
}

function createOrJoinRoom(ws, rawRoomId) {
  let roomId = normalizeRoomId(rawRoomId);
  if (!roomId) roomId = makeRoomId();

  let room = rooms.get(roomId);
  let created = false;

  if (!room) {
    room = {
      players: [],
      state: null,
      started: false
    };
    rooms.set(roomId, room);
    created = true;
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
    created,
    message: created ? "룸 생성 완료" : "룸 입장 완료"
  });

  if (room.players.length === 2) {
    room.started = true;
    broadcast(roomId, { type: "start_game", roomId });
  }
}

function leaveRoom(ws) {
  const roomId = ws.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.players = room.players.filter(p => p.ws !== ws);

  if (room.players.length === 0) {
    rooms.delete(roomId);
  } else {
    broadcast(roomId, { type: "opponent_left" });
  }

  ws.roomId = null;
  ws.side = null;
}

wss.on("connection", (ws) => {
  ws.roomId = null;
  ws.side = null;

  send(ws, { type: "connected" });

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch {
      return;
    }

    if (data.type === "create_room") {
      createOrJoinRoom(ws, "");
      return;
    }

    if (data.type === "join_room") {
      createOrJoinRoom(ws, data.roomId);
      return;
    }

    if (data.type === "leave_room") {
      leaveRoom(ws);
      return;
    }

    if (data.type === "move") {
      const roomId = ws.roomId;
      if (!roomId) return;
      broadcast(roomId, {
        type: "move",
        from: data.from,
        to: data.to,
        promotion: data.promotion || null,
        piece: data.piece || null,
        turn: data.turn || null
      });
      return;
    }

    if (data.type === "sync_state") {
      const roomId = ws.roomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      room.state = data.state || null;
      broadcast(roomId, {
        type: "sync_state",
        state: room.state
      });
      return;
    }
  });

  ws.on("close", () => {
    leaveRoom(ws);
  });
});

console.log(`WebSocket server running on port ${PORT}`);
