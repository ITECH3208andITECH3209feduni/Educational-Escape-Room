// ======================================================
// FedEscape Attempt Controller
// Student attempts, answers, results and leaderboards
// ======================================================

const mongoose = require("mongoose");
const Attempt = require("../models/Attempt");
const Room = require("../models/Room");

// ======================================================
// Helper Functions
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const normalizeAnswer = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().toLowerCase();
};

const findQuestion = (room, questionId) => {
  return room.questions.find(
    (question) =>
      question._id.toString() === questionId.toString()
  );
};

// ======================================================
// START ATTEMPT
// POST /api/attempts/start/:roomId
// Student only
// ======================================================

exports.startAttempt = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!isValidObjectId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid escape room ID"
      });
    }

    const room = await Room.findOne({
      _id: roomId,
      status: "published",
      isDeleted: false
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Published escape room not found"
      });
    }

    const now = new Date();

    // Check availability start date.
    if (
      room.availableFrom &&
      now < room.availableFrom
    ) {
      return res.status(403).json({
        success: false,
        message: "This escape room is not available yet"
      });
    }

    // Check availability end date.
    if (
      room.availableUntil &&
      now > room.availableUntil
    ) {
      return res.status(403).json({
        success: false,
        message: "This escape room is no longer available"
      });
    }

    // Resume an existing in-progress attempt instead
    // of accidentally creating another one.
    const existingAttempt = await Attempt.findOne({
      student: req.user.id,
      room: room._id,
      status: "in-progress"
    }).sort({ createdAt: -1 });

    if (existingAttempt) {
      return res.status(200).json({
        success: true,
        message: "Existing attempt resumed",
        attempt: existingAttempt
      });
    }

    // Count previous attempts for this student/room.
    const previousAttempts = await Attempt.countDocuments({
      student: req.user.id,
      room: room._id
    });

    // Enforce the educator's maximum attempt setting.
    if (
      room.maxAttempts &&
      previousAttempts >= room.maxAttempts
    ) {
      return res.status(403).json({
        success: false,
        message: "Maximum number of attempts reached"
      });
    }

    // Calculate the maximum possible score from the
    // questions stored in the Room document.
    const maximumScore = room.questions.reduce(
      (total, question) =>
        total + (question.points || 0),
      0
    );

    const attempt = await Attempt.create({
      student: req.user.id,
      room: room._id,
      attemptNumber: previousAttempts + 1,
      status: "in-progress",
      totalQuestions: room.questions.length,
      maximumScore,
      startedAt: new Date()
    });

    return res.status(201).json({
      success: true,
      message: "Escape room attempt started successfully",
      attempt
    });
  } catch (error) {
    console.error("Start attempt error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to start escape room attempt"
    });
  }
};

// ======================================================
// GET STUDENT'S RESULTS
// GET /api/attempts/my-results
// Student only
// ======================================================

exports.getMyResults = async (req, res) => {
  try {
    const attempts = await Attempt.find({
      student: req.user.id
    })
      .populate(
        "room",
        "name category difficulty time status"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: attempts.length,
      results: attempts
    });
  } catch (error) {
    console.error("Get student results error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your results"
    });
  }
};

// ======================================================
// GET SINGLE ATTEMPT
// GET /api/attempts/:attemptId
// Student owner, room educator or admin
// ======================================================

exports.getAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;

    if (!isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID"
      });
    }

    const attempt = await Attempt.findById(attemptId)
      .populate(
        "student",
        "name email"
      )
      .populate(
        "room",
        "name description category difficulty time status educator"
      );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found"
      });
    }

    if (!attempt.student || !attempt.room) {
      return res.status(404).json({
        success: false,
        message: "Attempt data is incomplete"
      });
    }

    const requestingUserId =
      req.user.id.toString();

    const studentId =
      attempt.student._id.toString();

    const educatorId =
      attempt.room.educator
        ? attempt.room.educator.toString()
        : null;

    const isStudentOwner =
      studentId === requestingUserId;

    const isEducatorOwner =
      req.user.role === "educator" &&
      educatorId === requestingUserId;

    const isAdmin =
      req.user.role === "admin";

    if (
      !isStudentOwner &&
      !isEducatorOwner &&
      !isAdmin
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this attempt"
      });
    }

    return res.status(200).json({
      success: true,
      attempt
    });
  } catch (error) {
    console.error("Get attempt error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve attempt"
    });
  }
};

