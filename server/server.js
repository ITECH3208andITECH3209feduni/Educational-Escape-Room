// ======================================================
// FedEscape Backend Server
// Node.js + Express + MongoDB Atlas
// ======================================================

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

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

const PORT = process.env.PORT || 5000;

// ======================================================
// Basic Express / Security Configuration
// ======================================================

app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ======================================================
// CORS Configuration
// ======================================================

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow PowerShell, Postman and other requests
      // that do not send an Origin header.
      if (!origin) {
        return callback(null, true);
      }

      // Development
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // Production
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

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

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/attempts", attemptRoutes);

// ======================================================
// Health Routes
// ======================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "FedEscape backend is running"
  });
});

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "FedEscape API is healthy",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    timestamp: new Date().toISOString()
  });
});

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

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Request blocked by CORS policy"
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

    await mongoose.connect(process.env.MONGO_URI);

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

startServer();

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

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
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