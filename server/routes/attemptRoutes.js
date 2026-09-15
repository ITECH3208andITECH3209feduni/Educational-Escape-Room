// ======================================================
// FedEscape Attempt Routes
// Handles student attempts, answers, results,
// educator reporting and leaderboards
// ======================================================

const express = require("express");

const {
  startAttempt,
  getAttempt,
  submitAnswer,
  completeAttempt,
  abandonAttempt,
  getMyResults,
  getRoomResults,
  getLeaderboard
} = require("../controllers/attemptController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

const router = express.Router();

// ======================================================
// STUDENT ROUTES
// ======================================================

// Get logged-in student's results
// GET /api/attempts/my-results
router.get(
  "/my-results",
  protect,
  authorize("student"),
  getMyResults
);

// Start or resume an escape room attempt
// POST /api/attempts/start/:roomId
router.post(
  "/start/:roomId",
  protect,
  authorize("student"),
  startAttempt
);

// Submit an answer
// PATCH /api/attempts/:attemptId/answer
router.patch(
  "/:attemptId/answer",
  protect,
  authorize("student"),
  submitAnswer
);

// Complete an attempt
// PATCH /api/attempts/:attemptId/complete
router.patch(
  "/:attemptId/complete",
  protect,
  authorize("student"),
  completeAttempt
);

// Abandon an attempt
// PATCH /api/attempts/:attemptId/abandon
router.patch(
  "/:attemptId/abandon",
  protect,
  authorize("student"),
  abandonAttempt
);

// ======================================================
// EDUCATOR RESULTS
// ======================================================

// Get results for an educator's room
// GET /api/attempts/room/:roomId/results
router.get(
  "/room/:roomId/results",
  protect,
  authorize("educator", "admin"),
  getRoomResults
);

// ======================================================
// LEADERBOARD
// ======================================================

// Get leaderboard for a room
// GET /api/attempts/room/:roomId/leaderboard
router.get(
  "/room/:roomId/leaderboard",
  protect,
  getLeaderboard
);

// ======================================================
// GET SINGLE ATTEMPT
// Keep this AFTER the more specific routes above.
// ======================================================

// GET /api/attempts/:attemptId
router.get(
  "/:attemptId",
  protect,
  getAttempt
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;