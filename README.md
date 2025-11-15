# Family Dashboard

Dashboard for Raspberry Pi with 7-inch touchscreen display. Displays family calendar events from Google Calendar and electricity consumption data from MyElectricalData.

## Features

- **Calendar Widget**: Display events from a shared Google Calendar
  - Shows today's events and upcoming days
  - Multi-day event support with start/end times
  - School holiday indicators
  - Click on events to see full details
  - Full calendar page with all upcoming events

- **Electricity Widget**: Display electricity consumption from Linky meter
  - Yesterday's consumption with comparison to previous day
  - 7-day evolution chart (widget) / 15-day evolution chart (full page)
  - 12-month monthly evolution
  - Week comparison with previous week
  - Contract information (subscribed power)

- **Touchscreen Optimized**: Interface optimized for 7-inch touchscreen displays
- **Auto-refresh**: Data refreshes every 5 minutes
- **Multi-page Navigation**: Home page with widgets, dedicated pages for calendar and electricity

## Prerequisites

- Node.js (v16 or higher)
- Google account with access to the calendar
- Google Service Account with calendar access
- MyElectricalData account and token (for electricity widget)

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

### 3. MyElectricalData Setup

1. Go to [MyElectricalData](https://www.myelectricaldata.fr/)
2. Register and get your token
3. Find your "Point de Livraison" (PDL) number

### 4. Configure

1. Place the downloaded Google Service Account JSON file in `credentials/service-account.json`
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and fill in your configuration:
   - `CALENDAR_ID`: Your Google Calendar ID
   - `MYELECTRICALDATA_PDL`: Your PDL number
   - `MYELECTRICALDATA_TOKEN`: Your MyElectricalData token
   - `TIMEZONE`: Your timezone (default: Europe/Paris)

The `.env` file is automatically loaded and is not committed to git (it's in `.gitignore`).

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

The server is accessible on your local network at `http://<your-ip>:5000`

## Production

```bash
npm run build
NODE_ENV=production npm start
```

## Configuration

Configuration is done via the `.env` file (see Setup section above). The following variables are available:

- `CALENDAR_ID`: Your Google Calendar ID
- `TIMEZONE`: Timezone (default: Europe/Paris)
- `MAX_EVENTS`: Maximum events to display (empty = no limit)
- `CREDENTIALS_PATH`: Path to Google Service Account JSON file (default: ./credentials/service-account.json)
- `MYELECTRICALDATA_PDL`: Your electricity delivery point number
- `MYELECTRICALDATA_TOKEN`: Your MyElectricalData API token
- `MYELECTRICALDATA_BASE_URL`: MyElectricalData API base URL (default: https://www.myelectricaldata.fr)
- `MYELECTRICALDATA_USE_CACHE`: Use cache endpoints to reduce API load (default: true)

## Scripts

- `npm run dev`: Start development server (backend + frontend)
- `npm run build`: Build frontend for production
- `npm run start`: Start production server
- `npm run install:all`: Install all dependencies (root + client)
- `npm run find-email`: Get Service Account email from credentials
- `npm run fetch-events`: Test script to fetch calendar events
- `npm run fetch-electricity`: Test script to fetch electricity data

## Deployment

### Docker (Recommandé)

Le projet peut être déployé facilement avec Docker et Docker Compose.

#### Prérequis

- Docker Engine 20.10+
- Docker Compose 2.0+

#### Configuration

1. **Créer le fichier `.env`** (si pas déjà fait) :
   ```bash
   cp .env.example .env
   ```
   Puis éditez `.env` avec vos valeurs.

2. **Placer le fichier `credentials/service-account.json`** :
   Assurez-vous que le fichier Google Service Account JSON est présent dans `credentials/service-account.json`

#### Démarrage

```bash
# Build et démarrage
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down
```

Le dashboard sera accessible sur `http://localhost:5000` (ou le port configuré dans `.env`).

#### Commandes utiles

```bash
# Rebuild après modification du code
docker-compose up -d --build

# Voir les logs en temps réel
docker-compose logs -f dashboard

# Redémarrer le conteneur
docker-compose restart dashboard

# Arrêter et supprimer les conteneurs
docker-compose down

# Arrêter, supprimer et nettoyer les volumes
docker-compose down -v
```

#### Mise à jour

```bash
# Récupérer les dernières modifications
git pull

# Rebuild et redémarrer
docker-compose up -d --build
```

#### Déploiement sur Freebox Delta / Serveur

1. Transférez le projet sur votre serveur (via Git, SCP, etc.)
2. Configurez le fichier `.env` et placez `credentials/service-account.json`
3. Lancez `docker-compose up -d`

Pour un accès depuis l'extérieur, configurez le port forwarding dans votre routeur/Freebox.

### On Raspberry Pi

1. Install Node.js on Raspberry Pi
2. Clone the repository
3. Place `credentials/service-account.json` on the Pi
4. Copy `.env.example` to `.env` and configure it with your values
5. Run `npm run install:all && npm run build`
6. Start with PM2: `pm2 start server/index.js --name family-dashboard`
7. Configure browser in kiosk mode with touch support

### Browser Setup for Touch Support

**Option 1: Using Chromium (recommended)**
```bash
# Install Chromium if not already installed
sudo apt-get update
sudo apt-get install chromium

# Start in kiosk mode with touch support
chromium --kiosk --touch-events=enabled --enable-touch-drag-drop http://localhost:5000
```

**Option 2: Auto-start on boot**
Add to `/etc/xdg/lxsession/LXDE-pi/autostart`:
```
@chromium --kiosk --touch-events=enabled --enable-touch-drag-drop http://localhost:5000
```

**To exit kiosk mode:**
Press `Alt+F4` or kill the process: `pkill chromium`

## Security

⚠️ **Important**: Never commit sensitive data to the repository!

- `credentials/service-account.json` is in `.gitignore`
- Use `server/config.example.js` as a template
- Use environment variables for production deployments
- Keep your MyElectricalData token secure

## Project Structure

```
family-dashboard/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main app with routing
│   │   ├── Home.jsx       # Home page with widgets
│   │   ├── Calendar.jsx   # Full calendar page
│   │   ├── CalendarWidget.jsx  # Calendar widget
│   │   ├── Electricity.jsx     # Full electricity page
│   │   ├── ElectricityWidget.jsx  # Electricity widget
│   │   └── ...
│   └── package.json
├── server/                 # Express backend
│   ├── index.js           # Express server
│   ├── calendar.js        # Google Calendar service
│   ├── electricity.js     # MyElectricalData service
│   ├── config.js          # Configuration (use config.example.js as template)
│   └── config.example.js  # Example configuration
├── credentials/            # Sensitive files (gitignored)
│   └── service-account.json
├── scripts/                # Utility scripts
│   ├── find-service-account-email.js
│   ├── fetch-events.js
│   └── fetch-electricity.js
└── package.json
```
