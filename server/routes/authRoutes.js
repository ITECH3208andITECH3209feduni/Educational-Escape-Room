const express = require("express");
const router = express.Router();
const { csrfToken } = require("../middleware/session");
const { rateLimit } = require("../middleware/rateLimit");
router.get("/csrf", rateLimit("csrf", { ip: 100 }), csrfToken);

const {
  registerUser,
   verifyEmail,
  loginUser,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logoutUser
} = require("../controllers/authController");

const {
  protect
} = require("../middleware/authMiddleware");

// ======================================================
// PUBLIC AUTHENTICATION ROUTES
// ======================================================

// Register new account
router.post("/register", rateLimit("register", { ip: 10, account: 3, windowMs: 60 * 60 * 1000 }), registerUser);

// Verify email address
router.get("/verify-email/:token", rateLimit("verify-email"), verifyEmail);

// Login
router.post("/login", rateLimit("login", { ip: 60, account: 15 }), loginUser);

// Request password reset
router.post("/forgot-password", rateLimit("forgot-password", { ip: 10, account: 3 }), forgotPassword);

// Reset password using token
router.post("/reset-password/:token", rateLimit("reset-password", { ip: 10, account: 5 }), resetPassword);

// ======================================================
// PROTECTED AUTHENTICATION ROUTES
// Valid session required
// ======================================================

// Get currently logged-in user
router.get("/me", protect, getCurrentUser);

// Update profile
router.patch("/profile", protect, updateProfile);

// Change password
router.patch(
  "/change-password",
  protect,
  rateLimit("change-password", { ip: 10 }),
  changePassword
);

// Logout
router.post("/logout", logoutUser);

// ======================================================
// session TEST ROUTE
// ======================================================

router.get("/protected-test", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "session authentication is working correctly.",
    user: req.user
  });
});

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;