const WebSocket = require("ws");
const http = require("http");

const port = process.env.PORT || 3000;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map();

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function getRoomInfo(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      players: [],
    });
  }
  return rooms.get(roomId);
}

wss.on("connection", (ws) => {
  ws.roomId = null;
  ws.side = null;

  send(ws, { type: "connected" });

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch (e) {
      send(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    if (data.type === "create_room") {
      const roomId = String(data.roomId || "").trim();
      if (!roomId) {
        send(ws, { type: "error", message: "roomId required" });
        return;
      }

      const room = getRoomInfo(roomId);
      if (room.players.length >= 2) {
        send(ws, { type: "error", message: "Room full" });
        return;
      }

      ws.roomId = roomId;
      ws.side = room.players.length === 0 ? "white" : "black";
      room.players.push(ws);

      send(ws, {
        type: "room_joined",
        roomId,
        side: ws.side,
        players: room.players.length,
      });

      if (room.players.length === 2) {
        room.players.forEach((p) => send(p, { type: "start_game" }));
      }
      return;
    }

    if (data.type === "join_room") {
      const roomId = String(data.roomId || "").trim();
      if (!roomId) {
        send(ws, { type: "error", message: "roomId required" });
        return;
      }

      const room = getRoomInfo(roomId);
      if (room.players.length >= 2) {
        send(ws, { type: "error", message: "Room full" });
        return;
      }

      ws.roomId = roomId;
      ws.side = room.players.length === 0 ? "white" : "black";
      room.players.push(ws);

      send(ws, {
        type: "room_joined",
        roomId,
        side: ws.side,
        players: room.players.length,
      });

      if (room.players.length === 2) {
        room.players.forEach((p) => send(p, { type: "start_game" }));
      }
      return;
    }

    if (data.type === "move") {
      if (!ws.roomId) {
        send(ws, { type: "error", message: "Not in a room" });
        return;
      }

      const room = rooms.get(ws.roomId);
      if (!room) return;

      room.players.forEach((p) => {
        if (p !== ws) {
          send(p, {
            type: "move",
            from: data.from,
            to: data.to,
            piece: data.piece,
            fen: data.fen,
          });
        }
      });
      return;
    }

    if (data.type === "chat") {
      if (!ws.roomId) return;
      const room = rooms.get(ws.roomId);
      if (!room) return;

      room.players.forEach((p) => {
        if (p !== ws) {
          send(p, { type: "chat", text: data.text || "" });
        }
      });
      return;
    }
  });

  ws.on("close", () => {
    if (!ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;

    room.players = room.players.filter((p) => p !== ws);

    room.players.forEach((p) =>
      send(p, { type: "opponent_left" })
    );

    if (room.players.length === 0) {
      rooms.delete(ws.roomId);
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
