# VoltEdge Commerce

VoltEdge Commerce is an omnichannel inventory and sales platform with a Flask backend and React/Tailwind frontend.

## Structure

- `backend/` - Flask API, SQLAlchemy models, and route blueprints.
- `frontend/` - Vite-powered React application with Tailwind CSS.
- `docker-compose.yml` - Local development stack with PostgreSQL, backend, and frontend containers.
- `Dockerfile.backend` - Backend container definition.
- `Dockerfile.frontend` - Frontend container definition.

## Getting Started

### Local Development

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd voltedge
   ```

2. Copy environment file:

   ```bash
   cp backend/.env.example backend/.env
   ```

3. Update `backend/.env` with your configuration:
   - Set a secure `JWT_SECRET_KEY` (minimum 32 characters)
   - Add your `ANTHROPIC_API_KEY` if you want AI features
   - Update database credentials if needed

4. Run with Docker:

   ```bash
   docker-compose up --build
   ```

5. Visit:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000/health`

### Production Deployment

#### Option 1: Docker Compose (Recommended)

1. Set up your production environment variables in `backend/.env`
2. Update `docker-compose.yml` for production settings (ports, environment)
3. Run:
   ```bash
   docker-compose -f docker-compose.yml up -d --build
   ```

#### Option 2: Manual Deployment

**Backend:**

```bash
cd backend
pip install -r requirements.txt
export FLASK_APP=app.py
export FLASK_ENV=production
flask run --host=0.0.0.0 --port=5000
```

**Frontend:**

```bash
cd frontend
npm install
npm run build
# Serve the dist/ folder with nginx/apache
```

## Environment Variables

| Variable            | Description                       | Required |
| ------------------- | --------------------------------- | -------- |
| `DATABASE_URL`      | PostgreSQL connection string      | Yes      |
| `JWT_SECRET_KEY`    | JWT signing key (min 32 chars)    | Yes      |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features | No       |
| `FRONTEND_URL`      | Frontend URL for CORS             | Yes      |

## Features

- Multi-role user management (Admin, Manager, Supervisor, Associate)
- Inventory management with stock alerts
- Sales tracking and reporting
- AI-powered insights and recommendations
- Transfer management between locations
- Customer management
- POS integration

## API Documentation

Base URL: `http://localhost:5000/api`

### Authentication

- `POST /api/auth/login` - User login

### Protected Endpoints

- `GET /api/inventory` - Inventory management
- `GET /api/reports/sales-summary` - Sales reports
- `POST /api/ai/query` - AI assistant queries
- And more...

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
