const mongoose = require("mongoose");

/*
 * Question Schema
 * Stores each question/puzzle inside an escape room.
 */
const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
      maxlength: 1000
    },

    questionType: {
      type: String,
      enum: [
        "text",
        "multiple-choice",
        "true-false"
      ],
      default: "text"
    },

    // Used mainly for multiple-choice questions.
    options: {
      type: [String],
      default: []
    },

    correctAnswer: {
      type: String,
      required: [true, "Correct answer is required"],
      trim: true
    },

    // Optional hint shown to students.
    hint: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    // Feedback shown after answering.
    correctFeedback: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "Correct!"
    },

    incorrectFeedback: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "Incorrect. Try again."
    },

    points: {
      type: Number,
      default: 10,
      min: 0
    },

    // Allows questions to be displayed in a defined order.
    order: {
      type: Number,
      default: 0,
      min: 0
    },

    // Optional multimedia support.
    media: {
      mediaType: {
        type: String,
        enum: ["none", "image", "video", "audio"],
        default: "none"
      },

      url: {
        type: String,
        trim: true,
        default: ""
      },

      altText: {
        type: String,
        trim: true,
        default: ""
      }
    }
  },
  {
    _id: true
  }
);


/*
 * Room Schema
 * Represents an escape room created by an educator.
 */
const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
      maxlength: 100
    },

    description: {
      type: String,
      required: [true, "Room description is required"],
      trim: true,
      maxlength: 2000
    },

    /*
     * Room category/topic.
     * Kept flexible so educators can create rooms
     * for subjects beyond cybersecurity.
     */
    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "General"
    },

    /*
     * Difficulty displayed to students.
     */
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner"
    },

    /*
     * Time limit in minutes.
     * Matches the existing frontend roomTime field.
     */
    time: {
      type: Number,
      required: [true, "Room time is required"],
      min: 1,
      max: 300
    },

    /*
     * User who created the room.
     */
    educator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    /*
     * Questions/puzzles belonging to this room.
     */
    questions: {
      type: [questionSchema],
      default: []
    },

    /*
     * Draft rooms remain private.
     * Published rooms can be shown to students.
     * Archived rooms remain stored but are no
     * longer available for new attempts.
     */
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true
    },

    /*
     * Optional instructions shown before starting.
     */
    instructions: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },

    /*
     * Message displayed after successful completion.
     */
    completionMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "Congratulations! You completed the escape room."
    },

    /*
     * Number of attempts permitted.
     * null means unlimited attempts.
     */
    maxAttempts: {
      type: Number,
      min: 1,
      default: null
    },

    /*
     * Whether students can see hints.
     */
    allowHints: {
      type: Boolean,
      default: true
    },

    /*
     * Whether students can see their score
     * after completing the room.
     */
    showScore: {
      type: Boolean,
      default: true
    },

    /*
     * Controls leaderboard availability.
     */
    leaderboardEnabled: {
      type: Boolean,
      default: true
    },

    /*
     * Optional availability period.
     */
    availableFrom: {
      type: Date,
      default: null
    },

    availableUntil: {
      type: Date,
      default: null
    },

    /*
     * Soft-delete support.
     * We can preserve old results instead of
     * permanently removing a room from MongoDB.
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },

  {
    timestamps: true
  }
);


/*
 * Useful database indexes.
 */

roomSchema.index({
  educator: 1,
  createdAt: -1
});

roomSchema.index({
  status: 1,
  isDeleted: 1
});


/*
 * Validation:
 * availableUntil cannot occur before availableFrom.
 */
roomSchema.pre("validate", function () {
  if (
    this.availableFrom &&
    this.availableUntil &&
    this.availableUntil <= this.availableFrom
  ) {
    throw new Error(
      "Room availability end date must be after the start date"
    );
  }
});


module.exports = mongoose.model("Room", roomSchema);