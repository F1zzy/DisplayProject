require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const apiRoutes = require('./routes/api');
const createDisplayRouter = require('./routes/display');

const app = express();
const port = process.env.PORT || 3000;
const clients = new Set();

function broadcast(message) {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

app.use(express.json());
app.use('/api', apiRoutes);

const displayRouter = createDisplayRouter(broadcast);
app.use('/api/display', displayRouter);

app.post('/api/control-display', (req, res, next) => {
  req.url = '/control-display';
  displayRouter(req, res, next);
});

app.use(express.static(path.join(__dirname, 'client/build')));
app.use('/remote', express.static(path.join(__dirname, 'remote')));

app.get('/remote', (_req, res) => {
  res.sendFile(path.join(__dirname, 'remote', 'index.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/display' });

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = { app, server };
