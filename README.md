# GigShield

GigShield is a full-stack demo platform for risk protection in gig work. It lets a delivery worker buy weekly coverage, track wallet balance and claims, and lets an admin review claims, fraud signals, zones, triggers, and insurance plans.

The project was built for a hackathon setting, so it keeps the data layer simple and easy to run locally. The backend stores demo data in a JSON file, while the ML service runs separately behind a small FastAPI API.

## What It Does

- Worker login and admin login with seeded demo users
- Weekly protection plans with dynamic premium calculation
- Claim creation, claim history, proof-pack download, and payout status
- Wallet top-up, withdrawal, and transaction history
- Admin dashboard for claims, fraud review, zone analytics, and plan management
- Simulated disruption triggers such as rain, AQI, heat, flood, cyclone, curfew, and fog
- ML microservice for premium pricing, fraud score, payout calculation, and weekly risk forecasts
- Optional integrations for OpenWeather, Groq chatbot, SMTP email, and demo payment rails

## Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | React 18, Axios, Chart.js, Recharts |
| Backend | Node.js, Express, JWT auth |
| ML service | Python, FastAPI, Uvicorn, scikit-learn, pandas |
| Data store | JSON file at `backend/data/db.json` |
| Docker | Docker Compose with frontend, backend, and ML containers |

## Project Structure

```text
gigshield-v2/
  backend/          Express API, auth, policies, claims, wallet, admin routes
  frontend/         React app served locally or through nginx in Docker
  ml-service/       FastAPI ML service and trained model files
  docker-compose.yml
  start.sh          macOS/Linux/WSL local startup helper
```

## Demo Accounts

Use these after the app starts:

| Role | Login |
| --- | --- |
| Worker | `9876543210` / `password123` |
| Admin | `admin@gigshield.in` / `admin123` |

## Ports

| Service | Local URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| Backend health/status | `http://localhost:4000/api/status` |
| ML Swagger docs | `http://localhost:5001/docs` |

Keep these ports free before starting the app.

## Run With Docker

This is the easiest way to run the whole project on a new machine.

### Requirements

- Docker Desktop
- Git

### macOS / Linux

```bash
git clone <repository-url>
cd gigshield-v2
docker compose up --build
```

Open:

```text
http://localhost:3000
```

### Windows

Open PowerShell in the folder where you want the project:

```powershell
git clone <repository-url>
cd gigshield-v2
docker compose up --build
```

Open:

```text
http://localhost:3000
```

### Optional Docker Environment

The app runs without external API keys. If you want live integrations, copy the Docker env example:

```bash
cp .env.docker.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.docker.example .env -Force
```

Then edit `.env` and add any keys you want:

```text
OPENWEATHER_API_KEY=
GROQ_API_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
```

If these are blank, the app uses demo or fallback behavior.

### Useful Docker Commands

Show running services:

```bash
docker compose ps
```

Follow logs:

```bash
docker compose logs -f
```

Follow only the backend logs:

```bash
docker compose logs -f backend
```

Stop the app:

```bash
docker compose down
```

Rebuild from scratch:

```bash
docker compose down
docker compose up --build
```

## Run Without Docker

Use this if you want to run each service directly on your machine.

### Requirements

- Node.js 18 or newer
- npm
- Python 3.10 or newer
- pip

Node 20 and Python 3.11 are good choices for this project.

## macOS / Linux Without Docker

### Option 1: Start Everything With The Script

From the project root:

```bash
chmod +x start.sh
./start.sh
```

The script starts:

- ML service on `5001`
- Backend on `4000`
- Frontend on `3000`

It also clears old processes on those ports before starting.

### Option 2: Start Services Manually

Use three terminal windows.

Terminal 1, ML service:

```bash
cd ml-service
pip3 install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5001
```

Terminal 2, backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Terminal 3, frontend:

```bash
cd frontend
npm install
BROWSER=none npm start
```

Open:

```text
http://localhost:3000
```

## Windows Without Docker

`start.sh` is a Bash script, so it does not run directly in normal Command Prompt or PowerShell.

You have two good options:

1. Use WSL and run the macOS/Linux steps.
2. Use three PowerShell terminals and start the services manually.

### Windows Option 1: WSL

Open Ubuntu/WSL:

```bash
cd /mnt/c/path/to/gigshield-v2
chmod +x start.sh
./start.sh
```

Example if the project is on your Desktop:

