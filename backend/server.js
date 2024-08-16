const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

app.post('/api/control-display', (req, res) => {
  const { action } = req.body;
  if (action === 'on') {
    console.log("Display turned on"); // Replace with actual implementation later
  } else if (action === 'off') {
    console.log("Display turned off"); // Replace with actual implementation later
  }
  res.sendStatus(200);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/client/build/index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
