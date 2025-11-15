# Family Calendar Dashboard

Google Calendar dashboard for Raspberry Pi with 7-inch touchscreen display.

## Features

- Display events from a shared Google Calendar
- Auto-refresh every 10 minutes
- Touchscreen-optimized interface for 7-inch displays
- Shows today's events and upcoming days (up to 5 events)
- Multi-day event support with start/end times

## Prerequisites

- Node.js (v16 or higher)
- Google account with access to the calendar
- Google Service Account with calendar access

## Setup

### 1. Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable Google Calendar API
3. Create a Service Account in "IAM & Admin" > "Service Accounts"
4. Create a JSON key and download it
5. Run `npm run find-email` to get the Service Account email

### 2. Share Calendar

1. Open [Google Calendar](https://calendar.google.com/)
2. Share your calendar with the Service Account email (from step 1)
3. Grant "See all event details" permission

### 3. Configure

1. Place the downloaded JSON file in `credentials/service-account.json`
2. Update `server/config.js` with your calendar ID

## Installation

```bash
npm run install:all
```

## Development

```bash
npm run dev
```

Backend: `http://localhost:5000`  
Frontend: `http://localhost:3000`

## Production

```bash
npm run build
NODE_ENV=production npm start
```

## Configuration

Edit `server/config.js`:

- `calendarId`: Your Google Calendar ID
- `timezone`: Timezone (default: Europe/Paris)
- `maxEvents`: Maximum events to display (default: 5)

## Deployment

1. Install Node.js on Raspberry Pi
2. Clone the repository
3. Place `credentials/service-account.json` on the Pi
4. Run `npm run install:all && npm run build`
5. Start with PM2: `pm2 start server/index.js --name family-dashboard`
6. Configure browser in kiosk mode

