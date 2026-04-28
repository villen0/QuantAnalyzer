#!/bin/bash
# Start QuantAnalyzer — backend + frontend dev server

echo "Starting QuantAnalyzer..."

# Start backend
cd backend
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs)
fi
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait and clean up
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
