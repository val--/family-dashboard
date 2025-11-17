# Home Dashboard

Tableau de bord pour Raspberry Pi avec écran tactile de 7 pouces. Affiche la météo, les événements du calendrier familial depuis Google Calendar, les données de consommation électrique depuis MyElectricalData, les départs de bus, le contrôle des lumières Philips Hue et les actualités.

## Fonctionnalités

- **Bandeau Météo** : Affiché en haut de la page d'accueil
  - Météo actuelle avec température, conditions et icône
  - Prévisions sur 7 jours glissants (aujourd'hui + 6 jours)
  - Ville configurable (par défaut : Rezé)
  - Actualisation automatique
  - Page météo complète avec détails supplémentaires

- **Widget Calendrier** : Affiche les événements d'un calendrier Google partagé
  - Affiche les événements du jour et des jours à venir
  - Support des événements multi-jours avec heures de début/fin
  - Indicateurs de vacances scolaires
  - Bouton de rafraîchissement manuel
  - Cliquer sur les événements pour voir les détails complets
  - Page calendrier complète avec tous les événements à venir

- **Widget Électricité** : Affiche la consommation électrique du compteur Linky
  - Consommation d'hier avec comparaison au jour précédent
  - Graphique d'évolution sur 7 jours (widget) / 15 jours (page complète)
  - Évolution mensuelle sur 12 mois
  - Comparaison hebdomadaire avec la semaine précédente
  - Informations du contrat (puissance souscrite)

- **Widget Bus** : Affiche les prochains départs de bus
  - Prochains départs depuis un arrêt configuré
  - Temps d'attente en temps réel
  - Indicateurs de statut (en temps, retard, etc.)
  - Actualisation automatique toutes les minutes
  - Support des arrêts Tan (Nantes)

- **Widget Lumières Philips Hue** : Contrôle des lumières Philips Hue
  - Affichage du statut des lumières d'une pièce
  - Contrôle on/off de toutes les lumières
  - Réglage de la luminosité avec slider
  - Sélection de scénarios prédéfinis (couleurs et ambiances)
  - Contrôle individuel de chaque lumière (page détail)
  - Page détail avec liste complète des lumières et contrôles individuels

- **Widget Actualités** : Fil d'actualités en défilement
  - Actualités en temps réel depuis newsdata.io
  - 12 catégories disponibles : Actualités, Tech, Crime, Divertissement, Mode de vie, Monde, National, Éducation, Environnement, Santé, Politique, Tourisme
  - Sélection de catégorie via menu déroulant
  - Clic sur une actualité pour voir les détails
  - QR code pour lire l'article complet sur smartphone
  - Défilement automatique avec pause au clic

- **Optimisé pour écran tactile** : Interface optimisée pour les écrans tactiles de 7 pouces
- **Actualisation automatique** : Les données se rafraîchissent automatiquement (5 min pour la plupart, 1 min pour les bus, 3 sec pour Hue)
- **Navigation multi-pages** : Page d'accueil avec widgets, pages dédiées pour le calendrier, l'électricité, la météo et les lumières

## Prérequis

- Node.js (v16 ou supérieur)
- Compte Google avec accès au calendrier
- Compte de service Google avec accès au calendrier
- Compte MyElectricalData et token (pour le widget électricité)
- Compte OpenWeatherMap et clé API (pour le widget météo)
- Pont Philips Hue (pour le widget lumières, optionnel)
- Clé API newsdata.io (pour le widget actualités, optionnel)

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

### 5. Configuration Bus (optionnel)

1. Trouvez le code de votre arrêt de bus
2. Vous pouvez utiliser le script `npm run find-bus-stop` pour rechercher un arrêt
3. Ajoutez `BUS_STOP_ID` et `BUS_STOP_NAME` dans votre fichier `.env`

### 6. Configuration Philips Hue (optionnel)

1. Assurez-vous que votre pont Hue est allumé et connecté au réseau
2. Notez l'adresse IP de votre pont Hue (accessible via l'application Hue)
3. Créez une clé d'application Hue en utilisant le script `npm run create-hue-app-key`
4. Ajoutez `HUE_BRIDGE_IP`, `HUE_APP_KEY` et `HUE_ROOM_NAME` dans votre fichier `.env`

### 7. Configuration Actualités (optionnel)

