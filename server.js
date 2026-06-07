const WS_URL = "wss://YOUR-RENDER-SERVICE.onrender.com";

const ws = new WebSocket(WS_URL);

let roomId = "";
let mySide = "";
let board = null;
let turn = "w";

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function setRoomLabel(id) {
  const el = document.getElementById("roomLabel");
  if (el) el.textContent = id || "-";
}

function setSideLabel(sideText) {
  const el = document.getElementById("sideLabel");
  if (el) el.textContent = sideText || "-";
}

function send(data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

ws.onopen = () => {
  setStatus("서버 연결됨");
};

ws.onerror = () => {
  setStatus("WebSocket 오류");
};

ws.onclose = () => {
  setStatus("연결 종료");
};

ws.onmessage = (e) => {
  let data;

  try {
    data = JSON.parse(e.data);
  } catch (err) {
    console.warn("JSON 아님:", e.data);
    setStatus("JSON이 아닌 메시지 수신: " + e.data);
    return;
  }

  if (data.type === "connected") {
    setStatus("서버와 연결되었습니다");
    return;
  }

  if (data.type === "room_joined") {
    alert("room_joined 수신: " + data.roomId);
    roomId = data.roomId;
    mySide = data.side;

    setRoomLabel(roomId);
    setSideLabel(mySide === "w" ? "White" : "Black");
    setStatus(data.message + " / " + data.roomId);

    const roomInput = document.getElementById("roomInput");
    if (roomInput) roomInput.value = roomId;

    if (data.state && data.state.board) {
      board = data.state.board;
      turn = data.state.turn || turn;
      renderBoard();
    }

    return;
  }

  if (data.type === "room_full") {
    alert("방이 가득 찼습니다");
    setStatus("방이 가득 찼습니다");
    return;
  }

  if (data.type === "start_game") {
    alert("게임 시작");
    setStatus("게임 시작");
    return;
  }

  if (data.type === "opponent_left") {
    alert("상대가 나갔습니다");
    setStatus("상대가 나갔습니다");
    return;
  }

  if (data.type === "sync_state") {
    if (data.state) {
      board = data.state.board;
      turn = data.state.turn || turn;
      renderBoard();
      setStatus("상태 동기화 완료");
    }
    return;
  }

  if (data.type === "move") {
    applyRemoteMove(data);
    return;
  }

  if (data.type === "chat") {
    console.log("chat:", data.text);
    return;
  }

  if (data.type === "error") {
    console.warn("서버 에러:", data.message);
    setStatus(data.message);
    return;
  }

  console.log("알 수 없는 메시지:", data);
};

function createRoom() {
  alert("Create Room 버튼 클릭");
  send({ type: "create_room" });
  setStatus("방 생성 요청 전송");
}

function joinRoom() {
  const roomInput = document.getElementById("roomInput");
  const inputRoomId = roomInput ? roomInput.value.trim().toUpperCase() : "";

  if (!inputRoomId) {
    alert("방 코드를 입력하세요");
    return;
  }

  alert("Join Room 클릭: " + inputRoomId);
  send({ type: "join_room", roomId: inputRoomId });
  setStatus("방 입장 요청 전송: " + inputRoomId);
}

function renderBoard() {
  console.log("renderBoard()", board, turn);
}

function applyRemoteMove(data) {
  console.log("applyRemoteMove", data);
}
