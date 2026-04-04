#!/bin/bash

# GigShield Services Startup Script
# Automatically handles port cleanup, dependencies, and service initialization.

# Function to kill processes on specific ports
kill_port() {
  local port=$1
  local pid=$(lsof -ti:$port)
  if [ ! -z "$pid" ]; then
    echo "⚠️  Port $port in use (PID $pid). Freeing up..."
    kill -9 $pid 2>/dev/null
  fi
}

# Kill background processes when this script exits
trap "kill 0" EXIT

echo "🚀  ========== Starting GigShield Services =========="

# 0. Cleanup ports before starting
echo "🧹  Cleaning up previous sessions..."
kill_port 3000 # Frontend
kill_port 4000 # Backend
kill_port 5000 # ML Service

# 1. Start Machine Learning Service (Port 5000)
echo "→ 🔋 Starting ML Service (Python/FastAPI)..."
cd ml-service
if [ ! -d "__pycache__" ] && [ ! -d "models" ]; then
  echo "   (Installing ML dependencies first...)"
  pip3 install -r requirements.txt
fi
uvicorn main:app --port 5000 --host 0.0.0.0 > ml.log 2>&1 &
cd ..

# 2. Start Backend API (Port 4000)
echo "→ 🛡️ Starting Backend API (Node.js/Express)..."
cd backend
if [ ! -d "node_modules" ]; then
  echo "   (Installing backend dependencies first...)"
  npm install
fi
npm run dev > backend.log 2>&1 &
cd ..

# 3. Start Frontend Web App (Port 3000)
echo "→ 🖥️ Starting Frontend (React)..."
cd frontend
if [ ! -d "node_modules" ]; then
  echo "   (Installing frontend dependencies first...)"
  npm install
fi
# BROWSER=none avoids opening a browser window on the server/CLI environment
BROWSER=none npm start > frontend.log 2>&1 &

echo "✨  ==============================================="
echo "✅  GigShield is initializing."
echo "🌍  Frontend:  http://localhost:3000"
echo "🛠️  Backend:   http://localhost:4000"
echo "🧠  ML Service: http://localhost:5000"
echo ""
echo "📝  Logs are being written to *.log files."
echo "🛑  Press Ctrl+C to stop all services."
echo "================================================="

# Wait for all background processes
wait
