"use strict";

/* ==========================================================
   FEDESCAPE — EDUCATOR ROOM MANAGEMENT
   ========================================================== */

const API_BASE_URL = "http://localhost:5000/api";

let rooms = [];


/* ==========================================================
   AUTHENTICATION
   ========================================================== */

function getToken() {
    return localStorage.getItem("fedEscapeToken");
}

function getUserRole() {
    return localStorage.getItem("fedEscapeUserRole");
}

function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
    };
}

function checkEducatorAuthentication() {
    const token = getToken();
    const role = getUserRole();

    if (!token) {
        alert("Please log in to continue.");
        window.location.href = "../login.html";
        return false;
    }

    if (role && role !== "educator") {
        alert("Educator access is required.");
        window.location.href = "../dashboard.html";
        return false;
    }

    return true;
}

function handleAuthenticationError(response) {
    if (response.status === 401) {
        alert("Your session has expired. Please log in again.");

        localStorage.removeItem("fedEscapeToken");
        localStorage.removeItem("fedEscapeLoggedIn");

        window.location.href = "../login.html";
        return true;
    }

    if (response.status === 403) {
        alert("You do not have permission to perform this action.");
        return true;
    }

    return false;
}


/* ==========================================================
   PAGE NAVIGATION
   ========================================================== */

