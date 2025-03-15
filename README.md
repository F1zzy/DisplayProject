# DisplayProject

## Overview
DisplayProject is a Raspberry Pi-powered display system that showcases various widgets, including:
- Current Time and Date
- Weather Updates
- News Feeds (General & Technology)
- Stock Market Stats
- Internet Usage Graphs
- Temperature & Humidity from DHT11 Sensor

The project is built using:
- **Backend:** Node.js & Express
- **Frontend:** React.js
- **Database (if applicable):** MongoDB
- **Sensor Integration:** Python & Flask
- **Charting Library:** Chart.js & Matplotlib
- **Data Fetching:** Axios & Fetch API
- **Styling:** Tailwind CSS & CSS Modules
- **Automation:** Raspberry Pi GPIO & Shell Scripts

## Features
- **Real-Time Updates**: Fetches live data for weather, stocks, news, and network usage.
- **Interactive Widgets**: Rotates different widgets every few minutes.
- **Alexa Integration**: Can be turned on/off using voice commands.
- **Custom Font Support**: Uses a unique Nothing Phone-style font.

## Project Structure
```
DisplayProject/
│── backend/              # Node.js server for API & sensor integration
│   │── server.js         # Express server handling API requests
│   │── package.json      # Node.js dependencies
│   │── Fonts/            # Custom fonts used in display
│   └── client/           # React frontend
│── frontend/             # React application (UI components)
│── sensors/              # Python scripts for sensor data collection
└── README.md             # Project documentation
```

## Installation
### 1. **Clone the Repository**
```bash
git clone https://github.com/your-username/DisplayProject.git
cd DisplayProject
```

### 2. **Setup the Backend**
```bash
cd backend
npm install
```

### 3. **Setup the Frontend**
```bash
cd client
npm install
```

### 4. **Setup Python Dependencies** (For Raspberry Pi Sensor Data)
```bash
pip install flask psutil Adafruit_DHT matplotlib
```

## Running the Project
### 1. **Start the Backend Server**
```bash
cd backend
node server.js
```

### 2. **Start the Frontend Application**
```bash
cd backend/client
npm start
```

### 3. **Start the Sensor API (For Raspberry Pi Users)**
```bash
cd sensors
python3 sensor_server.py
```

## API Endpoints
| Endpoint                | Method | Description |
|-------------------------|--------|-------------|
| `/api/weather`         | GET    | Fetches the current weather |
| `/api/news/general`    | GET    | Fetches breaking news |
| `/api/news/technology` | GET    | Fetches technology news |
| `/api/stocks`          | GET    | Fetches stock market stats |
| `/api/network-usage`   | GET    | Fetches internet usage data |
| `/api/sensors/dht11`   | GET    | Fetches temperature & humidity |

## Configuration
Create a `.env` file inside `backend/client/` and `backend/` with the following:
```
REACT_APP_WEATHER_API_KEY=your_api_key
REACT_APP_NEWS_API_KEY=your_api_key
REACT_APP_STOCK_API_KEY=your_api_key
```

## Usage
- The dashboard will cycle through different widgets automatically.
- To manually refresh a widget, restart the frontend.
- For real-time temperature/humidity, ensure the DHT11 sensor is connected properly.

## Future Improvements ( Currently Inactive but might come back to work on it) 
- Add more widgets (e.g., Crypto Prices, Productivity Timers)
- Improve UI Animations and Transitions
- Voice-controlled widget navigation


