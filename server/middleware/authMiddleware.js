const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ======================================================
// Protect routes using JWT authentication
// ======================================================
const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // No token supplied
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Authentication required."
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Find the user belonging to the token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User belonging to this token no longer exists."
      });
    }

    // Block suspended/inactive accounts
    if (
      user.accountStatus &&
      user.accountStatus !== "active"
    ) {
      return res.status(403).json({
        success: false,
        message: "Your account is currently unavailable."
      });
    }

    // Attach user information to request
    req.user = {
      id: user._id,
      role: user.role,
      email: user.email
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again."
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token."
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed."
    });
  }
};

// ======================================================
// Restrict routes based on user role
//
// Example:
// router.post("/room", protect, authorize("educator"), createRoom);
// ======================================================
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to perform this action."
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize
};