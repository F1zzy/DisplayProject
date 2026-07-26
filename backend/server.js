require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const os = require('os');
const { WebSocketServer } = require('ws');

const apiRoutes = require('./routes/api');
const createDisplayRouter = require('./routes/display');
const createSettingsRouter = require('./routes/settings');

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';
const clients = new Set();

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}

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

const settingsRouter = createSettingsRouter(broadcast);
app.use('/api/settings', settingsRouter);

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
  server.listen(port, host, () => {
    console.log(`Server running at http://localhost:${port}`);
    const lanAddress = getLanAddress();
    if (lanAddress) {
      console.log(`LAN access: http://${lanAddress}:${port}`);
      console.log(`Remote control: http://${lanAddress}:${port}/remote`);
    }

    try {
      const settings = require('./services/settings');
      const { setDisplayBrightness } = require('./services/displayBrightness');
      setDisplayBrightness(settings.getSettings().displayBrightness);
    } catch (error) {
      console.error('Failed to apply display brightness on startup:', error.message);
    }

    try {
      require('./services/f1Live').start();
    } catch (error) {
      console.error('Failed to start F1 live timing client:', error.message);
    }
  });
}

module.exports = { app, server };