function showPage(page) {
    const roomsPage = document.getElementById("roomsPage");
    const createPage = document.getElementById("createPage");
    const resultsPage = document.getElementById("resultsPage");

    if (roomsPage) {
        roomsPage.classList.toggle("hidden", page !== "rooms");
    }

    if (createPage) {
        createPage.classList.toggle("hidden", page !== "create");
    }

    if (resultsPage) {
        resultsPage.classList.toggle("hidden", page !== "results");
    }

    if (page === "rooms") {
        resetRoomForm();
        loadRooms();
    }

    if (page === "create") {
        prepareCreateRoom();
    }

    if (page === "results") {
        displayResults();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* ==========================================================
   LOAD ROOMS
   ========================================================== */

async function loadRooms() {
    const roomList = document.getElementById("roomList");

    if (roomList) {
        roomList.innerHTML = `
            <div class="room-empty-state">
                <strong>Loading escape rooms...</strong>
                Please wait while FedEscape retrieves your rooms.
            </div>
        `;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/rooms/educator/my-rooms`,
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );

        if (handleAuthenticationError(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load rooms.");
        }

        rooms = Array.isArray(data.rooms) ? data.rooms : [];

        displayRooms();

    } catch (error) {
        console.error("Load rooms error:", error);

        if (roomList) {
            roomList.innerHTML = `
                <div class="room-empty-state">
                    <strong>Unable to load rooms</strong>
                    ${escapeHtml(error.message)}
                </div>
            `;
        }
    }
}


/* ==========================================================
   STATISTICS
   ========================================================== */

function createOrUpdateStatistics() {
    const roomList = document.getElementById("roomList");

    if (!roomList) {
        return;
    }

    const roomsPage = document.getElementById("roomsPage");

    if (!roomsPage) {
        return;
    }

    let statsContainer = document.getElementById("roomStats");

    if (!statsContainer) {
        statsContainer = document.createElement("div");
        statsContainer.id = "roomStats";
        statsContainer.className = "room-stats";

        roomsPage.insertBefore(statsContainer, roomList);
    }

    const publishedCount = rooms.filter(
        room => room.status === "published"
    ).length;

    const draftCount = rooms.filter(
        room => room.status === "draft"
    ).length;

    const archivedCount = rooms.filter(
        room => room.status === "archived"
    ).length;

    statsContainer.innerHTML = `
        <div class="room-stat-card">
            <span class="room-stat-label">Total Rooms</span>
            <span class="room-stat-number">${rooms.length}</span>
        </div>

        <div class="room-stat-card published">
            <span class="room-stat-label">Published</span>
            <span class="room-stat-number">${publishedCount}</span>
        </div>

        <div class="room-stat-card draft">
            <span class="room-stat-label">
                Drafts
                ${archivedCount > 0 ? ` • ${archivedCount} archived` : ""}
            </span>
            <span class="room-stat-number">${draftCount}</span>
        </div>
        `.replace(/\u00A0/g, " ");

    /*
        Hide older plain-text statistics if they exist in the HTML.
        This lets the JavaScript work with both the previous and
        updated versions of escaperoomcreate.html.
    */
    const oldStats = document.querySelectorAll(
        ".stats-container, .room-summary, .room-summary-stats"
    );

    oldStats.forEach(element => {
        if (element.id !== "roomStats") {
            element.style.display = "none";
        }
    });
}


/* ==========================================================
   DISPLAY ROOMS
   ========================================================== */

function displayRooms() {
    const roomList = document.getElementById("roomList");

    if (!roomList) {
        return;
    }

    createOrUpdateStatistics();

    if (rooms.length === 0) {
        roomList.innerHTML = `
            <div class="room-empty-state">
                <strong>No escape rooms yet</strong>
                Create your first interactive escape room to get started.
            </div>
        `;

        return;
    }

    roomList.innerHTML = rooms.map(room => {

        const roomId = room._id;
        const status = room.status || "draft";
        const difficulty = room.difficulty || "beginner";
        const questionCount = Array.isArray(room.questions)
            ? room.questions.length
            : 0;

        const category = room.category || "General";
        const time = room.time || 0;

        let statusAction = "";

        if (status === "published") {
            statusAction = `
                <button
                    type="button"
                    class="archive-btn"
                    onclick="archiveRoom('${roomId}')"
                >
                    Archive
                </button>
            `;
        } else {
            statusAction = `
                <button
                    type="button"
                    class="publish-btn"
                    onclick="publishRoom('${roomId}')"
                >
                    Publish
                </button>
            `;
        }

        return `
            <article class="room educator-room-card">

                <div class="room-card-top">
                    <div>
                        <span class="room-status ${escapeHtml(status)}">
                            ${escapeHtml(status)}
                        </span>

                        <span class="difficulty-badge ${escapeHtml(difficulty)}">
                            ${formatLabel(difficulty)}
                        </span>
                    </div>
                </div>

                <h3>${escapeHtml(room.name)}</h3>

                <p class="room-description">
                    ${escapeHtml(room.description)}
                </p>

                <div class="room-meta">
                    <span>⏱ ${escapeHtml(time)} min</span>

                    <span>
                        ❓ ${questionCount}
                        ${questionCount === 1 ? "question" : "questions"}
                    </span>

                    <span>
                        📚 ${escapeHtml(category)}
                    </span>
                </div>

                <div class="room-actions">

                    <button
                        type="button"
                        class="edit-btn"
                        onclick="editRoom('${roomId}')"
                    >
                        Edit
                    </button>

                    ${statusAction}

                    <button
                        type="button"
                        class="delete-btn"
                        onclick="deleteRoom('${roomId}')"
                    >
                        Delete
                    </button>

                </div>

            </article>
        `;
    }).join("").replace(/\u00A0/g, " ");
}


/* ==========================================================
   CREATE ROOM
   ========================================================== */

function prepareCreateRoom() {
    const roomId = document.getElementById("roomId");

    /*
        If roomId already exists, the educator is editing.
        Do not wipe the form.
    */
    if (roomId && roomId.value) {
        return;
    }

    resetRoomForm();

    const questionsContainer =
        document.getElementById("questionsContainer");

    /*
        Start a new room with no questions.
        The educator can click + Add Question.
    */
    if (questionsContainer) {
        questionsContainer.innerHTML = "";
    }
}


/* ==========================================================
   SAVE ROOM
   ========================================================== */

async function saveRoom(event) {
    event.preventDefault();

    const roomId =
        document.getElementById("roomId")?.value.trim() || "";

    const name =
        document.getElementById("roomName")?.value.trim() || "";

    const description =
        document.getElementById("roomDescription")?.value.trim() || "";

    const time = Number(
        document.getElementById("roomTime")?.value
    );

    const category =
        document.getElementById("roomCategory")?.value.trim() ||
        "General";

    const difficulty =
        document.getElementById("roomDifficulty")?.value ||
        "beginner";

    const instructions =
        document.getElementById("roomInstructions")?.value.trim() ||
        "";

    const completionMessage =
        getRoomFormElement("completionMessage")?.value.trim() ||
        "Congratulations! You completed the escape room.";

    const maxAttemptsValue =
        getRoomFormElement("maxAttempts")?.value.trim();

    const maxAttempts =
        maxAttemptsValue
            ? Number(maxAttemptsValue)
            : null;

    const allowHints =
        getRoomFormElement("allowHints")
            ? getRoomFormElement("allowHints").checked
            : true;

    const showScore =
        getRoomFormElement("showScore")
            ? getRoomFormElement("showScore").checked
            : true;

    const leaderboardEnabled =
        getRoomFormElement("leaderboardEnabled")
            ? getRoomFormElement("leaderboardEnabled").checked
            : true;


    /* ---------- Basic validation ---------- */

    if (!name) {
        alert("Please enter a room name.");
        return;
    }

    if (!description) {
        alert("Please enter a room description.");
        return;
    }

    if (!time || time < 1 || time > 300) {
        alert("Room time must be between 1 and 300 minutes.");
        return;
    }

    if (maxAttempts !== null && maxAttempts < 1) {
        alert("Maximum attempts must be at least 1.");
        return;
    }


    /* ---------- Collect Questions ---------- */

    let questions;

    try {
        questions = collectQuestions();
    } catch (error) {
        alert(error.message);
        return;
    }


    /* ---------- Request Body ---------- */

    const body = {
        name,
        description,
        category,
        difficulty,
        time,
        instructions,
        completionMessage,
        maxAttempts,
        allowHints,
        showScore,
        leaderboardEnabled,
        questions
    };


    const url = roomId
        ? `${API_BASE_URL}/rooms/${roomId}`
        : `${API_BASE_URL}/rooms`;

    const method = roomId ? "PATCH" : "POST";


    try {
        const saveButton =
            document.querySelector(".save-room-btn") ||
            document.querySelector(
                '#roomForm button[type="submit"]'
            );

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent =
                roomId ? "Saving Changes..." : "Creating Room...";
        }

        const response = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });

        if (handleAuthenticationError(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Unable to save the escape room."
            );
        }

        alert(
            roomId
                ? "Escape room updated successfully."
                : "Escape room created successfully."
        );

        resetRoomForm();

        const roomsPage = document.getElementById("roomsPage");
        const createPage = document.getElementById("createPage");

        if (createPage) {
            createPage.classList.add("hidden");
        }

        if (roomsPage) {
            roomsPage.classList.remove("hidden");
        }

        await loadRooms();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    } catch (error) {
        console.error("Save room error:", error);
        alert(error.message);

    } finally {

        const saveButton =
            document.querySelector(".save-room-btn") ||
            document.querySelector(
                '#roomForm button[type="submit"]'
            );

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = roomId
                ? "Save Changes"
                : "Save Room";
        }
    }
}


/* ==========================================================
   EDIT ROOM
   ========================================================== */

function editRoom(id) {
    const room = rooms.find(
        currentRoom => currentRoom._id === id
    );

    if (!room) {
        alert("Unable to find this escape room.");
        return;
    }

    const roomsPage = document.getElementById("roomsPage");
    const createPage = document.getElementById("createPage");
    const resultsPage = document.getElementById("resultsPage");

    if (roomsPage) {
        roomsPage.classList.add("hidden");
    }

    if (resultsPage) {
        resultsPage.classList.add("hidden");
    }

    if (createPage) {
        createPage.classList.remove("hidden");
    }


    setInputValue("roomId", room._id);
    setInputValue("roomName", room.name);
    setInputValue("roomDescription", room.description);
    setInputValue("roomTime", room.time);
    setInputValue("roomCategory", room.category || "General");
    setInputValue(
        "roomDifficulty",
        room.difficulty || "beginner"
    );
    setInputValue(
        "roomInstructions",
        room.instructions || ""
    );

    setInputValue(
        "completionMessage",
        room.completionMessage ||
        "Congratulations! You completed the escape room."
    );

    setInputValue(
        "maxAttempts",
        room.maxAttempts ?? ""
    );


    setCheckboxValue(
        "allowHints",
        room.allowHints !== false
    );

    setCheckboxValue(
        "showScore",
        room.showScore !== false
    );

    setCheckboxValue(
        "leaderboardEnabled",
        room.leaderboardEnabled !== false
    );


    /* ---------- Load Questions ---------- */

    const questionsContainer =
        document.getElementById("questionsContainer");

    if (questionsContainer) {
        questionsContainer.innerHTML = "";
    }

    const existingQuestions =
        Array.isArray(room.questions)
            ? room.questions
            : [];

    existingQuestions.forEach(question => {
        addQuestion(question);
    });


    updateCreatePageTitle(true);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* ==========================================================
   RESET FORM
   ========================================================== */

function resetRoomForm() {
    const form = document.getElementById("roomForm");

    if (form) {
        form.reset();
    }

    setInputValue("roomId", "");
    setInputValue("roomCategory", "General");
    setInputValue("roomDifficulty", "beginner");

    setInputValue(
        "completionMessage",
        "Congratulations! You completed the escape room."
    );

    setCheckboxValue("allowHints", true);
    setCheckboxValue("showScore", true);
    setCheckboxValue("leaderboardEnabled", true);

    const questionsContainer =
        document.getElementById("questionsContainer");

    if (questionsContainer) {
        questionsContainer.innerHTML = "";
    }

    updateCreatePageTitle(false);
}


/* ==========================================================
   DELETE ROOM
   ========================================================== */

async function deleteRoom(id) {
    const room = rooms.find(
        currentRoom => currentRoom._id === id
    );

    const roomName = room?.name || "this room";

    const confirmed = confirm(
        `Delete "${roomName}"?\n\n` +
        "This room will no longer be available to students."
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/rooms/${id}`,
            {
                method: "DELETE",
                headers: getAuthHeaders()
            }
        );

        if (handleAuthenticationError(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to delete room."
            );
        }

        alert("Escape room deleted successfully.");

        await loadRooms();

    } catch (error) {
        console.error("Delete room error:", error);
        alert(error.message);
    }
}


/* ==========================================================
   PUBLISH ROOM
   ========================================================== */

async function publishRoom(id) {
    const room = rooms.find(
        currentRoom => currentRoom._id === id
    );

    if (!room) {
        alert("Unable to find this escape room.");
        return;
    }

    const questionCount =
        Array.isArray(room.questions)
            ? room.questions.length
            : 0;

    if (questionCount === 0) {
        alert(
            "Add at least one question before publishing this room."
        );
        return;
    }

    const confirmed = confirm(
        `Publish "${room.name}"?\n\n` +
        "Students will be able to see and play this room."
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/rooms/${id}/publish`,
            {
                method: "PATCH",
                headers: getAuthHeaders()
            }
        );

        if (handleAuthenticationError(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to publish room."
            );
        }

        alert("Escape room published successfully.");

        await loadRooms();

    } catch (error) {
        console.error("Publish room error:", error);
        alert(error.message);
    }
}


/* ==========================================================
   ARCHIVE ROOM
   ========================================================== */

async function archiveRoom(id) {
    const room = rooms.find(
        currentRoom => currentRoom._id === id
    );

    const roomName = room?.name || "this room";

    const confirmed = confirm(
        `Archive "${roomName}"?\n\n` +
        "Students will no longer be able to start new attempts."
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/rooms/${id}/archive`,
            {
                method: "PATCH",
                headers: getAuthHeaders()
            }
        );

        if (handleAuthenticationError(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to archive room."
            );
        }

        alert("Escape room archived successfully.");

        await loadRooms();

    } catch (error) {
        console.error("Archive room error:", error);
        alert(error.message);
    }
}


