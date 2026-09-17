"use strict";


// ======================================================
// FedEscape Student Results
// Backend + MongoDB version
// ======================================================

const RESULTS_API_BASE_URL =
    "http://localhost:5000/api";


let studentResults = [];


// ======================================================
// PAGE INITIALISATION
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const resultsTableBody =
            document.getElementById(
                "resultsTableBody"
            );


        // results.js should only execute its results
        // functionality on results.html.
        if (!resultsTableBody) {

            return;
        }


        setupLogout();


        const authenticated =
            checkStudentAuthentication();


        if (!authenticated) {

            return;
        }


        setupLeaderboardSelector();


        await loadStudentResults();
    }
);


// ======================================================
// CHECK LOGIN
// ======================================================

function checkStudentAuthentication() {

    const token =
        localStorage.getItem(
            "fedEscapeToken"
        );


    const role =
        localStorage.getItem(
            "fedEscapeUserRole"
        );


    if (!token) {

        alert(
            "Please log in to view your results."
        );


        window.location.href =
            "login.html";


        return false;
    }


    if (
        role &&
        role !== "student"
    ) {

        alert(
            "Student results are only available to student accounts."
        );


        window.location.href =
            "index.html";


        return false;
    }


    return true;
}


// ======================================================
// LOAD STUDENT RESULTS
//
// GET /api/attempts/my-results
// ======================================================

