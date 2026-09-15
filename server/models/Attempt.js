const mongoose = require("mongoose");

// ======================================================
// Answer Schema
// Stores one student's answer to one room question
// ======================================================

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    questionText: {
      type: String,
      trim: true,
      default: ""
    },

    answer: {
      type: String,
      trim: true,
      default: ""
    },

    isCorrect: {
      type: Boolean,
      default: false
    },

    pointsAwarded: {
      type: Number,
      default: 0,
      min: 0
    },

    maxPoints: {
      type: Number,
      default: 0,
      min: 0
    },

    hintUsed: {
      type: Boolean,
      default: false
    },

    answeredAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);

// ======================================================
// Attempt Schema
// Represents one student's attempt at one escape room
// ======================================================

const attemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student is required"],
      index: true
    },

    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Escape room is required"],
      index: true
    },

    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },

    status: {
      type: String,
      enum: [
        "in-progress",
        "completed",
        "abandoned",
        "expired"
      ],
      default: "in-progress",
      index: true
    },

    answers: {
      type: [answerSchema],
      default: []
    },

    currentQuestion: {
      type: Number,
      default: 0,
      min: 0
    },

    questionsAnswered: {
      type: Number,
      default: 0,
      min: 0
    },

    totalQuestions: {
      type: Number,
      default: 0,
      min: 0
    },

    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    score: {
      type: Number,
      default: 0,
      min: 0
    },

    maximumScore: {
      type: Number,
      default: 0,
      min: 0
    },

    scorePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    passed: {
      type: Boolean,
      default: false
    },

    startedAt: {
      type: Date,
      default: Date.now
    },

    completedAt: {
      type: Date,
      default: null
    },

    durationSeconds: {
      type: Number,
      default: 0,
      min: 0
    },

    hintsUsed: {
      type: Number,
      default: 0,
      min: 0
    },

    leaderboardEligible: {
      type: Boolean,
      default: false
    },

    lastActivityAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// ======================================================
// Indexes
// ======================================================

attemptSchema.index({
  student: 1,
  room: 1,
  attemptNumber: -1
});

attemptSchema.index({
  student: 1,
  createdAt: -1
});

attemptSchema.index({
  room: 1,
  createdAt: -1
});

attemptSchema.index({
  room: 1,
  status: 1,
  leaderboardEligible: 1,
  score: -1,
  durationSeconds: 1
});

// ======================================================
// Pre-save Calculations
//
// Important:
// We intentionally do NOT use `next` here because
// your current Mongoose version uses modern middleware
// behaviour.
// ======================================================

attemptSchema.pre("save", function () {
  // Number of answered questions
  this.questionsAnswered = this.answers.length;

  // Progress percentage
  if (this.totalQuestions > 0) {
    this.progressPercentage = Math.min(
      100,
      Math.round(
        (this.questionsAnswered / this.totalQuestions) * 100
      )
    );
  } else {
    this.progressPercentage = 0;
  }

  // Calculate score from stored answers
  this.score = this.answers.reduce(
    (total, answer) =>
      total + (answer.pointsAwarded || 0),
    0
  );

  // Score percentage
  if (this.maximumScore > 0) {
    this.scorePercentage = Math.min(
      100,
      Math.round(
        (this.score / this.maximumScore) * 100
      )
    );
  } else {
    this.scorePercentage = 0;
  }

  // Count hints
  this.hintsUsed = this.answers.filter(
    (answer) => answer.hintUsed
  ).length;

  // Calculate duration when completed
  if (
    this.status === "completed" &&
    this.completedAt &&
    this.startedAt
  ) {
    this.durationSeconds = Math.max(
      0,
      Math.round(
        (this.completedAt.getTime() -
          this.startedAt.getTime()) /
          1000
      )
    );
  }

  // Only completed attempts can appear
  // in leaderboard calculations.
  this.leaderboardEligible =
    this.status === "completed";

  this.lastActivityAt = new Date();
});

// ======================================================
// Export Model
// ======================================================

module.exports = mongoose.model(
  "Attempt",
  attemptSchema
);