/* ==========================================================
   QUESTION BUILDER
   ========================================================== */

function addQuestion(existingQuestion = null) {
    const questionsContainer =
        document.getElementById("questionsContainer");

    if (!questionsContainer) {
        console.error(
            "questionsContainer was not found in escaperoomcreate.html"
        );
        return;
    }

    const questionCard = document.createElement("div");
    questionCard.className = "question-card";

    const questionNumber =
        questionsContainer.children.length + 1;

    const questionType =
        existingQuestion?.questionType || "text";

    const questionText =
        existingQuestion?.questionText || "";

    const points =
        existingQuestion?.points ?? 10;

    const correctAnswer =
        existingQuestion?.correctAnswer || "";

    const hint =
        existingQuestion?.hint || "";

    const correctFeedback =
        existingQuestion?.correctFeedback || "Correct!";

    const incorrectFeedback =
        existingQuestion?.incorrectFeedback ||
        "Incorrect. Try again.";

    const options =
        Array.isArray(existingQuestion?.options)
            ? existingQuestion.options
            : [];

    const media =
        existingQuestion?.media || {};

    const mediaType =
        media.mediaType || "none";

    const mediaUrl =
        media.url || "";

    const altText =
        media.altText || "";


    questionCard.innerHTML = `
        <div class="question-header">

            <h3>
                Question
                <span class="question-number">
                    ${questionNumber}
                </span>
            </h3>

            <button
                type="button"
                class="remove-question-btn"
            >
                Remove
            </button>

        </div>


        <div class="question-grid">

            <div class="question-field full-width">

                <label>
                    Question / Puzzle *
                </label>

                <textarea
                    class="question-text"
                    maxlength="1000"
                    required
                    placeholder="Enter the question or puzzle..."
                >${escapeHtml(questionText)}</textarea>

            </div>


            <div class="question-field">

                <label>
                    Question Type
                </label>

                <select class="question-type">

                    <option
                        value="text"
                        ${questionType === "text" ? "selected" : ""}
                    >
                        Text Answer
                    </option>

                    <option
                        value="multiple-choice"
                        ${
                            questionType === "multiple-choice"
                                ? "selected"
                                : ""
                        }
                    >
                        Multiple Choice
                    </option>

                    <option
                        value="true-false"
                        ${
                            questionType === "true-false"
                                ? "selected"
                                : ""
                        }
                    >
                        True / False
                    </option>

                </select>

            </div>


            <div class="question-field">

                <label>
                    Points
                </label>

                <input
                    type="number"
                    class="question-points"
                    min="0"
                    value="${escapeHtml(points)}"
                >

            </div>


            <div class="question-options-container"></div>


            <div class="question-field correct-answer-field"></div>


            <div class="question-field">

                <label>
                    Hint
                </label>

                <textarea
                    class="question-hint"
                    maxlength="500"
                    placeholder="Optional hint for students..."
                >${escapeHtml(hint)}</textarea>

            </div>


            <div class="question-field">

                <label>
                    Correct Feedback
                </label>

                <input
                    type="text"
                    class="correct-feedback"
                    maxlength="500"
                    value="${escapeHtml(correctFeedback)}"
                >

            </div>


            <div class="question-field">

                <label>
                    Incorrect Feedback
                </label>

                <input
                    type="text"
                    class="incorrect-feedback"
                    maxlength="500"
                    value="${escapeHtml(incorrectFeedback)}"
                >

            </div>


            <div class="question-media">

                <h4>Question Media</h4>

                <p>
                    Optionally include an image, video or
                    audio resource with this question.
                </p>

                <div class="media-fields">

                    <div class="question-field">

                        <label>
                            Media Type
                        </label>

                        <select class="media-type">

                            <option
                                value="none"
                                ${mediaType === "none" ? "selected" : ""}
                            >
                                No Media
                            </option>

                            <option
                                value="image"
                                ${mediaType === "image" ? "selected" : ""}
                            >
                                Image
                            </option>

                            <option
                                value="video"
                                ${mediaType === "video" ? "selected" : ""}
                            >
                                Video
                            </option>

                            <option
                                value="audio"
                                ${mediaType === "audio" ? "selected" : ""}
                            >
                                Audio
                            </option>

                        </select>

                    </div>

                    <div class="media-dynamic-fields"></div>

                    <div class="media-preview"></div>

                </div>

            </div>

        </div>
    `;


    questionsContainer.appendChild(questionCard);


    /* ---------- References ---------- */

    const typeSelect =
        questionCard.querySelector(".question-type");

    const mediaSelect =
        questionCard.querySelector(".media-type");

    const removeButton =
        questionCard.querySelector(
            ".remove-question-btn"
        );


    /* ---------- Render Type ---------- */

    renderQuestionTypeFields(
        questionCard,
        questionType,
        {
            correctAnswer,
            options
        }
    );


    /* ---------- Render Media ---------- */

    renderMediaFields(
        questionCard,
        mediaType,
        {
            url: mediaUrl,
            altText
        }
    );


    /* ---------- Events ---------- */

    typeSelect.addEventListener("change", () => {

        renderQuestionTypeFields(
            questionCard,
            typeSelect.value
        );

    });


    mediaSelect.addEventListener("change", () => {

        renderMediaFields(
            questionCard,
            mediaSelect.value
        );

    });


    removeButton.addEventListener("click", () => {

        const confirmed = confirm(
            "Remove this question?"
        );

        if (!confirmed) {
            return;
        }

        questionCard.remove();
        renumberQuestions();

    });


    renumberQuestions();
}