```bash
cd /mnt/c/Users/YOUR_NAME/Desktop/gigshield-v2
./start.sh
```

### Windows Option 2: PowerShell Manual Startup

Use three PowerShell windows.

PowerShell 1, ML service:

```powershell
cd path\to\gigshield-v2\ml-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5001
```

PowerShell 2, backend:

```powershell
cd path\to\gigshield-v2\backend
Copy-Item .env.example .env -Force
npm install
npm run dev
```

PowerShell 3, frontend:

```powershell
cd path\to\gigshield-v2\frontend
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Environment Variables

For local non-Docker backend startup, use:

```bash
cd backend
cp .env.example .env
```

On Windows PowerShell:

```powershell
cd backend
Copy-Item .env.example .env -Force
```

Important backend values:

| Variable | Purpose | Default behavior |
| --- | --- | --- |
| `PORT` | Backend port | `4000` |
| `JWT_SECRET` | Token signing secret | Demo secret if missing |
| `ML_SERVICE_URL` | ML API URL | `http://localhost:5001` |
| `FRONTEND_URL` | Allowed frontend origin | `http://localhost:3000` |
| `OPENWEATHER_API_KEY` | Live weather data | Mock weather if missing |
| `GROQ_API_KEY` | Chatbot responses | Falls back when missing |
| `SMTP_*` | Email delivery | Queues/mock status if missing |

## Using The App

### Worker Flow

1. Open `http://localhost:3000`.
2. Sign in with `9876543210` and `password123`.
3. View active coverage, zone risk, wallet balance, and recent activity.
4. Buy or update a plan from the plans section.
5. Use claims to view payouts and download proof packs.
6. Use the wallet section for demo top-up and withdrawal flows.

### Admin Flow

1. On the login page, open the insurer/admin dashboard.
2. Sign in with `admin@gigshield.in` and `admin123`.
3. Review network KPIs and zone movement.
4. Open Claims to inspect recent claims and proof packs.
5. Open Fraud Review to approve or reject suspicious claims.
6. Use the simulation controls to create disruption events and watch the dashboard update.
7. Use Plans to review or add weekly coverage products.

## ML Service

The ML service exposes:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service and model health |
| `POST` | `/premium/calculate` | Dynamic premium calculation |
| `POST` | `/fraud/score` | Fraud score for a claim |
| `POST` | `/payout/calculate` | Suggested payout amount |
| `POST` | `/forecast/weekly` | Weekly zone risk forecast |

Swagger docs:

```text
http://localhost:5001/docs
```

The backend has deterministic fallback formulas, so the core app can still run if the ML service is unavailable.

## Data Persistence

Demo data lives in:

```text
backend/data/db.json
```

When using Docker, this folder is mounted into the backend container:

```text
./backend/data:/app/data
```

That means demo users, policies, claims, wallet transactions, and admin changes can survive container rebuilds on the same machine.

To reset demo data, stop the app and replace or delete `backend/data/db.json`. The backend will seed fresh demo data on the next start.

## Troubleshooting

### Port Already In Use

macOS/Linux:

```bash
lsof -ti:3000,4000,5001 | xargs kill -9
```

Windows PowerShell:

```powershell
netstat -ano | findstr ":3000 :4000 :5001"
taskkill /PID <PID> /F
```

### Docker Desktop Is Open But Compose Cannot Connect

Make sure Docker Desktop says the engine is running, then try:

```bash
docker info
docker compose ps
```

If `docker info` cannot connect, restart Docker Desktop and run the command again from a fresh terminal.

### Frontend Starts But API Calls Fail

Check that the backend is running:

```text
http://localhost:4000/api/status
```

For local startup, also check `backend/.env`:

```text
ML_SERVICE_URL=http://localhost:5001
FRONTEND_URL=http://localhost:3000
```

### ML Service Is Offline

Check:

```text
http://localhost:5001/health
```

If it is down, restart the ML service:

```bash
cd ml-service
uvicorn main:app --host 0.0.0.0 --port 5001
```

The backend will use fallback formulas until the ML service is available.

### npm Install Fails

Delete `node_modules` in the service that failed, then install again:

```bash
rm -rf node_modules
npm install
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

## Notes For Reviewers

- This is a demo/hackathon project, not a production insurance backend.
- The JSON data store is intentionally simple.
- Payment, email, and weather integrations have demo/fallback behavior.
- Secrets should not be committed. Use `.env` locally.

## License

No license has been specified yet.
