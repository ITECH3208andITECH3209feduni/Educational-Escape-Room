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

// Future routes will be added here:
// const roomRoutes = require("./routes/roomRoutes");
// const questionRoutes = require("./routes/questionRoutes");
// const progressRoutes = require("./routes/progressRoutes");

// ======================================================
// Create Express Application
// ======================================================

const app = express();

const PORT = process.env.PORT || 5000;

// ======================================================
// Middleware
// ======================================================

// Allow frontend to communicate with backend
app.use(cors());

// Allow Express to read JSON request bodies
app.use(express.json());

// Allow URL encoded form data
app.use(
  express.urlencoded({
    extended: true
  })
);

// ======================================================
// API Routes
// ======================================================

// Authentication
app.use("/api/auth", authRoutes);

// Future API routes:
// app.use("/api/rooms", roomRoutes);
// app.use("/api/questions", questionRoutes);
// app.use("/api/progress", progressRoutes);

// ======================================================
// Backend Health / Test Route
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FedEscape backend is running"
  });
});

// API health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FedEscape API is healthy",
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// Handle Unknown Routes
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

// ======================================================
// Global Error Handler
// ======================================================

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error"
  });
});

// ======================================================
// Connect to MongoDB Atlas
// ======================================================

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    // Start server only after database connection succeeds
    app.listen(PORT, () => {
      console.log(`FedEscape server running on port ${PORT}`);
      console.log(`http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  }
};

// ======================================================
// Start Application
// ======================================================

connectDatabase();

// ======================================================
// Handle Unexpected Errors
// ======================================================

process.on("unhandledRejection", (error) => {
  console.error(
    "Unhandled Promise Rejection:",
    error.message
  );
});

process.on("uncaughtException", (error) => {
  console.error(
    "Uncaught Exception:",
    error.message
  );

  process.exit(1);
});