/* ==========================================================
   QUESTION TYPE FIELDS
   ========================================================== */

function renderQuestionTypeFields(
    questionCard,
    questionType,
    existingData = {}
) {
    const optionsContainer =
        questionCard.querySelector(
            ".question-options-container"
        );

    const answerContainer =
        questionCard.querySelector(
            ".correct-answer-field"
        );

    if (!optionsContainer || !answerContainer) {
        return;
    }

    const existingAnswer =
        existingData.correctAnswer || "";

    const existingOptions =
        Array.isArray(existingData.options)
            ? existingData.options
            : [];


    /* ---------- Multiple Choice ---------- */

    if (questionType === "multiple-choice") {

        optionsContainer.className =
            "question-options-container options-container";

        optionsContainer.innerHTML = `
            <h4>Answer Options</h4>

            <div class="options-grid">

                ${createOptionInput(
                    1,
                    existingOptions[0] || "",
                    true
                )}

                ${createOptionInput(
                    2,
                    existingOptions[1] || "",
                    true
                )}

                ${createOptionInput(
                    3,
                    existingOptions[2] || "",
                    false
                )}

                ${createOptionInput(
                    4,
                    existingOptions[3] || "",
                    false
                )}

            </div>
        `;

        answerContainer.innerHTML = `
            <label>
                Correct Answer *
            </label>

            <input
                type="text"
                class="question-correct-answer"
                value="${escapeHtml(existingAnswer)}"
                placeholder="Enter the exact correct option"
            >
        `;

        return;
    }


    /* ---------- True / False ---------- */

    optionsContainer.className =
        "question-options-container";

    optionsContainer.innerHTML = "";

    if (questionType === "true-false") {

        const answer =
            String(existingAnswer).toLowerCase() === "false"
                ? "False"
                : "True";

        answerContainer.innerHTML = `
            <label>
                Correct Answer *
            </label>

            <select class="question-correct-answer">

                <option
                    value="True"
                    ${answer === "True" ? "selected" : ""}
                >
                    True
                </option>

                <option
                    value="False"
                    ${answer === "False" ? "selected" : ""}
                >
                    False
                </option>

            </select>
        `;

        return;
    }


    /* ---------- Text ---------- */

    answerContainer.innerHTML = `
        <label>
            Correct Answer *
        </label>

        <input
            type="text"
            class="question-correct-answer"
            value="${escapeHtml(existingAnswer)}"
            placeholder="Enter the correct answer"
        >
    `;
}


