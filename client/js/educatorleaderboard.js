"use strict";

/* ==========================================================
   FEDESCAPE — EDUCATOR STUDENT LEADERBOARD
   ========================================================== */

const EDUCATOR_LEADERBOARD_API_BASE_URL =
    "http://localhost:5000/api";

let educatorRooms = [];
let selectedRoomId = "";


/* ==========================================================
   PAGE INITIALISATION
   ========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupLogout();
        setupRoomSelector();
        setupRetryButton();

        const authenticated =
            checkEducatorAuthentication();

        if (!authenticated) {
            return;
        }

        await loadEducatorRooms();
    }
);


/* ==========================================================
   AUTHENTICATION
   ========================================================== */

function getToken() {

    return localStorage.getItem(
        "fedEscapeToken"
    );
}


function getUserRole() {

    return localStorage.getItem(
        "fedEscapeUserRole"
    );
}


function getAuthHeaders() {

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    };
}


function checkEducatorAuthentication() {

    const token = getToken();
    const role = getUserRole();

    if (!token) {

        alert(
            "Please log in to view the educator leaderboard."
        );

        window.location.href =
            "login.html";

        return false;
    }


    if (
        role &&
        role !== "educator"
    ) {

        alert(
            "Educator access is required."
        );

        window.location.href =
            "dashboard.html";

        return false;
    }


    return true;
}


function handleAuthenticationError(response) {

    if (response.status === 401) {

        alert(
            "Your session has expired. Please log in again."
        );

        clearAuthentication();

        window.location.href =
            "login.html";

        return true;
    }


    if (response.status === 403) {

        alert(
            "You do not have permission to access this resource."
        );

        return true;
    }


    return false;
}


/* ==========================================================
   LOAD EDUCATOR ROOMS
   GET /api/rooms/educator/my-rooms
   ========================================================== */

async function loadEducatorRooms() {

    const select =
        document.getElementById(
            "leaderboardRoomSelect"
        );

    if (!select) {
        return;
    }


    select.disabled = true;

    select.innerHTML = `
        <option value="">
            Loading your rooms...
        </option>
    `;


    hideError();
    hideEmptyState();
    hideLeaderboard();
    hideSummary();
    hideRoomInfo();


    try {

        const response = await fetch(
            `${EDUCATOR_LEADERBOARD_API_BASE_URL}/rooms/educator/my-rooms`,
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );


        if (handleAuthenticationError(response)) {
            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load your escape rooms."
            );
        }


        educatorRooms =
            Array.isArray(data.rooms)
                ? data.rooms
                : [];


        populateRoomSelector();


    } catch (error) {

        console.error(
            "Unable to load educator rooms:",
            error
        );


        select.innerHTML = `
            <option value="">
                Unable to load rooms
            </option>
        `;


        showError(
            error.message ||
            "Unable to load your escape rooms."
        );
    }
}


/* ==========================================================
   POPULATE ROOM SELECTOR
   ========================================================== */

