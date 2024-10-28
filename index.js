const express = require('express');
const http = require('http');
const WebSocket = require('ws');
var process = require('process')

const height = 200;
const width = 80;
let fields = new Array(height * width).fill('');
let colors = new Array(height * width).fill('black');
let bgcolors = new Array(height * width).fill('white');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
let clients = new Set();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.get('/index.js', (req, res) => {
  res.sendFile(__dirname + '/index.js');
});
app.get('/mvm.ttf', (req, res) => {
  res.sendFile(__dirname + '/mvm.ttf');
});

function updateClients() {
  const activeClients = JSON.stringify({
    action: 'activeClients',
    number: Array.from(clients).length,
  });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(activeClients);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established.');
  clients.add(ws);
  updateClients();
  ws.send(JSON.stringify({ action: 'full', fields, colors, bgcolors }));

  ws.on('message', (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    if (data.action === 'full') {
      console.log("full requested >...<");
      ws.send(JSON.stringify({ action: 'full', fields, colors, bgcolors }));
    } else if (data.action === 'fullxy') {
      const rows = []
      for (let r = 0; r < height; r++) {
        const row = []
        for (let c = 0; c < width; c++) {
          row.push(fields[(r * width) + c]);
        }
        rows.push(row);
      }
      ws.send(JSON.stringify({ action: 'fullxy', rows }))

    } else if (data.action === 'set' && data.index !== undefined && data.char !== undefined) {
      if (typeof data.index === 'number' && typeof data.char === 'string') {
        if (data.index > fields.length) {
          return;
        }
        const c = data.char
        const char_dec = c;
        const length = [...new Intl.Segmenter().segment(char_dec)].length
        if (!(length <= 1)) {
          return;
        }
        fields[data.index] = char_dec;
        const y = Math.floor(data.index / width);
        const x = data.index - (width * y);
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ action: 'set', index: data.index, x: x, y: y, char: char_dec }));
          }
        });
      } else {
        ws.send(JSON.stringify({ error: 'Invalid data' }));
      }
    } else if (data.action === 'setxy' && data.x !== undefined && data.y !== undefined && data.char !== undefined) {
      if (typeof data.x === 'number' && typeof data.y === 'number' && typeof data.char === 'string') {
        if ((data.x < 0 || data.x >= width) || (data.y < 0 || data.y >= height)) {
          return
        }
        const idx = (data.y * width) + data.x
        const c = data.char
        const char_dec = c;
        const length = [...new Intl.Segmenter().segment(char_dec)].length
        if (!(length <= 1)) {
          return;
        }
        fields[idx] = char_dec;
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ action: 'set', index: idx, x: data.x, y: data.y, char: char_dec }));
          }
        });
      } else {
        ws.send(JSON.stringify({ error: 'Invalid data' }));
      }
    } else if (data.action === 'info') {
      ws.send(JSON.stringify({ width: width, height: height }))
    } else if (data.action === 'color') {
      if (!(data.index && data.value)) {
        return
      }
      if (!(typeof data.index === 'number' && typeof data.value === 'string')) {
        return
      }
      if (data.index > fields.length) {
        return;
      }
      colors[data.index] = data.value;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ action: 'color', index: data.index, value: data.value }));
        }
      });
    } else if (data.action === 'bgcolor') {
      if (!(data.index && data.value)) {
        return
      }
      if (!(typeof data.index === 'number' && typeof data.value === 'string')) {
        return
      }
      if (data.index > fields.length) {
        return;
      }
      bgcolors[data.index] = data.value;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ action: 'bgcolor', index: data.index, value: data.value }));
        }
      });
    } else if (data.action === 'get') {
      if (!data.index) {
        return;
      }
      if (!(typeof data.index === 'number')) {
        return;
      }
      ws.send(JSON.stringify({ action: 'get', char: fields[data.index] }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws)
    updateClients();
    console.log('WebSocket connection closed.');
  });
});

// poor lil docker container
process.on('SIGINT', () => {
  console.info("Interrupted")
  process.exit(0)
})

server.listen(8008, () => {
  console.log('Server is running on http://localhost:8008');
});
