#!/bin/bash
echo "=== НПЗ Материальный Баланс ==="

# Backend
cd backend
pip install -r ../requirements.txt -q
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACK_PID=$!
echo "Backend: http://localhost:8000/docs (PID $BACK_PID)"

# Frontend
cd ../frontend
npm install --silent
npm run dev &
FRONT_PID=$!
echo "Frontend: http://localhost:5173 (PID $FRONT_PID)"

echo ""
echo "Ctrl+C для остановки"
trap "kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT
wait
