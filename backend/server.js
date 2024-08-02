const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

app.get('/api/timetable', (req, res) => {
  res.json({ timetable: "Your timetable data here" });
});

app.get('/api/news', async (req, res) => {
  const response = await fetch('https://newsapi.org/v2/top-headlines?country=us&apiKey=YOUR_API_KEY');
  const data = await response.json();
  res.json(data);
});

app.get('/api/valorant-stats', (req, res) => {
  res.json({ stats: "Your Valorant stats here" });
});

app.post('/api/control-display', (req, res) => {
  const { action } = req.body;
  const { exec } = require('child_process');
  if (action === 'on') {
    exec('python3 display_on.py', (err, stdout, stderr) => {
      if (err) {
        console.error(`exec error: ${err}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
    });
  } else if (action === 'off') {
    exec('python3 display_off.py', (err, stdout, stderr) => {
      if (err) {
        console.error(`exec error: ${err}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
    });
  }
  res.sendStatus(200);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/client/build/index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
