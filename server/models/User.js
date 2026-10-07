const { defineSchema, createModel, ObjectId } = require("../db/model");

// ======================================================
// USER SCHEMA
// ======================================================

const userSchema = defineSchema(
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

    sessionVersion: { type: String, default: "", select: false },

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

// Sensitive fields are excluded by db/model.js for all JSON responses.

// ======================================================
// EXPORT MODEL
// ======================================================

module.exports = createModel(
  "User",
  userSchema
);