# BFP — Business Flow Pro

A modern multi-tenant SaaS Business Automation platform built with React + Vite, Express 5, PostgreSQL (Drizzle ORM), and JWT authentication.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, shadcn/ui, React Query |
| Backend | Express 5, Node.js 22 |
| Database | PostgreSQL 16, Drizzle ORM |
| Auth | JWT (access 15m / refresh 7d) |
| Package Manager | pnpm (workspace monorepo) |
| Container | Docker + Nginx |

---

## Project Structure

```
bfp/
├── artifacts/
│   ├── api-server/          # Express 5 backend
│   │   └── src/
│   │       ├── index.ts     # Entry point
│   │       ├── app.ts       # Express app
│   │       └── routes/      # API routes
│   └── business-automation/ # React + Vite frontend
│       └── src/
│           ├── pages/       # All page components
│           ├── components/  # Shared components
│           └── lib/         # API client, utils
├── lib/
│   ├── db/                  # Drizzle ORM schema + migrations
│   ├── api-zod/             # Zod validation schemas
│   └── api-client-react/    # Generated React Query hooks
├── nginx/
│   └── nginx.conf           # Production Nginx config
├── scripts/
│   ├── build-production.sh  # Production build script
│   ├── db-setup.sh          # DB schema + seed script
│   └── src/seed.ts          # Demo data seeder
├── docker-compose.yml       # Development Docker
├── docker-compose.prod.yml  # Production Docker
├── Dockerfile               # Multi-stage production build
├── .env.example             # Environment variable template
└── README.md
```

---

## Requirements

- **Node.js** 22+
- **pnpm** 9+ (`npm install -g pnpm`)
- **PostgreSQL** 16+
- **Docker** (optional but recommended for production)

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/bfp.git
cd bfp
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL` — your PostgreSQL connection string
- `JWT_SECRET` — run `openssl rand -base64 64` to generate
- `REFRESH_SECRET` — run `openssl rand -base64 64` again

### 4. Set up the database

```bash
# Push schema
pnpm --filter @workspace/db run push

# Seed demo data
pnpm --filter @workspace/scripts run seed
```

### 5. Start development servers

Open two terminals:

```bash
# Terminal 1 — API server (port 8080)
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 3000)
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/business-automation run dev
```

Visit `http://localhost:3000`

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@demo.com | password |
| Org Admin | orgadmin@demo.com | password |
| Dept Head | depthead@demo.com | password |
| Employee | employee@demo.com | password |

---

## Production Build

### Option A — Docker (Recommended)

```bash
# 1. Copy and configure environment
cp .env.example .env
nano .env   # fill in your values

# 2. Build and start with Docker Compose
docker compose -f docker-compose.prod.yml up -d --build

# 3. Set up database (first time only)
docker exec bizauto-api node -e "require('./server.cjs')"
# OR run db-setup.sh before building
```

The app will be available at `http://YOUR_SERVER_IP`

---

### Option B — Manual VPS / Hostinger Deployment

#### Step 1 — Install Node.js 22 on your server

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should be v22.x.x

# Install pnpm
npm install -g pnpm
```

#### Step 2 — Install PostgreSQL

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER bfp_user WITH PASSWORD 'your_strong_password';
CREATE DATABASE bfp OWNER bfp_user;
GRANT ALL PRIVILEGES ON DATABASE bfp TO bfp_user;
EOF
```

#### Step 3 — Upload and build the project

```bash
# On your server
git clone https://github.com/YOUR_USERNAME/bfp.git /var/www/bfp
cd /var/www/bfp

# Configure environment
cp .env.example .env
nano .env   # fill in DATABASE_URL, JWT_SECRET, REFRESH_SECRET, CORS_ORIGIN

# Build
chmod +x scripts/build-production.sh
bash scripts/build-production.sh

# Set up database
bash scripts/db-setup.sh
```

#### Step 4 — Install PM2 and start the server

```bash
npm install -g pm2

# Start the API server
pm2 start artifacts/api-server/dist/index.cjs --name bfp-api \
  --env production

# Save PM2 process list
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

#### Step 5 — Install and configure Nginx

```bash
sudo apt install nginx -y

