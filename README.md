# 🚛 Supply Chain Control Tower (ML-Driven)

A predictive logistics dashboard that uses Gradient Boosting models to transition from reactive event-based delays to proactive, model-driven predictive analytics.

## 🚀 Overview
This system monitors a logistics fleet in real-time. Unlike traditional trackers that only report delays *after* a storm hits, this tower uses machine learning to predict ETAs, delay probabilities, and early arrival chances based on historical patterns, route data, and live conditions.

### Key Features
- **Model-Driven Analytics**: Uses `GradientBoostingRegressor` for high-precision ETA and delay magnitude prediction.
- **Continuous Learning Loop**: Simulation data is reported back to the ML service to refine models every 10 deliveries.
- **Interactive Live Map**: Real-time truck movement, informational event zones, and route visualization.
- **Deep Analytics**: Scatter plots (Distance vs ETA), outcome distribution pie charts, and route-specific deep dives.
- **Early Delivery Detection**: Proactively identifies shipments likely to arrive ahead of schedule.

---

## 🛠 Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Leaflet (Maps), Recharts, Lucide Icons.
- **Backend**: Node.js, Express, Socket.io (Live updates), Prisma.
- **ML Service**: Python, FastAPI, Scikit-learn, Pandas, Joblib.

---

## 🏃‍♂️ How to Run Locally

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (3.9+)
- [PostgreSQL](https://www.postgresql.org/) (running locally or a connection string)

### 2. Setup Machine Learning Service (Python)
```bash
cd ml-service
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
*The ML service runs on `http://localhost:8000`.*

### 3. Setup Backend (Node.js)
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` folder:
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/supply_chain"
```
Initialize the database:
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```
*The backend runs on `http://localhost:3001`.*

### 4. Setup Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
*The dashboard will be available at `http://localhost:5173`.*

---

## 📊 ML Architecture
The system employs three separate Gradient Boosting models:
1. **ETA Model**: Predicts total transit time in hours.
2. **Delay Probability**: Classifies the likelihood of a significant delay (>30 min).
3. **Delay Hours Magnitude**: Predicts the specific variance (actual vs ideal) to detect early vs late arrivals.

---

## 📂 Project Structure
- `/frontend`: React dashboard and visualization components.
- `/backend`: Node.js simulation engine and shipment management.
- `/ml-service`: Python FastAPI service for pathfinding and ML inference.
- `historical_shipments.csv`: The training dataset generated and refined by the system.

---

## 📜 License
MIT