// ======================================================
// SUBMIT ANSWER
// PATCH /api/attempts/:attemptId/answer
//
// Body example:
// {
//   "questionId": "...",
//   "answer": "HTTPS",
//   "hintUsed": false
// }
//
// IMPORTANT:
// Correctness and points are calculated on the server.
// The frontend is never trusted to provide them.
// ======================================================

exports.submitAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const {
      questionId,
      answer,
      hintUsed = false
    } = req.body;

    if (!isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID"
      });
    }

    if (
      !questionId ||
      !isValidObjectId(questionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid question ID is required"
      });
    }

    if (
      answer === undefined ||
      answer === null ||
      String(answer).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Answer is required"
      });
    }

    const attempt = await Attempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found"
      });
    }

    // A student can only submit answers to their
    // own attempt.
    if (
      attempt.student.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only submit answers to your own attempt"
      });
    }

    if (attempt.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "This attempt is no longer active"
      });
    }

    const room = await Room.findOne({
      _id: attempt.room,
      isDeleted: false
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Escape room not found"
      });
    }

    const question = findQuestion(
      room,
      questionId
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message:
          "Question not found in this escape room"
      });
    }

    // Prevent the same question being stored twice.
    const alreadyAnswered = attempt.answers.some(
      (savedAnswer) =>
        savedAnswer.questionId.toString() ===
        question._id.toString()
    );

    if (alreadyAnswered) {
      return res.status(409).json({
        success: false,
        message: "This question has already been answered"
      });
    }

    const studentAnswer =
      normalizeAnswer(answer);

    const correctAnswer =
      normalizeAnswer(question.correctAnswer);

    const isCorrect =
      studentAnswer === correctAnswer;

    const pointsAwarded =
      isCorrect
        ? question.points || 0
        : 0;

    // Only record hint usage if hints are actually
    // enabled for this room.
    const validHintUsed =
      room.allowHints === true &&
      Boolean(hintUsed);

    attempt.answers.push({
      questionId: question._id,
      questionText: question.questionText,
      answer: String(answer).trim(),
      isCorrect,
      pointsAwarded,
      maxPoints: question.points || 0,
      hintUsed: validHintUsed,
      answeredAt: new Date()
    });

    attempt.currentQuestion =
      attempt.answers.length;

    attempt.lastActivityAt =
      new Date();

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: "Answer submitted successfully",

      result: {
        questionId: question._id,
        isCorrect,
        pointsAwarded,

        feedback:
          isCorrect
            ? question.correctFeedback
            : question.incorrectFeedback,

        progressPercentage:
          attempt.progressPercentage,

        score:
          attempt.score,

        maximumScore:
          attempt.maximumScore
      }
    });
  } catch (error) {
    console.error("Submit answer error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to submit answer"
    });
  }
};

// ======================================================
// COMPLETE ATTEMPT
// PATCH /api/attempts/:attemptId/complete
// Student only
// ======================================================

exports.completeAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;

    if (!isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID"
      });
    }

    const attempt = await Attempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found"
      });
    }

    if (
      attempt.student.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only complete your own attempt"
      });
    }

    if (attempt.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "This attempt has already ended"
      });
    }

    const room = await Room.findOne({
      _id: attempt.room,
      isDeleted: false
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Escape room not found"
      });
    }

    // Student must answer every question before
    // completing the room.
    if (
      attempt.answers.length <
      room.questions.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "All questions must be answered before completing the escape room"
      });
    }

    attempt.status = "completed";
    attempt.completedAt = new Date();

    // Current FedEscape behaviour:
    // reaching the end of the escape room means completion.
    //
    // A configurable passing percentage can be added
    // later without changing the attempt structure.
    attempt.passed = true;

    await attempt.save();

    return res.status(200).json({
      success: true,

      message:
        room.completionMessage ||
        "Escape room completed successfully",

      result: {
        attemptId:
          attempt._id,

        roomId:
          room._id,

        roomName:
          room.name,

        attemptNumber:
          attempt.attemptNumber,

        score:
          attempt.score,

        maximumScore:
          attempt.maximumScore,

        scorePercentage:
          attempt.scorePercentage,

        progressPercentage:
          attempt.progressPercentage,

        hintsUsed:
          attempt.hintsUsed,

        durationSeconds:
          attempt.durationSeconds,

        passed:
          attempt.passed,

        completedAt:
          attempt.completedAt
      }
    });
  } catch (error) {
    console.error("Complete attempt error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to complete escape room attempt"
    });
  }
};

