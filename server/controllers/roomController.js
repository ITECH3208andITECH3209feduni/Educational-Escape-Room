const mongoose = require("mongoose");
const Room = require("../models/Room");


// ======================================================
// HELPER: CREATE STUDENT-SAFE ROOM
//
// Removes information that could reveal answers.
//
// Students may receive:
// - Question ID
// - Question text
// - Question type
// - Options
// - Hint
// - Points
// - Order
// - Media
//
// Students must NOT receive:
// - correctAnswer
// - correctFeedback
// - incorrectFeedback
//
// Correctness and feedback are handled by the
// attemptController when an answer is submitted.
// ======================================================

const createStudentSafeRoom = (roomDocument) => {

    const room =
        typeof roomDocument.toObject === "function"
            ? roomDocument.toObject()
            : roomDocument;

    if (Array.isArray(room.questions)) {

        room.questions = room.questions.map(
            (question) => {

                const {
                    correctAnswer,
                    correctFeedback,
                    incorrectFeedback,
                    ...safeQuestion
                } = question;

                return safeQuestion;
            }
        );
    }

    return room;
};


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

            // Educator comes from authenticated JWT user.
            educator: req.user.id
        });


        return res.status(201).json({

            success: true,

            message:
                "Escape room created successfully",

            room
        });

    } catch (error) {

        console.error(
            "Create room error:",
            error
        );


        return res.status(400).json({

            success: false,

            message: error.message
        });
    }
};


// ======================================================
// GET PUBLISHED ROOMS
// GET /api/rooms
//
// Public/student-safe endpoint.
//
// Only published, active and non-deleted rooms are
// returned.
//
// Correct answers and answer feedback are removed.
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

                        {
                            availableFrom: null
                        },

                        {
                            availableFrom: {
                                $lte: now
                            }
                        }
                    ]
                },

                {
                    $or: [

                        {
                            availableUntil: null
                        },

                        {
                            availableUntil: {
                                $gte: now
                            }
                        }
                    ]
                }
            ]

        })
            .populate(
                "educator",
                "name"
            )
            .sort({
                createdAt: -1
            });


        // Remove correct answers and feedback before
        // returning rooms to students/public users.

        const safeRooms =
            rooms.map(createStudentSafeRoom);


        return res.status(200).json({

            success: true,

            count: safeRooms.length,

            rooms: safeRooms
        });

    } catch (error) {

        console.error(
            "Get published rooms error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to retrieve escape rooms"
        });
    }
};


// ======================================================
// GET EDUCATOR'S OWN ROOMS
// GET /api/rooms/educator/my-rooms
//
// Educator only.
//
// Educators receive their COMPLETE room data because
// they need correct answers and feedback when editing
// their own rooms.
// ======================================================

exports.getMyRooms = async (req, res) => {

    try {

        const rooms = await Room.find({

            educator: req.user.id,

            isDeleted: false

        }).sort({

            updatedAt: -1
        });


        return res.status(200).json({

            success: true,

            count: rooms.length,

            rooms
        });

    } catch (error) {

        console.error(
            "Get educator rooms error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to retrieve your escape rooms"
        });
    }
};


// ======================================================
// GET ONE ROOM
// GET /api/rooms/:id
//
// Protected route.
//
// STUDENT:
// Can retrieve published and currently available rooms.
// Sensitive answer information is removed.
//
// EDUCATOR:
// Can retrieve their own complete room, including
// draft/archived rooms and answer information.
//
// ADMIN:
// Can retrieve complete room information.
// ======================================================