function createOptionInput(
    number,
    value,
    required
) {
    return `
        <div class="question-field">

            <label>
                Option ${number}${required ? " *" : ""}
            </label>

            <input
                type="text"
                class="question-option"
                value="${escapeHtml(value)}"
                placeholder="Option ${number}"
            >

        </div>
    `;
}


/* ==========================================================
   MEDIA
   ========================================================== */

function renderMediaFields(
    questionCard,
    mediaType,
    existingMedia = {}
) {
    const dynamicFields =
        questionCard.querySelector(
            ".media-dynamic-fields"
        );

    const preview =
        questionCard.querySelector(
            ".media-preview"
        );

    if (!dynamicFields || !preview) {
        return;
    }

    dynamicFields.innerHTML = "";
    preview.innerHTML = "";


    if (mediaType === "none") {
        return;
    }


    const url =
        existingMedia.url || "";

    const altText =
        existingMedia.altText || "";


    const label =
        mediaType === "image"
            ? "Image URL"
            : mediaType === "video"
                ? "Video URL"
                : "Audio URL";


    dynamicFields.innerHTML = `
        <div class="question-field">

            <label>
                ${label} *
            </label>

            <input
                type="url"
                class="media-url"
                value="${escapeHtml(url)}"
                placeholder="https://example.com/media"
            >

        </div>

        <div class="question-field">

            <label>
                ${
                    mediaType === "image"
                        ? "Alt Text"
                        : "Media Description"
                }
            </label>

            <input
                type="text"
                class="media-alt-text"
                value="${escapeHtml(altText)}"
                placeholder="Describe the media for accessibility"
            >

        </div>
    `;


    const urlInput =
        dynamicFields.querySelector(".media-url");

    if (urlInput) {

        urlInput.addEventListener("input", () => {
            updateMediaPreview(
                questionCard,
                mediaType,
                urlInput.value.trim()
            );
        });

    }


    if (url) {
        updateMediaPreview(
            questionCard,
            mediaType,
            url
        );
    }
}


/* ==========================================================
   MEDIA PREVIEW
   ========================================================== */

function updateMediaPreview(
    questionCard,
    mediaType,
    url
) {
    const preview =
        questionCard.querySelector(
            ".media-preview"
        );

    if (!preview) {
        return;
    }

    preview.innerHTML = "";

    if (!url) {
        return;
    }


    /* ---------- Image ---------- */

    if (mediaType === "image") {

        const image = document.createElement("img");

        image.src = url;
        image.alt = "Question media preview";

        image.onerror = () => {
            preview.innerHTML = `
                <p>
                    Image preview could not be loaded.
                    Check that the URL points directly to an image.
                </p>
            `;
        };

        preview.appendChild(image);
        return;
    }


    /* ---------- Video ---------- */

    if (mediaType === "video") {

        const youtubeId =
            getYouTubeVideoId(url);

        if (youtubeId) {

            const iframe =
                document.createElement("iframe");

            iframe.src =
                `https://www.youtube.com/embed/${youtubeId}`;

            iframe.title =
                "Question video preview";

            iframe.width = "520";
            iframe.height = "292";

            iframe.allow =
                "accelerometer; autoplay; clipboard-write; " +
                "encrypted-media; gyroscope; picture-in-picture";

            iframe.allowFullscreen = true;

            iframe.style.maxWidth = "100%";
            iframe.style.border = "0";
            iframe.style.borderRadius = "10px";

            preview.appendChild(iframe);

            return;
        }


        const video =
            document.createElement("video");

        video.src = url;
        video.controls = true;
        video.preload = "metadata";

        preview.appendChild(video);

        return;
    }


    /* ---------- Audio ---------- */

    if (mediaType === "audio") {

        const audio =
            document.createElement("audio");

        audio.src = url;
        audio.controls = true;
        audio.preload = "metadata";

        preview.appendChild(audio);
    }
}


