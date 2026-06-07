const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.send('connected');

  ws.on('message', (msg) => {
    console.log('msg:', msg.toString());
    ws.send(`echo: ${msg}`);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on ${port}`);
});