async function loadStudentResults() {

    const token =
        localStorage.getItem(
            "fedEscapeToken"
        );


    showLoadingState();


    try {

        const response = await fetch(
            `${RESULTS_API_BASE_URL}/attempts/my-results`,
            {
                method: "GET",

                headers: {

                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "Unable to load student results:",
                data
            );


            showResultsError(
                data.message ||
                "Unable to load your results."
            );


            return;
        }


        // --------------------------------------------------
        // Support the backend response safely.
        //
        // Expected response contains an array of attempts.
        // --------------------------------------------------

        studentResults =
            extractResultsArray(
                data
            );


        console.log(
            "Student results loaded from MongoDB:",
            studentResults
        );


        hideLoadingState();


        renderProgressSummary(
            studentResults
        );


        renderResultsTable(
            studentResults
        );


        populateLeaderboardRooms(
            studentResults
        );

    } catch (error) {

        console.error(
            "Student results request failed:",
            error
        );


        showResultsError(
            "Unable to connect to the FedEscape server."
        );
    }
}


// ======================================================
// EXTRACT RESULTS ARRAY
//
// Allows for common backend response names without
// changing the backend.
// ======================================================

function extractResultsArray(data) {

    if (
        Array.isArray(data)
    ) {

        return data;
    }


    if (
        Array.isArray(
            data.results
        )
    ) {

        return data.results;
    }


    if (
        Array.isArray(
            data.attempts
        )
    ) {

        return data.attempts;
    }


    return [];
}


// ======================================================
// COMPLETED RESULTS ONLY
// ======================================================

function getCompletedResults(results) {

    return results.filter(
        (result) => {

            const status =
                String(
                    result.status || ""
                ).toLowerCase();


            return (
                status === "completed" ||
                Boolean(
                    result.completedAt
                )
            );
        }
    );
}


// ======================================================
// PROGRESS SUMMARY
// ======================================================

function renderProgressSummary(results) {

    const completed = getCompletedResults(results);

    // Completed Attempts
    const completedAttempts = completed.length;

    // Total Score
    const totalScore = completed.reduce(
        (total, result) => {
            return total + Number(result.score || 0);
        },
        0
    );

    // Best Percentage
    let bestPercentage = 0;

    completed.forEach((result) => {

        const percentage = getScorePercentage(result);

        if (percentage > bestPercentage) {
            bestPercentage = percentage;
        }
    });

    // Find the HTML elements
    const roomsCompletedElement =
        document.getElementById("roomsCompleted");

    const totalScoreElement =
        document.getElementById("totalScore");

    const bestPercentageElement =
        document.getElementById("bestPercentage");

    // Update the page
    if (roomsCompletedElement) {
        roomsCompletedElement.textContent = completedAttempts;
    }

    if (totalScoreElement) {
        totalScoreElement.textContent = totalScore;
    }

    if (bestPercentageElement) {
        bestPercentageElement.textContent = `${bestPercentage}%`;
    }

    console.log("Progress summary:", {
        completedAttempts,
        totalScore,
        bestPercentage
    });
}

// ======================================================
// RESULTS TABLE
// ======================================================

function renderResultsTable(results) {

    const table =
        document.getElementById(
            "resultsTable"
        );


    const tableBody =
        document.getElementById(
            "resultsTableBody"
        );


    const noResults =
        document.getElementById(
            "noResultsMessage"
        );


    if (
        !table ||
        !tableBody
    ) {

        return;
    }


    tableBody.innerHTML =
        "";


    const completed =
        getCompletedResults(
            results
        );


    // --------------------------------------------------
    // No results
    // --------------------------------------------------

    if (
        completed.length === 0
    ) {

        table.hidden =
            true;


        if (noResults) {

            noResults.style.display =
                "block";
        }


        return;
    }


    table.hidden =
        false;


    if (noResults) {

        noResults.style.display =
            "none";
    }


    // --------------------------------------------------
    // Newest completion first
    // --------------------------------------------------

    const newestFirst =
        [...completed].sort(
            (a, b) => {

                return (
                    getDateValue(
                        b.completedAt
                    )
                    -
                    getDateValue(
                        a.completedAt
                    )
                );
            }
        );


    newestFirst.forEach(
        (result) => {

            const row =
                document.createElement(
                    "tr"
                );


            // --------------------------------------------------
            // Room
            // --------------------------------------------------

            const roomName =
                getRoomName(
                    result
                );


            // --------------------------------------------------
            // Attempt number
            // --------------------------------------------------

            const attemptNumber =
                Number(
                    result.attemptNumber || 1
                );


            // --------------------------------------------------
            // Score
            // --------------------------------------------------

            const score =
                Number(
                    result.score || 0
                );


            const maximumScore =
                Number(
                    result.maximumScore || 0
                );


            const scoreText =
                maximumScore > 0
                    ? `${score} / ${maximumScore}`
                    : String(score);


            // --------------------------------------------------
            // Percentage
            // --------------------------------------------------

            const percentage =
                getScorePercentage(
                    result
                );


            // --------------------------------------------------
            // Duration
            // --------------------------------------------------

            const duration =
                getAttemptDuration(
                    result
                );


            // --------------------------------------------------
            // Status
            // --------------------------------------------------

            const status =
                result.status
                    ? capitalise(
                        result.status
                    )
                    : "Completed";


            // --------------------------------------------------
            // Completion date
            // --------------------------------------------------

            const completedDate =
                formatCompletionDate(
                    result.completedAt
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        roomName
                    )}
                </td>

                <td>
                    ${attemptNumber}
                </td>

                <td>
                    ${escapeHTML(
                        scoreText
                    )}
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

                <td class="status-completed">
                    ${escapeHTML(
                        status
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        completedDate
                    )}
                </td>

            `;


            tableBody.appendChild(
                row
            );
        }
    );
}


// ======================================================
// POPULATE LEADERBOARD ROOM SELECTOR
// ======================================================

function populateLeaderboardRooms(results) {

    const select =
        document.getElementById(
            "leaderboardRoomSelect"
        );


    if (!select) {

        return;
    }


    select.innerHTML = `

        <option value="">
            Select a room
        </option>

    `;


    const completed =
        getCompletedResults(
            results
        );


    const uniqueRooms =
        new Map();


    completed.forEach(
        (result) => {

            const roomId =
                getRoomId(
                    result
                );


            if (!roomId) {

                return;
            }


            if (
                !uniqueRooms.has(
                    roomId
                )
            ) {

                uniqueRooms.set(
                    roomId,
                    getRoomName(
                        result
                    )
                );
            }
        }
    );


    uniqueRooms.forEach(
        (
            roomName,
            roomId
        ) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                roomId;


            option.textContent =
                roomName;


            select.appendChild(
                option
            );
        }
    );


    // --------------------------------------------------
    // Automatically show the first completed room's
    // leaderboard when available.
    // --------------------------------------------------

    const firstRoom =
        uniqueRooms.entries().next();


    if (
        !firstRoom.done
    ) {

        const [
            firstRoomId
        ] =
            firstRoom.value;


        select.value =
            firstRoomId;


        loadLeaderboard(
            firstRoomId
        );

    } else {

        showNoLeaderboard(
            "Complete a room to view its leaderboard."
        );
    }
}


// ======================================================
// LEADERBOARD SELECTOR
// ======================================================

function setupLeaderboardSelector() {

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

            const roomId =
                select.value;


            if (!roomId) {

                clearLeaderboard();


                showNoLeaderboard(
                    "Select a completed room to view its leaderboard."
                );


                return;
            }


            await loadLeaderboard(
                roomId
            );
        }
    );
}


// ======================================================
// LOAD REAL BACKEND LEADERBOARD
//
// GET /api/attempts/room/:roomId/leaderboard
// ======================================================

async function loadLeaderboard(roomId) {

    const token =
        localStorage.getItem(
            "fedEscapeToken"
        );


    const leaderboard =
        document.getElementById(
            "leaderboardList"
        );


    if (!leaderboard) {

        return;
    }


    leaderboard.innerHTML =
        "<p>Loading leaderboard...</p>";


    hideNoLeaderboard();


    try {

        const response = await fetch(
            `${RESULTS_API_BASE_URL}/attempts/room/${roomId}/leaderboard`,
            {
                method: "GET",

                headers: {

                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "Unable to load leaderboard:",
                data
            );


            clearLeaderboard();


            showNoLeaderboard(
                data.message ||
                "Unable to load this leaderboard."
            );


            return;
        }


        const entries =
            extractLeaderboardArray(
                data
            );


        console.log(
            "Leaderboard loaded from MongoDB:",
            entries
        );


        renderLeaderboard(
            entries
        );

    } catch (error) {

        console.error(
            "Leaderboard request failed:",
            error
        );


        clearLeaderboard();


        showNoLeaderboard(
            "Unable to connect to the FedEscape server."
        );
    }
}


// ======================================================
// EXTRACT LEADERBOARD ARRAY
// ======================================================

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


// ======================================================
// RENDER LEADERBOARD
// ======================================================

function renderLeaderboard(entries) {

    const leaderboard =
        document.getElementById(
            "leaderboardList"
        );


    if (!leaderboard) {

        return;
    }


    leaderboard.innerHTML =
        "";


    if (
        entries.length === 0
    ) {

        showNoLeaderboard(
            "No completed leaderboard entries are available for this room yet."
        );


        return;
    }


    hideNoLeaderboard();


    entries.forEach(
        (entry, index) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "leaderboard-row";


            const rank =
                Number(
                    entry.rank ||
                    index + 1
                );


            const studentName =
                getLeaderboardStudentName(
                    entry
                );


            const score =
                Number(
                    entry.score || 0
                );


            const maximumScore =
                Number(
                    entry.maximumScore || 0
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


            row.innerHTML = `

                <span>
                    ${rank}
                </span>

                <span>
                    ${escapeHTML(
                        studentName
                    )}
                </span>

                <strong>
                    ${escapeHTML(
                        scoreText
                    )}
                </strong>

                <span>
                    ${percentage}%
                </span>

                <span>
                    ${escapeHTML(
                        formatCompletionTime(
                            duration
                        )
                    )}
                </span>

            `;


            leaderboard.appendChild(
                row
            );
        }
    );
}


// ======================================================
// GET ROOM ID
// ======================================================

function getRoomId(result) {

    if (
        result.room &&
        typeof result.room === "object"
    ) {

        return (
            result.room._id ||
            result.room.id ||
            ""
        );
    }


    return (
        result.roomId ||
        result.room ||
        ""
    );
}


// ======================================================
// GET ROOM NAME
// ======================================================

function getRoomName(result) {

    if (
        result.room &&
        typeof result.room === "object"
    ) {

        return (
            result.room.name ||
            "Escape Room"
        );
    }


    return (
        result.roomName ||
        "Escape Room"
    );
}


// ======================================================
// SCORE PERCENTAGE
// ======================================================

function getScorePercentage(result) {

    if (
        result.scorePercentage !== undefined &&
        result.scorePercentage !== null
    ) {

        return Math.round(
            Number(
                result.scorePercentage
            ) || 0
        );
    }


    const score =
        Number(
            result.score || 0
        );


    const maximumScore =
        Number(
            result.maximumScore || 0
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


// ======================================================
// ATTEMPT DURATION
// ======================================================

function getAttemptDuration(result) {

    if (
        result.durationSeconds !== undefined &&
        result.durationSeconds !== null
    ) {

        return Number(
            result.durationSeconds
        ) || 0;
    }


    if (
        result.startedAt &&
        result.completedAt
    ) {

        const start =
            new Date(
                result.startedAt
            );


        const end =
            new Date(
                result.completedAt
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


// ======================================================
// STUDENT NAME FOR LEADERBOARD
// ======================================================

function getLeaderboardStudentName(entry) {

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


// ======================================================
// FORMAT DURATION
// HH:MM:SS WHEN NEEDED
// ======================================================

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
            String(hours).padStart(2, "0")
            +
            ":"
            +
            String(minutes).padStart(2, "0")
            +
            ":"
            +
            String(seconds).padStart(2, "0")
        );
    }


    return (
        String(minutes).padStart(2, "0")
        +
        ":"
        +
        String(seconds).padStart(2, "0")
    );
}


// ======================================================
// FORMAT COMPLETION DATE
// ======================================================

function formatCompletionDate(isoDate) {

    if (!isoDate) {

        return "-";
    }


    const date =
        new Date(
            isoDate
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";
    }


    return date.toLocaleString(
        "en-AU",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


// ======================================================
// DATE SORTING
// ======================================================

function getDateValue(value) {

    const date =
        new Date(
            value || 0
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return 0;
    }


    return date.getTime();
}


// ======================================================
// LOADING STATE
// ======================================================

function showLoadingState() {

    const loading =
        document.getElementById(
            "resultsLoadingMessage"
        );


    if (loading) {

        loading.style.display =
            "block";
    }


    const table =
        document.getElementById(
            "resultsTable"
        );


    if (table) {

        table.hidden =
            true;
    }


    hideResultsError();
}


function hideLoadingState() {

    const loading =
        document.getElementById(
            "resultsLoadingMessage"
        );


    if (loading) {

        loading.style.display =
            "none";
    }
}


// ======================================================
// ERROR STATE
// ======================================================

function showResultsError(message) {

    hideLoadingState();


    const errorElement =
        document.getElementById(
            "resultsErrorMessage"
        );


    if (errorElement) {

        errorElement.textContent =
            message;


        errorElement.style.display =
            "block";
    }
}


function hideResultsError() {

    const errorElement =
        document.getElementById(
            "resultsErrorMessage"
        );


    if (errorElement) {

        errorElement.style.display =
            "none";
    }
}


// ======================================================
// LEADERBOARD EMPTY STATE
// ======================================================

function clearLeaderboard() {

    const leaderboard =
        document.getElementById(
            "leaderboardList"
        );


    if (leaderboard) {

        leaderboard.innerHTML =
            "";
    }
}


function showNoLeaderboard(message) {

    const noLeaderboard =
        document.getElementById(
            "noLeaderboardMessage"
        );


    if (noLeaderboard) {

        noLeaderboard.textContent =
            message;


        noLeaderboard.style.display =
            "block";
    }
}


function hideNoLeaderboard() {

    const noLeaderboard =
        document.getElementById(
            "noLeaderboardMessage"
        );


    if (noLeaderboard) {

        noLeaderboard.style.display =
            "none";
    }
}


// ======================================================
// LOGOUT
// ======================================================

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
        (event) => {

            event.preventDefault();


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


            window.location.href =
                "login.html";
        }
    );
}


// ======================================================
// GENERAL HELPERS
// ======================================================

function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            value;
    }
}


function capitalise(value) {

    const text =
        String(
            value || ""
        );


    if (!text) {

        return "";
    }


    return (
        text.charAt(0).toUpperCase()
        +
        text.slice(1)
    );
}


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