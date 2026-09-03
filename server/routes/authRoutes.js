const express = require("express");
const router = express.Router();

const {
  registerUser,
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
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Request password reset
router.post("/forgot-password", forgotPassword);

// Reset password using token
router.post("/reset-password/:token", resetPassword);

// ======================================================
// PROTECTED AUTHENTICATION ROUTES
// Valid JWT required
// ======================================================

// Get currently logged-in user
router.get("/me", protect, getCurrentUser);

// Update profile
router.patch("/profile", protect, updateProfile);

// Change password
router.patch(
  "/change-password",
  protect,
  changePassword
);

// Logout
router.post("/logout", protect, logoutUser);

// ======================================================
// JWT TEST ROUTE
// ======================================================

router.get("/protected-test", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "JWT authentication is working correctly.",
    user: req.user
  });
});

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;