// ======================================================
// ABANDON ATTEMPT
// PATCH /api/attempts/:attemptId/abandon
// Student only
// ======================================================

exports.abandonAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;

    if (!isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID"
      });
    }

    const attempt = await Attempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found"
      });
    }

    if (
      attempt.student.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only abandon your own attempt"
      });
    }

    if (attempt.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "This attempt has already ended"
      });
    }

    attempt.status = "abandoned";
    attempt.completedAt = new Date();
    attempt.passed = false;

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: "Escape room attempt abandoned",
      attempt
    });
  } catch (error) {
    console.error("Abandon attempt error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to abandon attempt"
    });
  }
};

// ======================================================
// EDUCATOR ROOM RESULTS
// GET /api/attempts/room/:roomId/results
// Educator owner or admin
// ======================================================

exports.getRoomResults = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!isValidObjectId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid escape room ID"
      });
    }

    const room = await Room.findOne({
      _id: roomId,
      isDeleted: false
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Escape room not found"
      });
    }

    const isOwner =
      room.educator.toString() ===
      req.user.id.toString();

    const isAdmin =
      req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message:
          "You can only view results for your own escape rooms"
      });
    }

    const attempts = await Attempt.find({
      room: room._id
    })
      .populate(
        "student",
        "name email"
      )
      .sort({
        createdAt: -1
      });

    const completedAttempts =
      attempts.filter(
        (attempt) =>
          attempt.status === "completed"
      );

    const averageScore =
      completedAttempts.length > 0
        ? Math.round(
            completedAttempts.reduce(
              (total, attempt) =>
                total +
                attempt.scorePercentage,
              0
            ) /
              completedAttempts.length
          )
        : 0;

    return res.status(200).json({
      success: true,

      room: {
        id: room._id,
        name: room.name
      },

      statistics: {
        totalAttempts:
          attempts.length,

        completedAttempts:
          completedAttempts.length,

        averageScorePercentage:
          averageScore
      },

      results:
        attempts
    });
  } catch (error) {
    console.error("Get room results error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve room results"
    });
  }
};

// ======================================================
// LEADERBOARD
// GET /api/attempts/room/:roomId/leaderboard
// ======================================================

exports.getLeaderboard = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!isValidObjectId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid escape room ID"
      });
    }

    const room = await Room.findOne({
      _id: roomId,
      isDeleted: false
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Escape room not found"
      });
    }

    if (!room.leaderboardEnabled) {
      return res.status(403).json({
        success: false,
        message:
          "Leaderboard is disabled for this escape room"
      });
    }

    const attempts = await Attempt.find({
      room: room._id,
      status: "completed",
      leaderboardEligible: true
    })
      .populate(
        "student",
        "name"
      )
      .sort({
        score: -1,
        durationSeconds: 1,
        completedAt: 1
      });

    // Keep only each student's highest-ranked attempt.
    const studentMap = new Map();

    attempts.forEach((attempt) => {
      if (!attempt.student) {
        return;
      }

      const studentId =
        attempt.student._id.toString();

      if (!studentMap.has(studentId)) {
        studentMap.set(
          studentId,
          attempt
        );
      }
    });

    const bestAttempts =
      Array.from(
        studentMap.values()
      ).slice(0, 100);

    const leaderboard =
      bestAttempts.map(
        (attempt, index) => ({
          rank:
            index + 1,

          student: {
            id:
              attempt.student._id,

            name:
              attempt.student.name
          },

          score:
            attempt.score,

          maximumScore:
            attempt.maximumScore,

          scorePercentage:
            attempt.scorePercentage,

          durationSeconds:
            attempt.durationSeconds,

          hintsUsed:
            attempt.hintsUsed,

          attemptNumber:
            attempt.attemptNumber,

          completedAt:
            attempt.completedAt
        })
      );

    return res.status(200).json({
      success: true,

      room: {
        id: room._id,
        name: room.name
      },

      count:
        leaderboard.length,

      leaderboard
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve leaderboard"
    });
  }
};