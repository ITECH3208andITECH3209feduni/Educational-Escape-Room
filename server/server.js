// ======================================================
// FedEscape Backend Server
// Node.js + Express + MongoDB Atlas
// ======================================================

const express = require("express");
const database = require("./db/database");
const { loadSession, csrfProtection, ensureSecurityIndexes } = require("./middleware/session");
const securityHeaders = require("./middleware/securityHeaders");
const resetQueue = require("./utils/passwordResetQueue");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// ======================================================
// Import Routes
// ======================================================

const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const attemptRoutes = require("./routes/attemptRoutes");

// ======================================================
// Create Express Application
// ======================================================

const app = express();
const web = express.Router();
const basePath = (process.env.APP_BASE_PATH || "").replace(/\/+$/, "");
if (basePath && !/^\/[a-zA-Z0-9/_-]+$/.test(basePath)) {
  throw new Error("APP_BASE_PATH must be a URL path such as /FEDEscape");
}
const clientDirectory = path.resolve(__dirname, "../client");

const PORT = process.env.PORT || 5000;

// ======================================================
// Basic Express / Security Configuration
// ======================================================

app.disable("x-powered-by");

// Trust only the actual proxy addresses, never a client-supplied hop count.
// Default false is safe for direct/local connections. Evan must set the real proxy CIDR.
app.set("trust proxy", process.env.TRUST_PROXY ? process.env.TRUST_PROXY.split(",").map(s => s.trim()) : false);
app.use(securityHeaders);
// Serve frontend and API from one origin; cross-origin credentialed access is not enabled.
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const configured = process.env.CLIENT_URL || `http://localhost:${PORT}`;
    const allowed = new Set([new URL(configured).origin]);
    if (process.env.NODE_ENV !== "production") {
      allowed.add(`http://localhost:${PORT}`);
      allowed.add(`http://127.0.0.1:${PORT}`);
    }
    if (req.get("Sec-Fetch-Site") === "cross-site" || (req.get("Origin") && !allowed.has(req.get("Origin")))) {
      return res.status(403).json({ success: false, message: "Cross-origin request blocked." });
    }
  }
  next();
});

// ======================================================
// Request Body Middleware
// ======================================================

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);

// ======================================================
// API Routes
// ======================================================

web.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); }, loadSession, csrfProtection);
web.use("/api/auth", authRoutes);
web.use("/api/rooms", roomRoutes);
web.use("/api/attempts", attemptRoutes);

// ======================================================
// Health Routes
// ======================================================

web.get("/api/health", async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "FedEscape API is healthy",
    database:
      await database.health()
        ? "connected"
        : "disconnected",
    timestamp: new Date().toISOString()
  });
});

// Serve only frontend files; never expose the server directory or .env.
web.get(["/js/config.js", "/client/js/config.js"], (req, res) => {
  res.set("Cache-Control", "no-store");
  res.type("application/javascript").send(
    "window.FEDEscapeConfig = Object.freeze(" + JSON.stringify({
      apiBaseUrl: `${basePath}/api`,
      appBaseUrl: `${basePath}/`
    }) + ");"
  );
});
web.use("/api", (req, res) => res.status(404).json({ success: false, message: "API route not found" }));
const staticOptions = { dotfiles: "deny", index: "index.html" };
web.use(express.static(clientDirectory, staticOptions));
// Keep existing /client links working while the new homepage is at the base URL.
web.use("/client", express.static(clientDirectory, staticOptions));
app.use(basePath || "/", web);

// ======================================================
// 404 Handler
// ======================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

// ======================================================
// Global Error Handler
// ======================================================

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request"
    });
  }


  return res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error"
  });
});

// ======================================================
// MongoDB Connection
// ======================================================

const connectDatabase = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing from the environment configuration"
      );
    }

    await database.connect(process.env.MONGO_URI);
    for (const name of ["User", "Room", "Attempt"]) {
      await require(`./models/${name}`).ensureIndexes();
    }

    await ensureSecurityIndexes();
    await resetQueue.ensureIndexes();
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  }
};

// ======================================================
// Start Server
// ======================================================

let server;

const startServer = async () => {
  try {
    await connectDatabase();
    resetQueue.start();

    server = app.listen(PORT, () => {
      console.log("======================================");
      console.log("FedEscape Backend");
      console.log(`Server running on port ${PORT}`);
      console.log(`http://localhost:${PORT}`);
      console.log(
        `Environment: ${process.env.NODE_ENV || "development"}`
      );
      console.log("======================================");
    });
  } catch (error) {
    console.error(
      "Failed to start FedEscape server:",
      error.message
    );

    process.exit(1);
  }
};

if (require.main === module) startServer();

// ======================================================
// Graceful Shutdown
// ======================================================

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `\n${signal} received. Shutting down FedEscape...`
  );

  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }

    {
      await resetQueue.stop();
      await database.close();
      console.log("MongoDB connection closed");
    }

    console.log("FedEscape server stopped");
    process.exit(0);
  } catch (error) {
    console.error(
      "Shutdown error:",
      error.message
    );

    process.exit(1);
  }
};

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

// ======================================================
// Unexpected Errors
// ======================================================

process.on("unhandledRejection", (error) => {
  console.error(
    "Unhandled Promise Rejection:",
    error
  );
});

process.on("uncaughtException", (error) => {
  console.error(
    "Uncaught Exception:",
    error
  );

  process.exit(1);
});

// ======================================================
// Export App
// ======================================================

module.exports = app;