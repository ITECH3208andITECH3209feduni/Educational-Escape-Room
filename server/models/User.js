const mongoose = require("mongoose");

// ======================================================
// USER SCHEMA
// ======================================================

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address"
      ]
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false
    },

    role: {
      type: String,
      enum: ["student", "educator", "admin"],
      default: "student"
    },

    // ==================================================
    // EMAIL VERIFICATION
    // ==================================================

    emailVerified: {
      type: Boolean,
      default: false
    },

    emailVerificationToken: {
      type: String,
      default: null,
      select: false
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false
    },

    // ==================================================
    // EDUCATOR VERIFICATION
    // Separate from email verification
    // ==================================================

    educatorVerified: {
      type: Boolean,
      default: false
    },

    // ==================================================
    // ACCOUNT STATUS
    // ==================================================

    accountStatus: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active"
    },

    lastLogin: {
      type: Date,
      default: null
    },

    // ==================================================
    // PASSWORD RESET
    // ==================================================

    passwordResetToken: {
      type: String,
      default: null,
      select: false
    },

    passwordResetExpires: {
      type: Date,
      default: null,
      select: false
    },

    // ==================================================
    // USER PREFERENCES
    // ==================================================

    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark"],
        default: "light"
      },

      soundEnabled: {
        type: Boolean,
        default: true
      }
    }
  },
  {
    timestamps: true
  }
);


// ======================================================
// REMOVE SENSITIVE FIELDS FROM JSON RESPONSES
// ======================================================

userSchema.methods.toJSON = function () {
  const userObject = this.toObject();

  // Password
  delete userObject.password;

  // Password reset information
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;

  // Email verification information
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;

  return userObject;
};


// ======================================================
// EXPORT MODEL
// ======================================================

module.exports = mongoose.model(
  "User",
  userSchema
);