# Copy the included Nginx config
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built frontend files
sudo mkdir -p /usr/share/nginx/html
sudo cp -r artifacts/business-automation/dist/public/. /usr/share/nginx/html/

# Edit nginx.conf: replace 'server api:8080' with 'server 127.0.0.1:8080'
sudo nano /etc/nginx/nginx.conf

sudo nginx -t         # test config
sudo systemctl restart nginx
sudo systemctl enable nginx
```

#### Step 6 — SSL with Let's Encrypt (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo systemctl reload nginx
```

---

### Option C — GitHub Actions CI/CD

A GitHub Actions workflow file is pre-configured at `.github/`. To activate:

1. Add these **GitHub Secrets** to your repository:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `REFRESH_SECRET`
   - `SSH_HOST` — your server IP
   - `SSH_USER` — e.g. `root`
   - `SSH_KEY` — your private SSH key

2. Push to `main` branch — the pipeline will build and deploy automatically.

---

## Hostinger Specific Instructions

If using **Hostinger VPS** (Ubuntu):

```bash
# 1. SSH into your VPS
ssh root@YOUR_VPS_IP

# 2. Update system
apt update && apt upgrade -y

# 3. Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pnpm pm2

# 4. Install PostgreSQL
apt install -y postgresql postgresql-contrib
sudo -u postgres createuser --superuser bfp_user
sudo -u postgres createdb bfp -O bfp_user
sudo -u postgres psql -c "ALTER USER bfp_user WITH PASSWORD 'your_password';"

# 5. Clone and build
git clone https://github.com/YOUR_USERNAME/bfp.git /var/www/bfp
cd /var/www/bfp
cp .env.example .env
nano .env   # set DATABASE_URL=postgresql://bfp_user:your_password@localhost:5432/bfp
bash scripts/build-production.sh
bash scripts/db-setup.sh

# 6. Start server
pm2 start artifacts/api-server/dist/index.cjs --name bfp-api
pm2 save && pm2 startup

# 7. Configure Nginx
apt install -y nginx
cp nginx/nginx.conf /etc/nginx/nginx.conf
# Edit: change 'server api:8080' to 'server 127.0.0.1:8080'
sed -i 's/server api:8080/server 127.0.0.1:8080/' /etc/nginx/nginx.conf
cp -r artifacts/business-automation/dist/public/. /usr/share/nginx/html/
nginx -t && systemctl restart nginx && systemctl enable nginx

# 8. SSL
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | Server port (default: 8080) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (64+ chars) |
| `REFRESH_SECRET` | Yes | Refresh token secret (64+ chars) |
| `JWT_EXPIRY` | No | Access token TTL (default: 15m) |
| `REFRESH_EXPIRY` | No | Refresh token TTL (default: 7d) |
| `CORS_ORIGIN` | Yes | Your frontend URL |
| `APP_URL` | Yes | Your app URL |
| `BASE_PATH` | Build only | URL base path (default: /) |
| `VITE_API_BASE_URL` | Build only | API base URL for frontend |
| `AWS_ACCESS_KEY_ID` | Optional | For S3 file uploads |
| `AWS_SECRET_ACCESS_KEY` | Optional | For S3 file uploads |
| `S3_BUCKET_NAME` | Optional | S3 bucket name |

---

## Database Commands

```bash
# Push schema changes to database
pnpm --filter @workspace/db run push

# Generate migrations (optional)
pnpm --filter @workspace/db run generate

# Run seed (demo data)
pnpm --filter @workspace/scripts run seed
```

---

## Production Deployment Checklist

- [ ] `.env` configured with real secrets (not example values)
- [ ] `JWT_SECRET` and `REFRESH_SECRET` are 64+ character random strings
- [ ] `DATABASE_URL` points to your production PostgreSQL
- [ ] `CORS_ORIGIN` matches your exact frontend URL (no trailing slash)
- [ ] Database schema pushed: `pnpm --filter @workspace/db run push`
- [ ] Production build complete: `bash scripts/build-production.sh`
- [ ] PM2 or Docker running the API server
- [ ] Nginx serving the frontend and proxying `/api/` to backend
- [ ] HTTPS (SSL) configured
- [ ] Firewall: only ports 80, 443, and 22 open
- [ ] PostgreSQL not exposed to the public internet

---

## Support

For issues, open a GitHub Issue on the repository.
