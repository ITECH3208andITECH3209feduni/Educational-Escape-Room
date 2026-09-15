const Room = require("../models/Room");

// ======================================================
// CREATE ROOM
// POST /api/rooms
// Educator only
// ======================================================
exports.createRoom = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      difficulty,
      time,
      questions,
      status,
      instructions,
      completionMessage,
      maxAttempts,
      allowHints,
      showScore,
      leaderboardEnabled,
      availableFrom,
      availableUntil
    } = req.body;

    const room = await Room.create({
      name,
      description,
      category,
      difficulty,
      time,
      questions,
      status,
      instructions,
      completionMessage,
      maxAttempts,
      allowHints,
      showScore,
      leaderboardEnabled,
      availableFrom,
      availableUntil,

      // Educator comes from authenticated JWT user
      educator: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: "Escape room created successfully",
      room
    });
  } catch (error) {
    console.error("Create room error:", error);

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================================
// GET PUBLISHED ROOMS
// GET /api/rooms
// ======================================================
exports.getPublishedRooms = async (req, res) => {
  try {
    const now = new Date();

    const rooms = await Room.find({
      status: "published",
      isDeleted: false,
      $and: [
        {
          $or: [
            { availableFrom: null },
            { availableFrom: { $lte: now } }
          ]
        },
        {
          $or: [
            { availableUntil: null },
            { availableUntil: { $gte: now } }
          ]
        }
      ]
    })
      .populate("educator", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: rooms.length,
      rooms
    });
  } catch (error) {
    console.error("Get published rooms error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve escape rooms"
    });
  }
};


// ======================================================
// GET EDUCATOR'S OWN ROOMS
// GET /api/rooms/educator/my-rooms
// ======================================================
exports.getMyRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      educator: req.user.id,
      isDeleted: false
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: rooms.length,
      rooms
    });
  } catch (error) {
    console.error("Get educator rooms error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your escape rooms"
    });
  }
};


// ======================================================
// GET ONE ROOM
// GET /api/rooms/:id
// ======================================================
exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({
      _id: req.params.id,
      isDeleted: false
    }).populate("educator", "name");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Escape room not found"
      });
    }

    // Draft and archived rooms are only visible
    // to the educator who created them.
    if (room.status !== "published") {
      if (
        !req.user ||
        req.user.role !== "educator" ||
        room.educator._id.toString() !== req.user.id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this room"
        });
      }
    }

    return res.status(200).json({
      success: true,
      room
    });
  } catch (error) {
    console.error("Get room error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve escape room"
    });
  }
};


// ======================================================
// UPDATE ROOM
// PATCH /api/rooms/:id
// Educator owner only
// ======================================================
exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Escape room not found"
      });
    }

    if (room.educator.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own escape rooms"
      });
    }

    const allowedFields = [
      "name",
      "description",
      "category",
      "difficulty",
      "time",
      "questions",
      "status",
      "instructions",
      "completionMessage",
      "maxAttempts",
      "allowHints",
      "showScore",
      "leaderboardEnabled",
      "availableFrom",
      "availableUntil"
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        room[field] = req.body[field];
      }
    });

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Escape room updated successfully",
      room
    });
  } catch (error) {
    console.error("Update room error:", error);

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================================
// PUBLISH ROOM
// PATCH /api/rooms/:id/publish
// Educator owner only
// ======================================================
exports.publishRoom = async (req, res) => {
  try {
    const room = await Room.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Escape room not found"
      });
    }

    if (room.educator.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only publish your own escape rooms"
      });
    }

    if (!room.questions || room.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Add at least one question before publishing the room"
      });
    }

    room.status = "published";

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Escape room published successfully",
      room
    });
  } catch (error) {
    console.error("Publish room error:", error);

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================================
// ARCHIVE ROOM
// PATCH /api/rooms/:id/archive
// Educator owner only
// ======================================================
exports.archiveRoom = async (req, res) => {
  try {
    const room = await Room.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Escape room not found"
      });
    }

    if (room.educator.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only archive your own escape rooms"
      });
    }

    room.status = "archived";

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Escape room archived successfully",
      room
    });
  } catch (error) {
    console.error("Archive room error:", error);

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================================
// DELETE ROOM
// DELETE /api/rooms/:id
// Soft delete - educator owner only
// ======================================================
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Escape room not found"
      });
    }

    if (room.educator.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own escape rooms"
      });
    }

    // Soft delete keeps historical room/result relationships intact.
    room.isDeleted = true;

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Escape room deleted successfully"
    });
  } catch (error) {
    console.error("Delete room error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete escape room"
    });
  }
};