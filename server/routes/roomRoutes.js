// ======================================================
// FedEscape Room Routes
// Handles escape room CRUD and publishing operations
// ======================================================

const express = require("express");

const {
  createRoom,
  getPublishedRooms,
  getMyRooms,
  getRoom,
  updateRoom,
  publishRoom,
  archiveRoom,
  deleteRoom
} = require("../controllers/roomController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

const router = express.Router();

// ======================================================
// PUBLIC / STUDENT ROUTES
// ======================================================

// ------------------------------------------------------
// GET ALL PUBLISHED ROOMS
// GET /api/rooms
//
// Students and other users can retrieve rooms that are
// currently published and available.
// ------------------------------------------------------
router.get(
  "/",
  getPublishedRooms
);

// ======================================================
// EDUCATOR ROUTES
// IMPORTANT:
// These routes must appear before "/:id".
// ======================================================

// ------------------------------------------------------
// GET EDUCATOR'S OWN ROOMS
// GET /api/rooms/educator/my-rooms
// ------------------------------------------------------
router.get(
  "/educator/my-rooms",
  protect,
  authorize("educator"),
  getMyRooms
);

// ------------------------------------------------------
// CREATE ESCAPE ROOM
// POST /api/rooms
// Educator only
// ------------------------------------------------------
router.post(
  "/",
  protect,
  authorize("educator"),
  createRoom
);

// ======================================================
// ROOM ACTION ROUTES
// ======================================================

// ------------------------------------------------------
// PUBLISH ROOM
// PATCH /api/rooms/:id/publish
// Educator only
//
// Ownership is also checked by roomController.
// ------------------------------------------------------
router.patch(
  "/:id/publish",
  protect,
  authorize("educator"),
  publishRoom
);

// ------------------------------------------------------
// ARCHIVE ROOM
// PATCH /api/rooms/:id/archive
// Educator only
//
// Ownership is also checked by roomController.
// ------------------------------------------------------
router.patch(
  "/:id/archive",
  protect,
  authorize("educator"),
  archiveRoom
);

// ------------------------------------------------------
// UPDATE ROOM
// PATCH /api/rooms/:id
// Educator only
//
// Ownership is also checked by roomController.
// ------------------------------------------------------
router.patch(
  "/:id",
  protect,
  authorize("educator"),
  updateRoom
);

// ------------------------------------------------------
// DELETE ROOM
// DELETE /api/rooms/:id
// Educator only
//
// This performs the soft delete implemented in
// roomController.
// ------------------------------------------------------
router.delete(
  "/:id",
  protect,
  authorize("educator"),
  deleteRoom
);

// ======================================================
// GET SINGLE ROOM
// ======================================================

// ------------------------------------------------------
// GET ONE ROOM
// GET /api/rooms/:id
//
// This route is intentionally protected because the
// controller supports checking whether an educator owns
// draft/archived rooms.
//
// Published rooms can still be retrieved by authenticated
// students.
// ------------------------------------------------------
router.get(
  "/:id",
  protect,
  getRoom
);

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;