1. Allez sur [newsdata.io](https://newsdata.io/)
2. Créez un compte gratuit
3. Générez une clé API
4. Ajoutez `NEWSDATA_API_KEY` dans votre fichier `.env`

### 8. Configuration

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
   - `WEATHER_UNITS` : Unités de température (metric, imperial, kelvin - par défaut : metric)
   - `WEATHER_LANG` : Langue des descriptions météo (par défaut : fr)
   - `BUS_STOP_ID` : Code de l'arrêt de bus (optionnel)
   - `BUS_STOP_NAME` : Nom de l'arrêt de bus (optionnel)
   - `HUE_BRIDGE_IP` : Adresse IP de votre pont Hue (optionnel)
   - `HUE_APP_KEY` : Clé d'application Hue (optionnel, générée via script)
   - `HUE_ROOM_NAME` : Nom de la pièce à contrôler (optionnel, par défaut : Salon)
   - `NEWSDATA_API_KEY` : Clé API newsdata.io (optionnel)
   - `NEWS_PAGE_SIZE` : Nombre d'articles à afficher (par défaut : 20)
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

### Calendrier
- `CALENDAR_ID` : Votre ID de calendrier Google
- `TIMEZONE` : Fuseau horaire (par défaut : Europe/Paris)
- `MAX_EVENTS` : Nombre maximum d'événements à afficher (vide = pas de limite)
- `CREDENTIALS_PATH` : Chemin vers le fichier JSON du compte de service Google (par défaut : ./credentials/service-account.json)

### Électricité
- `MYELECTRICALDATA_PDL` : Votre numéro de point de livraison électrique
- `MYELECTRICALDATA_TOKEN` : Votre token API MyElectricalData
- `MYELECTRICALDATA_BASE_URL` : URL de base de l'API MyElectricalData (par défaut : https://www.myelectricaldata.fr)
- `MYELECTRICALDATA_USE_CACHE` : Utiliser les endpoints de cache pour réduire la charge API (par défaut : true)

### Météo
- `WEATHER_API_KEY` : Clé API OpenWeatherMap (obligatoire pour le widget météo)
- `WEATHER_CITY` : Nom de la ville pour la météo (par défaut : Rezé)
- `WEATHER_UNITS` : Unités de température (metric, imperial, kelvin - par défaut : metric)
- `WEATHER_LANG` : Langue des descriptions météo (par défaut : fr)

### Bus
- `BUS_STOP_ID` : Code de l'arrêt de bus (ex: "LHOU" pour "La Houssais" à Rezé)
- `BUS_STOP_NAME` : Nom de l'arrêt de bus (optionnel, pour affichage)

### Philips Hue
- `HUE_BRIDGE_IP` : Adresse IP de votre pont Hue (par défaut : 192.168.1.222)
- `HUE_APP_KEY` : Clé d'application Hue (générée via `npm run create-hue-app-key`)
- `HUE_ROOM_NAME` : Nom de la pièce à contrôler (par défaut : Salon)

### Actualités
- `NEWSDATA_API_KEY` : Clé API newsdata.io (obligatoire pour le widget actualités)
- `NEWS_PAGE_SIZE` : Nombre d'articles à afficher (par défaut : 20)

### Serveur
- `PORT` : Port du serveur (par défaut : 5000)
- `NODE_ENV` : Environnement (development ou production)

## Fonctionnement du cache et des appels API

### API MyElectricalData

Le système utilise plusieurs niveaux de cache pour réduire les appels API et éviter les erreurs 409 (rate limiting) :

#### 1. Endpoints cache de l'API

Par défaut, le système utilise les endpoints `/cache/` de l'API MyElectricalData :
- `/daily_consumption/{pdl}/start/{start}/end/{end}/cache/` au lieu de `/daily_consumption/{pdl}/start/{start}/end/{end}`
- `/contracts/{pdl}/cache/` au lieu de `/contracts/{pdl}/`

Ces endpoints cache de l'API retournent des données mises en cache côté serveur MyElectricalData, ce qui réduit la charge sur leur infrastructure et limite les risques d'erreurs 409.

#### 2. Cache côté serveur (application)

L'application maintient également un cache local des données :
- **Durée du cache** : 10 minutes
- **Portée** : Les données du widget (consommation quotidienne, mensuelle, informations du contrat)
- **Avantage** : Évite les appels API répétés pendant 10 minutes, même si plusieurs utilisateurs consultent le dashboard

#### 3. Délais entre les appels API

Pour respecter les limites de l'API (5 appels/seconde, 10000 appels/heure), des délais sont ajoutés entre les appels :
- **1 seconde** entre chaque appel API (daily consumption, previous week, contract, monthly data)
- **3 secondes** de délai lors des retries en cas d'erreur 409

#### 4. Gestion des erreurs 409

En cas d'erreur 409 (rate limiting) :
- **Retry automatique** : 2 tentatives avec un délai de 3 secondes entre chaque
- **Logs limités** : Les erreurs 409 ne sont loggées qu'une fois toutes les 5 minutes pour éviter de saturer les logs
- **Cache conservé** : Si une erreur survient, les données en cache (si disponibles) sont retournées

#### 5. Actualisation automatique

- Le frontend actualise les données toutes les **5 minutes** (REFRESH_INTERVAL)
- Grâce au cache serveur de 10 minutes, cela signifie qu'un appel API réel n'est fait que toutes les **10 minutes** maximum
- Cela réduit drastiquement le nombre d'appels API (de ~288 appels/jour à ~144 appels/jour)

### API Météo (OpenWeatherMap)

Le système utilise également un cache pour la météo :
- **Durée du cache** : 10 minutes
- **Avantage** : Limite les appels API (gratuit jusqu'à 1000 appels/jour)
- **Gestion d'erreur** : Les erreurs ne sont loggées qu'une fois toutes les 5 minutes

### API Actualités (newsdata.io)

Le système utilise un cache pour les actualités :
- **Durée du cache** : 15 minutes
- **Avantage** : Limite les appels API et améliore les performances
- **Gestion d'erreur** : Les erreurs ne sont loggées qu'une fois toutes les 5 minutes
- **Catégories supportées** : Actualités, Tech, Crime, Divertissement, Mode de vie, Monde, National, Éducation, Environnement, Santé, Politique, Tourisme

## Scripts

- `npm run dev` : Démarrer le serveur de développement (backend + frontend)
- `npm run build` : Construire le frontend pour la production
- `npm run start` : Démarrer le serveur de production
- `npm run install:all` : Installer toutes les dépendances (racine + client)
- `npm run find-email` : Obtenir l'email du compte de service depuis les credentials
- `npm run fetch-events` : Script de test pour récupérer les événements du calendrier
- `npm run fetch-electricity` : Script de test pour récupérer les données électriques
- `npm run find-bus-stop` : Script pour rechercher un arrêt de bus par nom
- `npm run create-hue-app-key` : Script pour créer une clé d'application Hue

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