exports.getRoom = async (req, res) => {

    try {

        // --------------------------------------------------
        // Validate MongoDB ID
        // --------------------------------------------------

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid escape room ID"
            });
        }


        const room = await Room.findOne({

            _id: req.params.id,

            isDeleted: false

        }).populate(
            "educator",
            "name"
        );


        if (!room) {

            return res.status(404).json({

                success: false,

                message:
                    "Escape room not found"
            });
        }


        // --------------------------------------------------
        // ADMIN
        //
        // Admin can retrieve the complete room.
        // --------------------------------------------------

        if (
            req.user &&
            req.user.role === "admin"
        ) {

            return res.status(200).json({

                success: true,

                room
            });
        }


        // --------------------------------------------------
        // EDUCATOR OWNER
        //
        // The educator who created the room can retrieve
        // complete information, including correct answers.
        // --------------------------------------------------

        const educatorId =
            room.educator &&
            room.educator._id
                ? room.educator._id.toString()
                : room.educator.toString();


        if (
            req.user &&
            req.user.role === "educator" &&
            educatorId ===
                req.user.id.toString()
        ) {

            return res.status(200).json({

                success: true,

                room
            });
        }


        // --------------------------------------------------
        // STUDENT / OTHER AUTHENTICATED USER
        //
        // Only published rooms may be accessed.
        // --------------------------------------------------

        if (room.status !== "published") {

            return res.status(403).json({

                success: false,

                message:
                    "You do not have permission to access this room"
            });
        }


        // --------------------------------------------------
        // Check availability window.
        // --------------------------------------------------

        const now = new Date();


        if (
            room.availableFrom &&
            new Date(room.availableFrom) > now
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "This escape room is not available yet"
            });
        }


        if (
            room.availableUntil &&
            new Date(room.availableUntil) < now
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "This escape room is no longer available"
            });
        }


        // --------------------------------------------------
        // Remove answers before returning room to student.
        // --------------------------------------------------

        const safeRoom =
            createStudentSafeRoom(room);


        return res.status(200).json({

            success: true,

            room: safeRoom
        });

    } catch (error) {

        console.error(
            "Get room error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to retrieve escape room"
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

        // --------------------------------------------------
        // Validate MongoDB ID
        // --------------------------------------------------

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid escape room ID"
            });
        }


        const room = await Room.findOne({

            _id: req.params.id,

            isDeleted: false
        });


        if (!room) {

            return res.status(404).json({

                success: false,

                message:
                    "Escape room not found"
            });
        }


        // --------------------------------------------------
        // Ownership check
        // --------------------------------------------------

        if (
            room.educator.toString() !==
            req.user.id.toString()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You can only edit your own escape rooms"
            });
        }


        // --------------------------------------------------
        // Fields educators are permitted to update.
        // --------------------------------------------------

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

            if (
                req.body[field] !== undefined
            ) {

                room[field] =
                    req.body[field];
            }
        });


        await room.save();


        return res.status(200).json({

            success: true,

            message:
                "Escape room updated successfully",

            room
        });

    } catch (error) {

        console.error(
            "Update room error:",
            error
        );


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

        // --------------------------------------------------
        // Validate MongoDB ID
        // --------------------------------------------------

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid escape room ID"
            });
        }


        const room = await Room.findOne({

            _id: req.params.id,

            isDeleted: false
        });


        if (!room) {

            return res.status(404).json({

                success: false,

                message:
                    "Escape room not found"
            });
        }


        // --------------------------------------------------
        // Ownership check
        // --------------------------------------------------

        if (
            room.educator.toString() !==
            req.user.id.toString()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You can only publish your own escape rooms"
            });
        }


        // --------------------------------------------------
        // A room must contain at least one question.
        // --------------------------------------------------

        if (
            !room.questions ||
            room.questions.length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Add at least one question before publishing the room"
            });
        }


        room.status = "published";


        await room.save();


        return res.status(200).json({

            success: true,

            message:
                "Escape room published successfully",

            room
        });

    } catch (error) {

        console.error(
            "Publish room error:",
            error
        );


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

        // --------------------------------------------------
        // Validate MongoDB ID
        // --------------------------------------------------

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid escape room ID"
            });
        }


        const room = await Room.findOne({

            _id: req.params.id,

            isDeleted: false
        });


        if (!room) {

            return res.status(404).json({

                success: false,

                message:
                    "Escape room not found"
            });
        }


        // --------------------------------------------------
        // Ownership check
        // --------------------------------------------------

        if (
            room.educator.toString() !==
            req.user.id.toString()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You can only archive your own escape rooms"
            });
        }


        room.status = "archived";


        await room.save();


        return res.status(200).json({

            success: true,

            message:
                "Escape room archived successfully",

            room
        });

    } catch (error) {

        console.error(
            "Archive room error:",
            error
        );


        return res.status(400).json({

            success: false,

            message: error.message
        });
    }
};


// ======================================================
// DELETE ROOM
// DELETE /api/rooms/:id
//
// Soft delete.
// Educator owner only.
// ======================================================

exports.deleteRoom = async (req, res) => {

    try {

        // --------------------------------------------------
        // Validate MongoDB ID
        // --------------------------------------------------

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid escape room ID"
            });
        }


        const room = await Room.findOne({

            _id: req.params.id,

            isDeleted: false
        });


        if (!room) {

            return res.status(404).json({

                success: false,

                message:
                    "Escape room not found"
            });
        }


        // --------------------------------------------------
        // Ownership check
        // --------------------------------------------------

        if (
            room.educator.toString() !==
            req.user.id.toString()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You can only delete your own escape rooms"
            });
        }


        // --------------------------------------------------
        // Soft delete
        //
        // Keeps historical attempt/result relationships.
        // --------------------------------------------------

        room.isDeleted = true;


        await room.save();


        return res.status(200).json({

            success: true,

            message:
                "Escape room deleted successfully"
        });

    } catch (error) {

        console.error(
            "Delete room error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to delete escape room"
        });
    }
};