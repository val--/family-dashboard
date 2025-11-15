// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const calendarService = require('./calendar');
const electricityService = require('./electricity');

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

