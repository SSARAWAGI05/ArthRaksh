# ArthRaksh

ArthRaksh is a full-stack platform for gig worker risk protection. Workers can buy weekly protection plans, track wallet activity, view claims, and download proof packs. Admin users can monitor claims across the network, review fraud signals, simulate disruption events, and manage insurance plans.

The application is split into three services:

1. React frontend
2. Node.js/Express backend
3. Python/FastAPI ML service

The backend uses a JSON data store for local development and hackathon review, so the project can be started without setting up a separate database.

## 1. Features

1. Worker authentication and worker dashboard
2. Admin portal for network-level monitoring
3. Weekly protection plan purchase flow
4. Dynamic premium calculation
5. Claims history, proof-pack download, and payout status
6. Wallet top-up, withdrawal, and transaction tracking
7. Fraud review queue for admin users
8. Disruption simulation for rain, AQI, heat, flood, cyclone, curfew, and fog
9. ML service for premium, fraud, payout, and forecast endpoints

## 2. Tech Stack

| Part | Technology |
| --- | --- |
| Frontend | React 18, Axios, Chart.js, Recharts |
| Backend | Node.js, Express, JWT |
| ML service | Python, FastAPI, Uvicorn, scikit-learn, pandas |
| Local data store | `backend/data/db.json` |
| Container setup | Docker Compose |

## 3. Repository

```bash
git clone https://github.com/SSARAWAGI05/ArthRaksh
cd ArthRaksh
```

Project layout:

```text
ArthRaksh/
  backend/          Express API
  frontend/         React frontend
  ml-service/       FastAPI ML service
  docker-compose.yml
  start.sh          macOS/Linux/WSL startup script
```

## 4. Ports Used

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| Backend | `http://localhost:4000` |
| Backend status | `http://localhost:4000/api/status` |
| ML service | `http://localhost:5001` |
| ML docs | `http://localhost:5001/docs` |

Make sure ports `3000`, `4000`, and `5001` are free before starting the project.

## 5. Environment File

For a normal local run without Docker, create `backend/.env` from the example file:

### 5.1 macOS / Linux / WSL

```bash
cd backend
cp .env.example .env
cd ..
```

### 5.2 Windows PowerShell

```powershell
cd backend
Copy-Item .env.example .env -Force
cd ..
```

Keep these values in `backend/.env`:

```env
PORT=4000
JWT_SECRET=arthraksh-secret-change-in-production
ML_SERVICE_URL=http://localhost:5001
FRONTEND_URL=http://localhost:3000
```

Add the integration keys in the same `backend/.env` file when you want those features enabled:

```env
# Required for the AI assistant/chatbot
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Required only for live weather data
OPENWEATHER_API_KEY=

# Required only for real email delivery
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="ArthRaksh Alerts <alerts@example.com>"
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
```

For Docker, put the same values in a root `.env` file:

### 5.3 Docker env file

macOS / Linux / WSL:

```bash
cp .env.docker.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.docker.example .env -Force
```

Real `.env` files are intentionally ignored by Git because they contain private API keys. Commit the example files, but do not commit your personal `.env` values to GitHub.

## 6. Run With Docker

This is the recommended way to run the full project on any machine with Docker Desktop.

### 6.1 macOS

1. Install and open Docker Desktop.
2. Clone the repository:

```bash
git clone https://github.com/SSARAWAGI05/ArthRaksh
cd ArthRaksh
```

3. Start the project:

```bash
docker compose up --build
```

4. Open the frontend:

```text
http://localhost:3000
```

### 6.2 Windows

1. Install and open Docker Desktop.
2. Open PowerShell.
3. Clone the repository:

```powershell
git clone https://github.com/SSARAWAGI05/ArthRaksh
cd ArthRaksh
```

4. Start the project:

```powershell
docker compose up --build
```

5. Open the frontend:

```text
http://localhost:3000
```

## 7. Run Without Docker

Use this method if you want to run the services directly on your machine.

### 7.1 Requirements

Install:

1. Node.js 18 or newer
2. npm
3. Python 3.10 or newer
4. pip

Node 20 and Python 3.11 are recommended.

### 7.2 macOS / Linux

1. Clone the repository:

```bash
git clone https://github.com/SSARAWAGI05/ArthRaksh
cd ArthRaksh
```

2. Create the backend `.env` file:

```bash
cd backend
cp .env.example .env
cd ..
```

3. Start all services:

```bash
chmod +x start.sh
./start.sh
```

4. Open:

```text
http://localhost:3000
```

### 7.3 Windows Without Docker

On Windows, `start.sh` should be run through WSL. If you are not using WSL, start the three services manually.

#### 7.3.1 Windows With WSL

1. Open Ubuntu/WSL.
2. Clone the repository:

```bash
git clone https://github.com/SSARAWAGI05/ArthRaksh
cd ArthRaksh
```

3. Create the backend `.env` file:

```bash
cd backend
cp .env.example .env
cd ..
```

4. Start the project:

```bash
chmod +x start.sh
./start.sh
```

5. Open in your browser:

```text
http://localhost:3000
```

#### 7.3.2 Windows PowerShell Manual Startup

1. Clone the repository:

```powershell
git clone https://github.com/SSARAWAGI05/ArthRaksh
cd ArthRaksh
```

2. Create the backend `.env` file:

```powershell
cd backend
Copy-Item .env.example .env -Force
cd ..
```

3. Open three PowerShell windows.

In PowerShell window 1, start the ML service:

```powershell
cd path\to\ArthRaksh\ml-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5001
```

In PowerShell window 2, start the backend:

```powershell
cd path\to\ArthRaksh\backend
npm install
npm run dev
```

In PowerShell window 3, start the frontend:

```powershell
cd path\to\ArthRaksh\frontend
npm install
npm start
```

4. Open:

```text
http://localhost:3000
```

## 8. Login Details

### 8.1 Worker Login

Use the seeded worker account:

```text
Phone: 9876543210
Password: password123
```

### 8.2 Admin Portal Login

Open the admin/insurer portal from the login page and sign in with:

```text
Email: admin@gigshield.in
Password: admin123
```

## 9. Using The Project

### 9.1 Worker Side

1. Open `http://localhost:3000`.
2. Log in with the worker credentials.
3. View protection status, wallet balance, zone risk, and recent activity.
4. Buy or manage a weekly protection plan.
5. Open Claims to view claim status and download proof packs.
6. Open Wallet to view top-ups, withdrawals, and transactions.

### 9.2 Admin Side

1. Open the admin/insurer portal from the login page.
2. Log in with the admin credentials.
3. Review network metrics and zone activity.
4. Open Claims to inspect claim records.
5. Open Fraud Review to approve or reject flagged claims.
6. Use the disruption simulator to create network events.
7. Open Plans to review or add protection plans.

## 10. ML Service

The ML service runs on port `5001`.

Main endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health |
| `POST` | `/premium/calculate` | Premium calculation |
| `POST` | `/fraud/score` | Fraud scoring |
| `POST` | `/payout/calculate` | Payout calculation |
| `POST` | `/forecast/weekly` | Weekly risk forecast |

Swagger UI:

```text
http://localhost:5001/docs
```

## 11. Data Storage

Application data is stored in:

```text
backend/data/db.json
```

This file contains seeded users, policies, claims, wallet transactions, admin data, and generated events.

When running with Docker, `backend/data` is mounted into the backend container so data remains available after rebuilding containers.
