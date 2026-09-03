const mongoose = require("mongoose");

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

    educatorVerified: {
      type: Boolean,
      default: false
    },

    accountStatus: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active"
    },

    lastLogin: {
      type: Date,
      default: null
    },

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

// Remove sensitive fields when returning user data
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();

  delete userObject.password;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;

  return userObject;
};

module.exports = mongoose.model("User", userSchema);