function populateRoomSelector() {

    const select =
        document.getElementById(
            "leaderboardRoomSelect"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select an escape room
        </option>
    `;


    if (educatorRooms.length === 0) {

        select.disabled = true;

        showInitialMessage(
            "No escape rooms available",
            "Create an escape room before viewing student leaderboard results."
        );

        return;
    }


    educatorRooms.forEach(
        room => {

            if (!room || !room._id) {
                return;
            }


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                room._id;


            const roomName =
                room.name ||
                "Escape Room";


            const status =
                room.status
                    ? ` (${formatLabel(room.status)})`
                    : "";


            option.textContent =
                `${roomName}${status}`;


            select.appendChild(
                option
            );
        }
    );


    select.disabled = false;


    showInitialMessage(
        "Select an escape room",
        "Choose one of your rooms above to view its student leaderboard."
    );
}


/* ==========================================================
   ROOM SELECTOR
   ========================================================== */

function setupRoomSelector() {

    const select =
        document.getElementById(
            "leaderboardRoomSelect"
        );


    if (!select) {
        return;
    }


    select.addEventListener(
        "change",
        async () => {

            selectedRoomId =
                select.value;


            if (!selectedRoomId) {

                hideLeaderboard();
                hideSummary();
                hideRoomInfo();
                hideEmptyState();
                hideError();

                showInitialMessage(
                    "Select an escape room",
                    "Choose one of your rooms above to view its student leaderboard."
                );

                return;
            }


            const room =
                educatorRooms.find(
                    currentRoom =>
                        currentRoom._id ===
                        selectedRoomId
                );


            showSelectedRoom(
                room
            );


            await loadLeaderboard(
                selectedRoomId
            );
        }
    );
}


/* ==========================================================
   SHOW SELECTED ROOM INFORMATION
   ========================================================== */

function showSelectedRoom(room) {

    const container =
        document.getElementById(
            "leaderboardRoomInfo"
        );


    const nameElement =
        document.getElementById(
            "leaderboardRoomName"
        );


    const descriptionElement =
        document.getElementById(
            "leaderboardRoomDescription"
        );


    if (
        !container ||
        !nameElement ||
        !descriptionElement
    ) {

        return;
    }


    if (!room) {

        container.hidden = true;
        return;
    }


    nameElement.textContent =
        room.name ||
        "Escape Room";


    descriptionElement.textContent =
        room.description ||
        "No room description available.";


    container.hidden = false;
}


/* ==========================================================
   LOAD LEADERBOARD

   GET /api/attempts/room/:roomId/leaderboard
   ========================================================== */

async function loadLeaderboard(roomId) {

    if (!roomId) {
        return;
    }


    selectedRoomId =
        roomId;


    showLoading();

    hideError();
    hideEmptyState();
    hideLeaderboard();
    hideSummary();
    hideInitialState();


    try {

        const response = await fetch(
            `${EDUCATOR_LEADERBOARD_API_BASE_URL}/attempts/room/${encodeURIComponent(roomId)}/leaderboard`,
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );


        if (handleAuthenticationError(response)) {

            hideLoading();
            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load this leaderboard."
            );
        }


        const entries =
            extractLeaderboardArray(
                data
            );


        console.log(
            "Educator leaderboard loaded:",
            entries
        );


        hideLoading();


        if (entries.length === 0) {

            showEmptyState();
            return;
        }


        renderLeaderboard(
            entries
        );


    } catch (error) {

        console.error(
            "Unable to load educator leaderboard:",
            error
        );


        hideLoading();


        showError(
            error.message ||
            "Unable to load this leaderboard."
        );
    }
}


/* ==========================================================
   EXTRACT LEADERBOARD ARRAY
   ========================================================== */

function extractLeaderboardArray(data) {

    if (
        Array.isArray(data)
    ) {

        return data;
    }


    if (
        Array.isArray(
            data.leaderboard
        )
    ) {

        return data.leaderboard;
    }


    if (
        Array.isArray(
            data.results
        )
    ) {

        return data.results;
    }


    return [];
}


/* ==========================================================
   RENDER LEADERBOARD
   ========================================================== */

function renderLeaderboard(entries) {

    const tableWrapper =
        document.getElementById(
            "leaderboardTableWrapper"
        );


    const tableBody =
        document.getElementById(
            "educatorLeaderboardBody"
        );


    if (
        !tableWrapper ||
        !tableBody
    ) {

        return;
    }


    tableBody.innerHTML =
        "";


    if (
        !Array.isArray(entries) ||
        entries.length === 0
    ) {

        showEmptyState();
        return;
    }


    entries.forEach(
        (entry, index) => {

            const row =
                document.createElement(
                    "tr"
                );


            const rank =
                Number(
                    entry.rank ||
                    index + 1
                );


            const studentName =
                getStudentName(
                    entry
                );


            const studentEmail =
                getStudentEmail(
                    entry
                );


            const score =
                resultNumber(
                    entry.score
                );


            const maximumScore =
                resultNumber(
                    entry.maximumScore
                );


            const scoreText =
                maximumScore > 0
                    ? `${score} / ${maximumScore}`
                    : String(score);


            const percentage =
                getScorePercentage(
                    entry
                );


            const duration =
                getAttemptDuration(
                    entry
                );


            const rankDisplay =
                getRankDisplay(
                    rank
                );


            row.innerHTML = `

                <td>
                    <strong class="leaderboard-rank">
                        ${escapeHTML(rankDisplay)}
                    </strong>
                </td>

                <td>

                    <strong>
                        ${escapeHTML(studentName)}
                    </strong>

                    ${
                        studentEmail
                            ? `
                                <small
                                    class="student-result-email"
                                    style="display:block"
                                >
                                    ${escapeHTML(studentEmail)}
                                </small>
                            `
                            : ""
                    }

                </td>

                <td>
                    <strong>
                        ${escapeHTML(scoreText)}
                    </strong>
                </td>

                <td>
                    ${percentage}%
                </td>

                <td>
                    ${escapeHTML(
                        formatCompletionTime(
                            duration
                        )
                    )}
                </td>

            `;


            tableBody.appendChild(
                row
            );
        }
    );


    tableWrapper.hidden =
        false;


    renderLeaderboardSummary(
        entries
    );
}


/* ==========================================================
   LEADERBOARD SUMMARY
   ========================================================== */

function renderLeaderboardSummary(entries) {

    const summary =
        document.getElementById(
            "leaderboardSummary"
        );


    const studentCount =
        document.getElementById(
            "leaderboardStudentCount"
        );


    const highestScore =
        document.getElementById(
            "leaderboardHighestScore"
        );


    const highestPercentage =
        document.getElementById(
            "leaderboardHighestPercentage"
        );


    if (
        !summary ||
        !studentCount ||
        !highestScore ||
        !highestPercentage
    ) {

        return;
    }


    if (
        !entries ||
        entries.length === 0
    ) {

        summary.hidden =
            true;

        return;
    }


    const topEntry =
        entries[0];


    const topScore =
        resultNumber(
            topEntry.score
        );


    const topMaximumScore =
        resultNumber(
            topEntry.maximumScore
        );


    studentCount.textContent =
        String(
            entries.length
        );


    highestScore.textContent =
        topMaximumScore > 0
            ? `${topScore} / ${topMaximumScore}`
            : String(topScore);


    highestPercentage.textContent =
        `${getScorePercentage(topEntry)}%`;


    summary.hidden =
        false;
}


/* ==========================================================
   STUDENT INFORMATION
   ========================================================== */

function getStudentName(entry) {

    if (
        entry.student &&
        typeof entry.student === "object"
    ) {

        return (
            entry.student.name ||
            entry.student.email ||
            "Student"
        );
    }


    return (
        entry.studentName ||
        entry.studentId ||
        "Student"
    );
}


function getStudentEmail(entry) {

    if (
        entry.student &&
        typeof entry.student === "object"
    ) {

        return (
            entry.student.email ||
            ""
        );
    }


    return (
        entry.studentEmail ||
        ""
    );
}


/* ==========================================================
   SCORE PERCENTAGE
   ========================================================== */

function getScorePercentage(entry) {

    if (
        entry.scorePercentage !== undefined &&
        entry.scorePercentage !== null
    ) {

        return Math.round(
            Number(
                entry.scorePercentage
            ) || 0
        );
    }


    const score =
        resultNumber(
            entry.score
        );


    const maximumScore =
        resultNumber(
            entry.maximumScore
        );


    if (
        maximumScore <= 0
    ) {

        return 0;
    }


    return Math.round(
        (
            score /
            maximumScore
        ) * 100
    );
}


/* ==========================================================
   ATTEMPT DURATION
   ========================================================== */

function getAttemptDuration(entry) {

    if (
        entry.durationSeconds !== undefined &&
        entry.durationSeconds !== null
    ) {

        return resultNumber(
            entry.durationSeconds
        );
    }


    if (
        entry.startedAt &&
        entry.completedAt
    ) {

        const start =
            new Date(
                entry.startedAt
            );


        const end =
            new Date(
                entry.completedAt
            );


        if (
            !Number.isNaN(
                start.getTime()
            ) &&
            !Number.isNaN(
                end.getTime()
            )
        ) {

            return Math.max(
                0,
                Math.round(
                    (
                        end.getTime() -
                        start.getTime()
                    ) / 1000
                )
            );
        }
    }


    return 0;
}


/* ==========================================================
   FORMAT COMPLETION TIME
   ========================================================== */

function formatCompletionTime(totalSeconds) {

    totalSeconds =
        Math.max(
            0,
            Math.round(
                Number(
                    totalSeconds
                ) || 0
            )
        );


    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    const minutes =
        Math.floor(
            (
                totalSeconds % 3600
            ) / 60
        );


    const seconds =
        totalSeconds % 60;


    if (
        hours > 0
    ) {

        return (
            String(hours).padStart(
                2,
                "0"
            )
            +
            ":"
            +
            String(minutes).padStart(
                2,
                "0"
            )
            +
            ":"
            +
            String(seconds).padStart(
                2,
                "0"
            )
        );
    }


    return (
        String(minutes).padStart(
            2,
            "0"
        )
        +
        ":"
        +
        String(seconds).padStart(
            2,
            "0"
        )
    );
}


/* ==========================================================
   RANK DISPLAY
   ========================================================== */

function getRankDisplay(rank) {

    if (rank === 1) {
        return "🥇 1";
    }


    if (rank === 2) {
        return "🥈 2";
    }


    if (rank === 3) {
        return "🥉 3";
    }


    return String(rank);
}


/* ==========================================================
   NUMBER HELPER
   ========================================================== */

function resultNumber(
    value,
    fallback = 0
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;
    }


    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : fallback;
}


/* ==========================================================
   PAGE STATES
   ========================================================== */

function showLoading() {

    const element =
        document.getElementById(
            "leaderboardLoading"
        );


    if (element) {

        element.hidden =
            false;
    }
}


function hideLoading() {

    const element =
        document.getElementById(
            "leaderboardLoading"
        );


    if (element) {

        element.hidden =
            true;
    }
}


function showEmptyState() {

    hideLeaderboard();
    hideSummary();
    hideInitialState();
    hideError();


    const element =
        document.getElementById(
            "leaderboardEmpty"
        );


    if (element) {

        element.hidden =
            false;
    }
}


function hideEmptyState() {

    const element =
        document.getElementById(
            "leaderboardEmpty"
        );


    if (element) {

        element.hidden =
            true;
    }
}


function showError(message) {

    hideLoading();
    hideLeaderboard();
    hideSummary();
    hideInitialState();
    hideEmptyState();


    const container =
        document.getElementById(
            "leaderboardError"
        );


    const messageElement =
        document.getElementById(
            "leaderboardErrorMessage"
        );


    if (messageElement) {

        messageElement.textContent =
            message;
    }


    if (container) {

        container.hidden =
            false;
    }
}


function hideError() {

    const element =
        document.getElementById(
            "leaderboardError"
        );


    if (element) {

        element.hidden =
            true;
    }
}


function hideLeaderboard() {

    const wrapper =
        document.getElementById(
            "leaderboardTableWrapper"
        );


    const body =
        document.getElementById(
            "educatorLeaderboardBody"
        );


    if (wrapper) {

        wrapper.hidden =
            true;
    }


    if (body) {

        body.innerHTML =
            "";
    }
}


function hideSummary() {

    const element =
        document.getElementById(
            "leaderboardSummary"
        );


    if (element) {

        element.hidden =
            true;
    }
}


function hideRoomInfo() {

    const element =
        document.getElementById(
            "leaderboardRoomInfo"
        );


    if (element) {

        element.hidden =
            true;
    }
}


/* ==========================================================
   INITIAL STATE
   ========================================================== */

function showInitialMessage(
    title,
    message
) {

    hideLoading();
    hideLeaderboard();
    hideSummary();
    hideEmptyState();
    hideError();


    const container =
        document.getElementById(
            "leaderboardInitial"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `

        <strong>
            ${escapeHTML(title)}
        </strong>

        <p>
            ${escapeHTML(message)}
        </p>

    `;


    container.hidden =
        false;
}


function hideInitialState() {

    const element =
        document.getElementById(
            "leaderboardInitial"
        );


    if (element) {

        element.hidden =
            true;
    }
}


/* ==========================================================
   RETRY
   ========================================================== */

function setupRetryButton() {

    const button =
        document.getElementById(
            "leaderboardRetryButton"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            if (selectedRoomId) {

                await loadLeaderboard(
                    selectedRoomId
                );

                return;
            }


            await loadEducatorRooms();
        }
    );
}


/* ==========================================================
   LOGOUT
   ========================================================== */

function setupLogout() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (!logoutButton) {
        return;
    }


    logoutButton.addEventListener(
        "click",
        event => {

            event.preventDefault();

            clearAuthentication();

            window.location.href =
                "login.html";
        }
    );
}


function clearAuthentication() {

    localStorage.removeItem(
        "fedEscapeToken"
    );

    localStorage.removeItem(
        "fedEscapeLoggedIn"
    );

    localStorage.removeItem(
        "fedEscapeUserId"
    );

    localStorage.removeItem(
        "fedEscapeUserName"
    );

    localStorage.removeItem(
        "fedEscapeUserEmail"
    );

    localStorage.removeItem(
        "fedEscapeUserRole"
    );

    localStorage.removeItem(
        "fedEscapeAttemptId"
    );
}


/* ==========================================================
   FORMAT LABEL
   ========================================================== */

function formatLabel(value) {

    return String(
        value || ""
    )
        .replace(
            /[-_]+/g,
            " "
        )
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );
}


/* ==========================================================
   ESCAPE HTML
   ========================================================== */

function escapeHTML(value) {

    const element =
        document.createElement(
            "div"
        );


    element.textContent =
        String(
            value ?? ""
        );


    return element.innerHTML;
}