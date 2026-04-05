# VoltEdge Render Deployment Guide

## Quick Start

### 1. Prerequisites

- GitHub repository with VoltEdge code
- Render account (https://render.com)
- PostgreSQL database (free tier available on Render)

### 2. Environment Setup

Create a PostgreSQL database on Render:

1. Go to Render Dashboard
2. Create New → PostgreSQL
3. Choose free tier
4. Copy the connection string (Internal Database URL)

### 3. Deploy Backend

1. Go to Render Dashboard
2. Create New → Web Service
3. Connect your GitHub repository
4. Set configurations:
   - **Name**: `voltedge-backend`
   - **Environment**: Python 3
   - **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `gunicorn "app:create_app()" --bind 0.0.0.0:$PORT --workers 2 --worker-class sync --timeout 30`
   - **Root Directory**: `backend`

5. Add Environment Variables:

   ```
   DATABASE_URL: postgresql://username:password@host/voltedge_db
   JWT_SECRET_KEY: your-secure-random-key-min-32-chars
   ANTHROPIC_API_KEY: (optional) your API key
   FRONTEND_URL: https://your-frontend-domain.onrender.com
   FLASK_ENV: production
   ```

6. Click Deploy

### 4. Database Setup

After backend deploys:

1. Note the backend URL (e.g., `https://voltedge-backend.onrender.com`)
2. DB tables are auto-created on first request to `/health`
3. Seed data (optional) can be loaded manually

### 5. Deploy Frontend

1. Go to Render Dashboard
2. Create New → Static Site
3. Connect your GitHub repository
4. Set configurations:
   - **Name**: `voltedge-frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Root Directory**: `frontend`

5. Add Environment Variables:

   ```
   VITE_API_BASE_URL: https://voltedge-backend.onrender.com/api
   ```

6. Click Deploy

## Environment Variables Reference

### Backend Requirements

| Variable            | Description              | Example                          |
| ------------------- | ------------------------ | -------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection    | `postgresql://user:pass@host/db` |
| `JWT_SECRET_KEY`    | Security key (32+ chars) | `your-super-secure-key-here`     |
| `ANTHROPIC_API_KEY` | AI features (optional)   | `sk-ant-...`                     |
| `FRONTEND_URL`      | Frontend domain          | `https://domain.onrender.com`    |
| `FLASK_ENV`         | Environment              | `production`                     |

### Frontend Requirements

| Variable            | Description     | Example                                   |
| ------------------- | --------------- | ----------------------------------------- |
| `VITE_API_BASE_URL` | Backend API URL | `https://backend-domain.onrender.com/api` |

## Testing

1. **Health Check**: `https://voltedge-backend.onrender.com/health`
2. **Login**:
   ```bash
   curl -X POST https://voltedge-backend.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"password123"}'
   ```
3. **Frontend**: Visit `https://voltedge-frontend.onrender.com`

## Troubleshooting

### Build Fails with Python Version Error

- Ensure `runtime.txt` exists at project root with `python-3.11.9`
- Check Build Command is: `pip install --upgrade pip && pip install -r requirements.txt`
- Check Start Command is: `gunicorn "app:create_app()" --bind 0.0.0.0:$PORT --workers 2 --worker-class sync --timeout 30`

### Database Connection Error

- Verify `DATABASE_URL` format and credentials
- Check database is not in sleep mode
- Try upgrading to paid tier for persistent database

### Frontend API Call Fails

- Ensure `VITE_API_BASE_URL` points to correct backend
- Check CORS settings in backend (should allow all origins)
- Verify API key and JWT token are valid

### Cold Start Delays

- Free tier services spin down after inactivity
- Consider upgrading to paid plan for production

## Production Checklist

- [ ] Random secure `JWT_SECRET_KEY` (32+ chars)
- [ ] Correct `DATABASE_URL` to production database
- [ ] `FLASK_ENV` set to `production`
- [ ] `FRONTEND_URL` matches frontend domain
- [ ] `VITE_API_BASE_URL` matches backend domain
- [ ] Database tables initialized (check `/health` endpoint)
- [ ] Test login with admin credentials
- [ ] Test API endpoints with various roles

## Monitoring

Use Render Dashboard to:

- View real-time logs: `Logs` tab
- Monitor resource usage: `Usage` tab
- Configure auto-deploy on push: `Settings` → `Auto-Deploy`
- Set up email alerts: Account settings

## Security Tips

1. Use a strong, random `JWT_SECRET_KEY`
2. Keep `ANTHROPIC_API_KEY` secret
3. Use environment variables, never hardcode secrets
4. Regularly rotate tokens in production
5. Enable HTTPS everywhere

## Support

For issues:

1. Check [Render Docs](https://render.com/docs)
2. Review logs in Render Dashboard
3. Verify `.env` file format
4. Check GitHub Actions for CI/CD logs
