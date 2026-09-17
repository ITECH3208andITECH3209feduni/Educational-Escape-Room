"use strict";

// ======================================================
// FedEscape Student Dashboard
// Loads published escape rooms from the backend.
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
    loadPublishedRooms();
});


// ======================================================
// LOAD PUBLISHED ROOMS
// GET /api/rooms
// ======================================================

async function loadPublishedRooms() {

    const roomsContainer =
        document.getElementById("publishedRoomsContainer");

    const roomCount =
        document.getElementById("availableRoomCount");

    if (!roomsContainer) {
        return;
    }

    try {

        const response = await fetch(
            "http://localhost:5000/api/rooms"
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to retrieve escape rooms."
            );
        }

        const rooms = data.rooms || [];

        // ----------------------------------------------
        // Update available room count
        // ----------------------------------------------

        if (roomCount) {

            roomCount.textContent =
                `${rooms.length} ${
                    rooms.length === 1
                        ? "Room"
                        : "Rooms"
                } Available`;
        }

        // ----------------------------------------------
        // No published rooms
        // ----------------------------------------------

        if (rooms.length === 0) {

            roomsContainer.innerHTML = `
                <p>
                    No escape rooms are currently available.
                </p>
            `;

            return;
        }

        // ----------------------------------------------
        // Clear loading message
        // ----------------------------------------------

        roomsContainer.innerHTML = "";

        // ----------------------------------------------
        // Render every published room
        // ----------------------------------------------

        rooms.forEach((room) => {

            const roomCard =
                createRoomCard(room);

            roomsContainer.appendChild(roomCard);
        });

    } catch (error) {

        console.error(
            "Error loading published rooms:",
            error
        );

        roomsContainer.innerHTML = `
            <p>
                Unable to load escape rooms.
                Please make sure the FedEscape server is running.
            </p>
        `;

        if (roomCount) {
            roomCount.textContent =
                "Rooms unavailable";
        }
    }
}


// ======================================================
// CREATE ROOM CARD
// ======================================================

function createRoomCard(room) {

    const article =
        document.createElement("article");

    article.className =
        "featured-room-card";

    const difficulty =
        formatDifficulty(room.difficulty);

    const questionCount =
        Array.isArray(room.questions)
            ? room.questions.length
            : 0;

    article.innerHTML = `

        <div class="featured-room-content">

            <div
                class="room-icon"
                aria-hidden="true"
            >
                🛡️
            </div>

            <div class="room-title-row">

                <div>

                    <span
                        class="room-status available-status"
                    >
                        Available
                    </span>

                    <h2>
                        ${escapeHTML(room.name)}
                    </h2>

                </div>

                <span class="room-level-badge">
                    ${escapeHTML(difficulty)}
                </span>

            </div>

            <p class="room-description">
                ${escapeHTML(room.description)}
            </p>

            <div class="room-information">

                <div class="room-information-item">

                    <span class="room-information-label">
                        Difficulty
                    </span>

                    <strong>
                        ${escapeHTML(difficulty)}
                    </strong>

                </div>

                <div class="room-information-item">

                    <span class="room-information-label">
                        Time Limit
                    </span>

                    <strong>
                        ${room.time} Minutes
                    </strong>

                </div>

                <div class="room-information-item">

                    <span class="room-information-label">
                        Challenges
                    </span>

                    <strong>
                        ${questionCount} Challenges
                    </strong>

                </div>

                <div class="room-information-item">

                    <span class="room-information-label">
                        Subject
                    </span>

                    <strong>
                        ${escapeHTML(room.category)}
                    </strong>

                </div>

            </div>

            ${
                room.instructions
                    ? `
                        <div class="room-learning-objectives">

                            <h3>Mission Instructions</h3>

                            <p>
                                ${escapeHTML(room.instructions)}
                            </p>

                        </div>
                    `
                    : ""
            }

            <button
                type="button"
                class="primary-btn room-start-button"
                data-room-id="${room._id}"
            >
                Start Mission
            </button>

        </div>

        <div class="featured-room-panel">

            <p class="mission-panel-label">
                Mission Status
            </p>

            <div
                class="mission-status-graphic"
                aria-hidden="true"
            >
                <span>🔐</span>
            </div>

            <h3>
                ${escapeHTML(room.name)}
            </h3>

            <p>
                This mission is available and waiting
                for a student agent.
            </p>

            <div class="mission-panel-detail">

                <span>Difficulty</span>

                <strong>
                    ${escapeHTML(difficulty)}
                </strong>

            </div>

        </div>
    `;

    // ----------------------------------------------
    // Start Mission button
    // ----------------------------------------------

    const startButton =
        article.querySelector(
            ".room-start-button"
        );

    startButton.addEventListener(
        "click",
        () => {

            const roomId =
                startButton.dataset.roomId;

            // Store the REAL MongoDB room ID.
            localStorage.setItem(
                "fedEscapeSelectedRoomId",
                roomId
            );

            console.log(
                "Selected FedEscape room:",
                roomId
            );

            // For now continue to the existing intro page.
            // Starting the MongoDB attempt will be connected
            // in the next step.
            window.location.href =
                "rooms/cyber-security/intro.html";
        }
    );

    return article;
}


// ======================================================
// FORMAT DIFFICULTY
// advanced -> Advanced
// beginner -> Beginner
// ======================================================

function formatDifficulty(difficulty) {

    if (!difficulty) {
        return "Not specified";
    }

    return (
        difficulty.charAt(0).toUpperCase() +
        difficulty.slice(1)
    );
}


// ======================================================
// BASIC HTML ESCAPING
// Prevent room content from being inserted as HTML.
// ======================================================

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}