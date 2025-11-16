// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const calendarService = require('./calendar');
const electricityService = require('./electricity');
const weatherService = require('./weather');
const newsService = require('./news');
const busService = require('./bus');
const hueService = require('./hue');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? false // In production, static files are served by Express, no CORS needed
    : true, // Allow requests from any origin in development (for network access)
  credentials: true
}));
app.use(express.json());

// API Routes
app.get('/api/events', async (req, res) => {
  try {
    const events = await calendarService.getEvents();
    res.json({ events, success: true });
  } catch (error) {
    console.error('Error in /api/events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch calendar events', 
      message: error.message,
      success: false 
    });
  }
});

// Electricity API route
app.get('/api/electricity', async (req, res) => {
  try {
    // Check if dailyChartDays parameter is provided (for widget with 15 days)
    const dailyChartDays = req.query.dailyChartDays ? parseInt(req.query.dailyChartDays, 10) : 7;
    const data = await electricityService.getWidgetData(dailyChartDays);
    res.json({ data, success: true });
  } catch (error) {
    console.error('Error in /api/electricity:', error);
    res.status(500).json({ 
      error: 'Failed to fetch electricity data', 
      message: error.message,
      success: false 
    });
  }
});

// Weather API route
app.get('/api/weather', async (req, res) => {
  try {
    const data = await weatherService.getWeatherData();
    res.json({ data, success: true });
  } catch (error) {
    console.error('Error in /api/weather:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weather data', 
      message: error.message,
      success: false 
    });
  }
});

// News API route
app.get('/api/news', async (req, res) => {
  try {
    const newsType = req.query.type || 'france'; // 'france', 'monde', 'tech'
    const data = await newsService.getNewsData(newsType);
    res.json({ data, success: true });
  } catch (error) {
    console.error('Error in /api/news:', error);
    res.status(500).json({ 
      error: 'Failed to fetch news data', 
      message: error.message,
      success: false 
    });
  }
});

// Bus API route
app.get('/api/bus', async (req, res) => {
  try {
    const data = await busService.getBusData();
    res.json({ data, success: true });
  } catch (error) {
    console.error('Error in /api/bus:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bus data', 
      message: error.message,
      success: false 
    });
  }
});

// Hue API routes
app.get('/api/hue/room', async (req, res) => {
  try {
    const config = require('./config');
    const roomName = req.query.room || config.hue.roomName;
    const data = await hueService.getRoomStatus(roomName);
    res.json({ data, success: true, roomName: config.hue.roomName });
  } catch (error) {
    console.error('Error in /api/hue/room:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Hue room data', 
      message: error.message,
      success: false 
    });
  }
});

app.get('/api/hue/config', (req, res) => {
  try {
    const config = require('./config');
    res.json({ 
      roomName: config.hue.roomName,
      success: true 
    });
  } catch (error) {
    console.error('Error in /api/hue/config:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Hue config', 
      message: error.message,
      success: false 
    });
  }
});

app.post('/api/hue/room/toggle', async (req, res) => {
  try {
    const config = require('./config');
    const roomName = req.body.room || config.hue.roomName;
    const turnOn = req.body.turnOn !== undefined ? req.body.turnOn : null; // null = toggle
    const result = await hueService.toggleRoomLights(roomName, turnOn);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/room/toggle:', error);
    res.status(500).json({ 
      error: 'Failed to toggle Hue room lights', 
      message: error.message,
      success: false 
    });
  }
});

app.post('/api/hue/room/brightness', async (req, res) => {
  try {
    const config = require('./config');
    const roomName = req.body.room || config.hue.roomName;
    const brightness = req.body.brightness;
    
    if (brightness === undefined || brightness === null) {
      return res.status(400).json({ 
        error: 'Brightness value is required', 
        success: false 
      });
    }
    
    const result = await hueService.setRoomBrightness(roomName, brightness);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/room/brightness:', error);
    res.status(500).json({ 
      error: 'Failed to set Hue room brightness', 
      message: error.message,
      success: false 
    });
  }
});

app.post('/api/hue/room/color', async (req, res) => {
  try {
    const config = require('./config');
    const roomName = req.body.room || config.hue.roomName;
    const xy = req.body.xy;
    
    if (!xy || typeof xy.x === 'undefined' || typeof xy.y === 'undefined') {
      return res.status(400).json({ 
        error: 'XY coordinates are required', 
        success: false 
      });
    }
    
    const result = await hueService.setRoomColor(roomName, xy);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/room/color:', error);
    res.status(500).json({ 
      error: 'Failed to set Hue room color', 
      message: error.message,
      success: false 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Accessible on network at: http://<your-ip>:${PORT}`);
});

