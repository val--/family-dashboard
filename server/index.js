const express = require('express');
const cors = require('cors');
const path = require('path');
const calendarService = require('./calendar');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? false // In production, static files are served by Express, no CORS needed
    : 'http://localhost:3000', // Allow requests from Vite dev server
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