/* ==========================================================
   YOUTUBE URL SUPPORT
   ========================================================== */

function getYouTubeVideoId(url) {
    if (!url) {
        return null;
    }

    try {
        const parsedUrl = new URL(url);

        if (
            parsedUrl.hostname === "youtu.be" ||
            parsedUrl.hostname === "www.youtu.be"
        ) {
            return parsedUrl.pathname
                .replace("/", "")
                .split("/")[0];
        }

        if (
            parsedUrl.hostname.includes("youtube.com")
        ) {
            if (parsedUrl.pathname === "/watch") {
                return parsedUrl.searchParams.get("v");
            }

            if (
                parsedUrl.pathname.startsWith("/embed/")
            ) {
                return parsedUrl.pathname
                    .split("/embed/")[1]
                    ?.split("/")[0];
            }

            if (
                parsedUrl.pathname.startsWith("/shorts/")
            ) {
                return parsedUrl.pathname
                    .split("/shorts/")[1]
                    ?.split("/")[0];
            }
        }

    } catch (error) {
        return null;
    }

    return null;
}


/* ==========================================================
   COLLECT QUESTIONS
   ========================================================== */

function collectQuestions() {
    const questionCards =
        document.querySelectorAll(".question-card");

    const questions = [];


    questionCards.forEach(
        (card, index) => {

            const questionText =
                card.querySelector(
                    ".question-text"
                )?.value.trim() || "";

            const questionType =
                card.querySelector(
                    ".question-type"
                )?.value || "text";

            const correctAnswer =
                card.querySelector(
                    ".question-correct-answer"
                )?.value.trim() || "";

            const points = Number(
                card.querySelector(
                    ".question-points"
                )?.value || 10
            );

            const hint =
                card.querySelector(
                    ".question-hint"
                )?.value.trim() || "";

            const correctFeedback =
                card.querySelector(
                    ".correct-feedback"
                )?.value.trim() ||
                "Correct!";

            const incorrectFeedback =
                card.querySelector(
                    ".incorrect-feedback"
                )?.value.trim() ||
                "Incorrect. Try again.";

            const mediaType =
                card.querySelector(
                    ".media-type"
                )?.value || "none";


            /* ---------- Validation ---------- */

            if (!questionText) {
                throw new Error(
                    `Question ${index + 1}: ` +
                    "Please enter the question text."
                );
            }

            if (!correctAnswer) {
                throw new Error(
                    `Question ${index + 1}: ` +
                    "Please enter the correct answer."
                );
            }

            if (
                Number.isNaN(points) ||
                points < 0
            ) {
                throw new Error(
                    `Question ${index + 1}: ` +
                    "Points cannot be negative."
                );
            }


            /* ---------- Options ---------- */

            let options = [];

            if (
                questionType === "multiple-choice"
            ) {

                options = Array.from(
                    card.querySelectorAll(
                        ".question-option"
                    )
                )
                    .map(input => input.value.trim())
                    .filter(Boolean);


                if (options.length < 2) {
                    throw new Error(
                        `Question ${index + 1}: ` +
                        "Multiple-choice questions require " +
                        "at least two options."
                    );
                }


                const matchingOption =
                    options.some(
                        option =>
                            option.toLowerCase() ===
                            correctAnswer.toLowerCase()
                    );

                if (!matchingOption) {
                    throw new Error(
                        `Question ${index + 1}: ` +
                        "The correct answer must exactly match " +
                        "one of the multiple-choice options."
                    );
                }
            }


            /* ---------- Media ---------- */

            let mediaUrl = "";
            let mediaAltText = "";

            if (mediaType !== "none") {

                mediaUrl =
                    card.querySelector(
                        ".media-url"
                    )?.value.trim() || "";

                mediaAltText =
                    card.querySelector(
                        ".media-alt-text"
                    )?.value.trim() || "";

                if (!mediaUrl) {
                    throw new Error(
                        `Question ${index + 1}: ` +
                        `Please enter the ${mediaType} URL.`
                    );
                }

                if (!isValidHttpUrl(mediaUrl)) {
                    throw new Error(
                        `Question ${index + 1}: ` +
                        "Please enter a valid media URL."
                    );
                }
            }


            /* ---------- Question Object ---------- */

            questions.push({
                questionText,
                questionType,
                options,
                correctAnswer,
                hint,
                correctFeedback,
                incorrectFeedback,
                points,
                order: index,
                media: {
                    mediaType,
                    url: mediaUrl,
                    altText: mediaAltText
                }
            });

        }
    );


    return questions;
}


/* ==========================================================
   RENUMBER QUESTIONS
   ========================================================== */

function renumberQuestions() {
    const cards =
        document.querySelectorAll(".question-card");

    cards.forEach(
        (card, index) => {

            const number =
                card.querySelector(
                    ".question-number"
                );

            if (number) {
                number.textContent =
                    String(index + 1);
            }

        }
    );
}


/* ==========================================================
   EDUCATOR STUDENT RESULTS
   ========================================================== */

let educatorResultsRequest = 0;

