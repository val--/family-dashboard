# Family Dashboard

Tableau de bord pour Raspberry Pi avec écran tactile de 7 pouces. Affiche la météo, les événements du calendrier familial depuis Google Calendar et les données de consommation électrique depuis MyElectricalData.

## Fonctionnalités

- **Bandeau Météo** : Affiché en haut de toutes les pages
  - Météo actuelle avec température, conditions et icône
  - Prévisions sur 4 jours à venir
  - Ville configurable (par défaut : Rezé)
  - Actualisation automatique

- **Widget Calendrier** : Affiche les événements d'un calendrier Google partagé
  - Affiche les événements du jour et des jours à venir
  - Support des événements multi-jours avec heures de début/fin
  - Indicateurs de vacances scolaires
  - Cliquer sur les événements pour voir les détails complets
  - Page calendrier complète avec tous les événements à venir

- **Widget Électricité** : Affiche la consommation électrique du compteur Linky
  - Consommation d'hier avec comparaison au jour précédent
  - Graphique d'évolution sur 7 jours (widget) / 15 jours (page complète)
  - Évolution mensuelle sur 12 mois
  - Comparaison hebdomadaire avec la semaine précédente
  - Informations du contrat (puissance souscrite)

- **Optimisé pour écran tactile** : Interface optimisée pour les écrans tactiles de 7 pouces
- **Actualisation automatique** : Les données se rafraîchissent toutes les 5 minutes
- **Navigation multi-pages** : Page d'accueil avec widgets, pages dédiées pour le calendrier et l'électricité

## Prérequis

- Node.js (v16 ou supérieur)
- Compte Google avec accès au calendrier
- Compte de service Google avec accès au calendrier
- Compte MyElectricalData et token (pour le widget électricité)
- Compte OpenWeatherMap et clé API (pour le widget météo)

## Configuration

### 1. Compte de service Google

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un projet et activez l'API Google Calendar
3. Créez un compte de service dans "IAM & Admin" > "Comptes de service"
4. Créez une clé JSON et téléchargez-la
5. Exécutez `npm run find-email` pour obtenir l'email du compte de service

### 2. Partager le calendrier

1. Ouvrez [Google Calendar](https://calendar.google.com/)
2. Partagez votre calendrier avec l'email du compte de service (de l'étape 1)
3. Accordez la permission "Voir tous les détails des événements"

### 3. Configuration MyElectricalData

1. Allez sur [MyElectricalData](https://www.myelectricaldata.fr/)
2. Inscrivez-vous et obtenez votre token
3. Trouvez votre numéro de "Point de Livraison" (PDL)

### 4. Configuration Météo

1. Allez sur [OpenWeatherMap](https://openweathermap.org/api)
2. Créez un compte gratuit
3. Générez une clé API (gratuite, jusqu'à 1000 appels/jour)
4. Ajoutez `WEATHER_API_KEY` dans votre fichier `.env`

### 5. Configuration

1. Placez le fichier JSON du compte de service Google téléchargé dans `credentials/service-account.json`
2. Copiez `.env.example` vers `.env` :
   ```bash
   cp .env.example .env
   ```
3. Éditez `.env` et remplissez votre configuration :
   - `CALENDAR_ID` : Votre ID de calendrier Google
   - `MYELECTRICALDATA_PDL` : Votre numéro PDL
   - `MYELECTRICALDATA_TOKEN` : Votre token MyElectricalData
   - `WEATHER_API_KEY` : Votre clé API OpenWeatherMap (gratuite sur [openweathermap.org](https://openweathermap.org/api))
   - `WEATHER_CITY` : Nom de la ville pour la météo (par défaut : Rezé)
   - `TIMEZONE` : Votre fuseau horaire (par défaut : Europe/Paris)

Le fichier `.env` est automatiquement chargé et n'est pas commité dans git (il est dans `.gitignore`).

## Installation

```bash
npm run install:all
```

## Développement

```bash
npm run dev
```

Backend : `http://localhost:5000`  
Frontend : `http://localhost:3000`

Le serveur est accessible sur votre réseau local à `http://<votre-ip>:5000`

## Production

```bash
npm run build
NODE_ENV=production npm start
```

## Configuration

La configuration se fait via le fichier `.env` (voir la section Configuration ci-dessus). Les variables suivantes sont disponibles :

- `CALENDAR_ID` : Votre ID de calendrier Google
- `TIMEZONE` : Fuseau horaire (par défaut : Europe/Paris)
- `MAX_EVENTS` : Nombre maximum d'événements à afficher (vide = pas de limite)
- `CREDENTIALS_PATH` : Chemin vers le fichier JSON du compte de service Google (par défaut : ./credentials/service-account.json)
- `MYELECTRICALDATA_PDL` : Votre numéro de point de livraison électrique
- `MYELECTRICALDATA_TOKEN` : Votre token API MyElectricalData
- `MYELECTRICALDATA_BASE_URL` : URL de base de l'API MyElectricalData (par défaut : https://www.myelectricaldata.fr)
- `MYELECTRICALDATA_USE_CACHE` : Utiliser les endpoints de cache pour réduire la charge API (par défaut : true)
- `WEATHER_API_KEY` : Clé API OpenWeatherMap (obligatoire pour le widget météo)
- `WEATHER_CITY` : Nom de la ville pour la météo (par défaut : Rezé)
- `WEATHER_UNITS` : Unités de température (metric, imperial, kelvin - par défaut : metric)
- `WEATHER_LANG` : Langue des descriptions météo (par défaut : fr)

## Scripts

- `npm run dev` : Démarrer le serveur de développement (backend + frontend)
- `npm run build` : Construire le frontend pour la production
- `npm run start` : Démarrer le serveur de production
- `npm run install:all` : Installer toutes les dépendances (racine + client)
- `npm run find-email` : Obtenir l'email du compte de service depuis les credentials
- `npm run fetch-events` : Script de test pour récupérer les événements du calendrier
- `npm run fetch-electricity` : Script de test pour récupérer les données électriques

## Déploiement

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
