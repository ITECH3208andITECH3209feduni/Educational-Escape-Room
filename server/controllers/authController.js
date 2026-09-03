const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

// ======================================================
// Generate JWT
// ======================================================
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    }
  );
};

// ======================================================
// REGISTER
// POST /api/auth/register
// ======================================================
const registerUser = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    // Required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters"
      });
    }

    // Prevent invalid roles
    const allowedRegistrationRoles = ["student", "educator"];

    if (role && !allowedRegistrationRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account role"
      });
    }

    // Check existing account
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create account
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "student"
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        educatorVerified: user.educatorVerified,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating account"
    });
  }
};

// ======================================================
// LOGIN
// POST /api/auth/login
// ======================================================
const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    email = email.trim().toLowerCase();

    // Password is select:false in User.js,
    // therefore explicitly request it here.
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check account status
    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is currently unavailable"
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Record login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        educatorVerified: user.educatorVerified,
        accountStatus: user.accountStatus,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during login"
    });
  }
};

// ======================================================
// GET CURRENT USER
// GET /api/auth/me
// Protected route
// ======================================================
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while retrieving user"
    });
  }
};

// ======================================================
// UPDATE PROFILE
// PATCH /api/auth/profile
// Protected route
// ======================================================
const updateProfile = async (req, res) => {
  try {
    const { name, preferences } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (name) {
      user.name = name.trim();
    }

    if (preferences) {
      if (preferences.theme !== undefined) {
        user.preferences.theme = preferences.theme;
      }

      if (preferences.soundEnabled !== undefined) {
        user.preferences.soundEnabled = preferences.soundEnabled;
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating profile"
    });
  }
};

// ======================================================
// CHANGE PASSWORD
// PATCH /api/auth/change-password
// Protected route
// ======================================================
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must contain at least 6 characters"
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while changing password"
    });
  }
};

// ======================================================
// REQUEST PASSWORD RESET
// POST /api/auth/forgot-password
// ======================================================
const forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });

    // Do not reveal whether an email exists.
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists for that email, password reset instructions will be sent."
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store a hash rather than the raw reset token
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.passwordResetExpires =
      Date.now() + 15 * 60 * 1000;

    await user.save();

    /*
      Later, an email service can send resetToken to the user.

      IMPORTANT:
      Do not return resetToken in production.
    */

    return res.status(200).json({
      success: true,
      message:
        "If an account exists for that email, password reset instructions will be sent."
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while processing password reset"
    });
  }
};

// ======================================================
// RESET PASSWORD
// POST /api/auth/reset-password/:token
// ======================================================
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters"
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select(
      "+password +passwordResetToken +passwordResetExpires"
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Password reset token is invalid or has expired"
      });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(password, salt);

    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while resetting password"
    });
  }
};

// ======================================================
// LOGOUT
// POST /api/auth/logout
// ======================================================
const logoutUser = async (req, res) => {
  /*
    JWT authentication is stateless.

    The frontend will remove its stored token when the
    user logs out. Token revocation could be added later
    if the project requires it.
  */

  return res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logoutUser
};