async function displayResults() {
    const container = document.getElementById("resultsList");
    if (!container) return;
    const request = ++educatorResultsRequest;
    const isCurrent = () => request === educatorResultsRequest;
    container.innerHTML = '<div class="educator-result-card" role="status">Loading student results…</div>';

    try {
        // Refresh the room list so newly created and archived rooms are included.
        const response = await fetch(`${API_BASE_URL}/rooms/educator/my-rooms`, {
            headers: getAuthHeaders()
        });
        if (!isCurrent()) return;
        if (handleAuthenticationError(response)) {
            container.innerHTML = '<p role="alert">Unable to access student results.</p>';
            return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to retrieve educator rooms.");
        if (!Array.isArray(data.rooms)) throw new Error("The room list response is incomplete. Please try again.");
        const resultRooms = data.rooms;
        if (!isCurrent()) return;
        if (!resultRooms.length) {
            container.innerHTML = '<div class="educator-result-card"><h3>No Escape Rooms Yet</h3><p>Create an escape room to start collecting student results.</p></div>';
            return;
        }

        let authenticationFailed = false;
        const roomResults = await Promise.all(resultRooms.map(async room => {
            try {
                const resultResponse = await fetch(
                    `${API_BASE_URL}/attempts/room/${encodeURIComponent(room._id)}/results`,
                    { headers: getAuthHeaders() }
                );
                if (!isCurrent()) return null;
                if (resultResponse.status === 401) {
                    if (!authenticationFailed) handleAuthenticationError(resultResponse);
                    authenticationFailed = true;
                    return null;
                }
                const result = await resultResponse.json();
                if (!resultResponse.ok) throw new Error(result.message || "Unable to retrieve results.");
                if (!Array.isArray(result.results)) throw new Error("The results response is incomplete.");
                return { ...result, room: result.room || room };
            } catch (error) {
                return { room, error: error.message || "Unable to retrieve results." };
            }
        }));
        if (!isCurrent()) return;
        if (authenticationFailed) {
            container.innerHTML = '<p role="alert">Your session has expired. Please log in again.</p>';
            return;
        }
        renderEducatorResults(roomResults);
    } catch (error) {
        if (!isCurrent()) return;
        container.innerHTML = `<div class="educator-result-card" role="alert"><h3>Unable to Load Student Results</h3><p>${escapeHtml(error.message)}</p><button type="button" onclick="displayResults()">Try Again</button></div>`;
    }
}

function resultNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function resultPercentage(result) {
    const maximum = resultNumber(result.maximumScore);
    return resultNumber(result.scorePercentage,
        maximum > 0 ? resultNumber(result.score) / maximum * 100 : 0);
}

function renderEducatorResults(roomResults) {
    const container = document.getElementById("resultsList");
    if (!container) return;
    const successful = roomResults.filter(result => result && !result.error);
    const failures = roomResults.filter(result => result && result.error);
    const attempts = successful.flatMap(result => result.results);
    const completed = attempts.filter(result => result.status === "completed");
    // Average individual completed attempts, avoiding averages of rounded room averages.
    const average = completed.length
        ? Math.round(completed.reduce((sum, result) => sum + resultPercentage(result), 0) / completed.length)
        : 0;
    let html = `<div class="educator-results-summary" style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:24px">
        <div class="room-stat room-stat-card"><span>Total Attempts</span><strong>${attempts.length}</strong></div>
        <div class="room-stat room-stat-card"><span>Completed</span><strong>${completed.length}</strong></div>
        <div class="room-stat room-stat-card"><span>Average Score</span><strong>${average}%</strong></div>
        </div><p>Average score includes completed attempts only.</p>`;
    if (!successful.length) html = "";
    if (failures.length) {
        html += `<p role="alert">${successful.length ? "Partial results: totals include only rooms loaded successfully." : "Results could not be loaded for any room; totals are unavailable."} ${failures.length} room(s) failed to load.</p><button type="button" onclick="displayResults()">Retry Results</button>`;
    } else if (!attempts.length) {
        html += '<p>No student attempts yet. Results will appear after students begin playing your rooms.</p>';
    }
    for (const roomResult of roomResults) {
        if (!roomResult) continue;
        html += `<section class="educator-room-results" style="margin-top:24px"><h3>${escapeHtml(roomResult.room?.name || "Escape Room")}</h3>`;
        if (roomResult.error) {
            html += `<p>${escapeHtml(roomResult.error)}</p></section>`;
            continue;
        }
        const results = roomResult.results;
        const roomCompleted = results.filter(result => result.status === "completed");
        const stats = roomResult.statistics || {};
        const roomAverage = roomCompleted.length
            ? Math.round(roomCompleted.reduce((sum, result) => sum + resultPercentage(result), 0) / roomCompleted.length) : 0;
        html += `<p>${resultNumber(stats.totalAttempts, results.length)} total attempts · ${resultNumber(stats.completedAttempts, roomCompleted.length)} completed · ${resultNumber(stats.averageScorePercentage, roomAverage)}% average</p>`;
        if (!results.length) {
            html += '<p>No students have attempted this room yet.</p></section>';
            continue;
        }
        html += '<div class="educator-results-table-wrapper" style="overflow-x:auto"><table class="educator-results-table" style="width:100%;text-align:left;border-spacing:12px"><thead><tr><th scope="col">Student</th><th scope="col">Attempt</th><th scope="col">Score</th><th scope="col">Percentage</th><th scope="col">Status</th><th scope="col">Hints</th><th scope="col">Completed</th></tr></thead><tbody>';
        for (const result of results) {
            const status = result.status || "unknown";
            const statusClass = ["completed", "in-progress", "abandoned", "failed"].includes(status) ? status : "unknown";
            html += `<tr>
                <td><strong>${escapeHtml(result.student?.name || "Unknown Student")}</strong><small class="student-result-email" style="display:block">${escapeHtml(result.student?.email || "")}</small></td>
                <td>#${resultNumber(result.attemptNumber, 1)}</td>
                <td>${resultNumber(result.score)}/${resultNumber(result.maximumScore)}</td>
                <td>${Math.round(resultPercentage(result) * 100) / 100}%</td>
                <td><span class="result-status ${statusClass}">${escapeHtml(formatLabel(status))}</span></td>
                <td>${resultNumber(result.hintsUsed)}</td>
                <td>${escapeHtml(formatResultDate(result.completedAt))}</td>
                </tr>`;
        }
        html += '</tbody></table></div></section>';
    }
    container.innerHTML = html;
}

function formatResultDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-AU", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

// Current HTML IDs take precedence; older pages remain supported.
function getRoomFormElement(id) {
    const currentIds = {
        completionMessage: "roomCompletionMessage",
        maxAttempts: "roomMaxAttempts",
        allowHints: "roomAllowHints",
        showScore: "roomShowScore",
        leaderboardEnabled: "roomLeaderboardEnabled",
        addQuestionButton: "addQuestionBtn"
    };
    return document.getElementById(currentIds[id] || id) || document.getElementById(id);
}

/* ==========================================================
   PAGE TITLE
   ========================================================== */

function updateCreatePageTitle(isEditing) {
    const createPage =
        document.getElementById("createPage");

    if (!createPage) {
        return;
    }

    const heading =
        createPage.querySelector(
            "h2"
        );

    if (heading) {
        heading.textContent =
            isEditing
                ? "Edit Escape Room"
                : "Create Escape Room";
    }

    const submitButton =
        document.querySelector(
            '#roomForm button[type="submit"]'
        );

    if (submitButton) {
        submitButton.textContent =
            isEditing
                ? "Save Changes"
                : "Save Room";

        submitButton.classList.add(
            "save-room-btn"
        );
    }
}


/* ==========================================================
   HTML ENHANCEMENTS
   ========================================================== */

function enhanceExistingHTML() {
    const body = document.body;

    if (body) {
        body.classList.add("educator-page");
    }


    /*
        Give the main page container the educator-main
        class without requiring a full HTML rewrite.
    */
    const possibleMain =
        document.querySelector("main");

    if (possibleMain) {
        possibleMain.classList.add(
            "educator-main"
        );
    }


    /* ---------- Main navigation buttons ---------- */

    document.querySelectorAll(
        'button[onclick*="showPage"]'
    ).forEach(button => {

        button.classList.add(
            "educator-action-btn"
        );

        if (
            button.textContent
                .toLowerCase()
                .includes("create")
        ) {
            button.classList.add("primary");
        }

    });


    /* ---------- Add Question ---------- */

    const addQuestionButton =
        getRoomFormElement("addQuestionButton") || document.querySelector(
            'button[onclick*="addQuestion"]'
        );

    if (addQuestionButton) {
        addQuestionButton.classList.add(
            "add-question-btn"
        );
    }


    /* ---------- Form ---------- */

    const form =
        document.getElementById("roomForm");

    if (form) {

        const submitButton =
            form.querySelector(
                'button[type="submit"]'
            );

        if (submitButton) {
            submitButton.classList.add(
                "save-room-btn"
            );
        }

        const buttons =
            form.querySelectorAll("button");

        buttons.forEach(button => {

            if (
                button.type !== "submit" &&
                button.textContent
                    .toLowerCase()
                    .includes("cancel")
            ) {
                button.classList.add(
                    "cancel-room-btn"
                );
            }

        });

    }
}


/* ==========================================================
   HELPERS
   ========================================================== */

function setInputValue(id, value) {
    const element =
        getRoomFormElement(id);

    if (element) {
        element.value =
            value ?? "";
    }
}


function setCheckboxValue(id, checked) {
    const element =
        getRoomFormElement(id);

    if (element) {
        element.checked = Boolean(checked);
    }
}


function formatLabel(value) {
    if (!value) {
        return "";
    }

    return String(value)
        .replace(/-/g, " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );
}


function isValidHttpUrl(value) {
    try {
        const url = new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );

    } catch (error) {
        return false;
    }
}


function escapeHtml(value) {
    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ==========================================================
   STARTUP
   ========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if (!checkEducatorAuthentication()) {
            return;
        }

        enhanceExistingHTML();


        /* ---------- Room Form ---------- */

        const roomForm =
            document.getElementById("roomForm");

        if (roomForm) {
            roomForm.addEventListener(
                "submit",
                saveRoom
            );
        }


        /* ---------- Add Question Button ---------- */

        const addQuestionButton =
            getRoomFormElement("addQuestionButton");

        /*
            Only attach this event when the HTML button
            does not already use inline onclick.
        */
        if (
            addQuestionButton &&
            !addQuestionButton.getAttribute("onclick")
        ) {
            addQuestionButton.addEventListener(
                "click",
                () => addQuestion()
            );
        }


        /* ---------- Initial Page ---------- */

        const roomsPage =
            document.getElementById("roomsPage");

        const createPage =
            document.getElementById("createPage");

        const resultsPage =
            document.getElementById("resultsPage");

        if (roomsPage) {
            roomsPage.classList.remove("hidden");
        }

        if (createPage) {
            createPage.classList.add("hidden");
        }

        if (resultsPage) {
            resultsPage.classList.add("hidden");
        }

        loadRooms();

    }
);


/* ==========================================================
   GLOBAL FUNCTIONS
   Required because some HTML buttons use onclick=""
   ========================================================== */

window.showPage = showPage;
window.addQuestion = addQuestion;
window.editRoom = editRoom;
window.deleteRoom = deleteRoom;
window.publishRoom = publishRoom;
window.archiveRoom = archiveRoom;
window.prepareCreateRoom = prepareCreateRoom;
window.saveRoom = saveRoom;
window.displayResults = displayResults;
