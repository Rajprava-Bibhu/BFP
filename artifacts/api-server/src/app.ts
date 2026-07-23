import path from "path";
import { fileURLToPath } from "url";
import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import router from "./routes";
import path from 'path';


//const __filename = fileURLToPath(import.meta.url);
//const __dirname  = path.dirname(__filename);

const __filename = typeof import.meta !== 'undefined' && import.meta.url 
  ? fileURLToPath(import.meta.url) 
  : '';
const __dirname = __filename ? path.dirname(__filename) : process.cwd();

const app: Express = express();

// ── CORS ──────────────────────────────────────────────────────────────────
const CORS_ORIGIN = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: CORS_ORIGIN
      ? CORS_ORIGIN.split(",").map(o => o.trim())
      : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ── Health check (used by ECS, Docker, load balancer) ────────────────────
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status:    "ok",
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    env:       process.env.NODE_ENV ?? "development",
  });
});

// ── API routes ────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Static frontend (production only) ────────────────────────────────────
// In production the Dockerfile copies the Vite build output to /app/public
if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(__dirname, "..", "public");

  app.use(
    express.static(publicDir, {
      maxAge: "1y",
      immutable: true,
      index: false,
    })
  );

  // SPA catch-all — serve index.html for any non-API route
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, "index.html"), {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  });
}

export default app;
