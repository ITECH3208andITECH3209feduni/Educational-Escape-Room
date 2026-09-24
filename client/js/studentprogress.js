"use strict";

/* ==========================================================
   FEDESCAPE — EDUCATOR STUDENT PROGRESS TRACKING
   ========================================================== */

const STUDENT_PROGRESS_API_BASE_URL =
    "http://localhost:5000/api";

let educatorRooms = [];
let allStudentAttempts = [];
let students = [];
let selectedStudentId = "";


/* ==========================================================
   PAGE INITIALISATION
   ========================================================== */

document.addEventListener("DOMContentLoaded", async () => {

    setupLogout();
    setupStudentSelector();
    setupRetryButton();

    if (!checkEducatorAuthentication()) {
        return;
    }

    await loadStudentProgressData();
});


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

        alert(
            "Please log in to view student progress."
        );

        window.location.href = "login.html";

        return false;
    }

    if (role && role !== "educator") {

        alert(
            "Educator access is required."
        );

        window.location.href = "dashboard.html";

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

        window.location.href = "login.html";

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
   LOAD ALL STUDENT PROGRESS DATA
   ========================================================== */

async function loadStudentProgressData() {

    showLoading();

    hideError();
    hideNoStudents();
    hideStudentInformation();
    hideSummary();
    hideProgressTable();
    hideInitialState();

    try {

        /* ------------------------------------------
           STEP 1 — Load educator rooms
           ------------------------------------------ */

        const roomResponse = await fetch(
            `${STUDENT_PROGRESS_API_BASE_URL}/rooms/educator/my-rooms`,
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );

        if (handleAuthenticationError(roomResponse)) {
            hideLoading();
            return;
        }

        const roomData =
            await roomResponse.json();

        if (!roomResponse.ok) {

            throw new Error(
                roomData.message ||
                "Unable to load your escape rooms."
            );
        }

        educatorRooms =
            Array.isArray(roomData.rooms)
                ? roomData.rooms
                : [];


        if (educatorRooms.length === 0) {

            hideLoading();

            showNoStudents(
                "No escape rooms available",
                "Create an escape room before tracking student progress."
            );

            updateStudentSelector([]);

            return;
        }


        /* ------------------------------------------
           STEP 2 — Load attempts for every room
           ------------------------------------------ */

        const roomResults =
            await Promise.all(

                educatorRooms.map(
                    async room => {

                        try {

                            const response =
                                await fetch(
                                    `${STUDENT_PROGRESS_API_BASE_URL}/attempts/room/${encodeURIComponent(room._id)}/results`,
                                    {
                                        method: "GET",
                                        headers: getAuthHeaders()
                                    }
                                );


                            if (
                                response.status === 401 ||
                                response.status === 403
                            ) {

                                throw new Error(
                                    "Authentication failed while loading student results."
                                );
                            }


                            const data =
                                await response.json();


                            if (!response.ok) {

                                throw new Error(
                                    data.message ||
                                    `Unable to load results for ${room.name || "room"}.`
                                );
                            }


                            const attempts =
                                Array.isArray(data.results)
                                    ? data.results
                                    : [];


                            return attempts.map(
                                attempt => ({
                                    ...attempt,

                                    roomInfo: {
                                        _id: room._id,
                                        name:
                                            room.name ||
                                            data.room?.name ||
                                            "Escape Room"
                                    }
                                })
                            );


                        } catch (error) {

                            console.error(
                                `Unable to load results for room ${room.name}:`,
                                error
                            );

                            return [];
                        }
                    }
                )
            );


        /* ------------------------------------------
           STEP 3 — Combine all room attempts
           ------------------------------------------ */

        allStudentAttempts =
            roomResults.flat();


        /* ------------------------------------------
           STEP 4 — Build unique student list
           ------------------------------------------ */

        students =
            buildStudentList(
                allStudentAttempts
            );


        hideLoading();


        if (students.length === 0) {

            updateStudentSelector([]);

            showNoStudents(
                "No student activity yet",
                "Students will appear here after they begin attempting one of your escape rooms."
            );

            return;
        }


        updateStudentSelector(
            students
        );


        showInitialMessage(
            "Select a student",
            "Choose a student above to view their progress across your escape rooms."
        );


    } catch (error) {

        console.error(
            "Student progress loading error:",
            error
        );


        hideLoading();


        showError(
            error.message ||
            "Unable to load student progress."
        );
    }
}


/* ==========================================================
   BUILD UNIQUE STUDENT LIST
   ========================================================== */

function buildStudentList(attempts) {

    const studentMap =
        new Map();


    attempts.forEach(
        attempt => {

            const student =
                attempt.student;


            if (
                !student ||
                typeof student !== "object"
            ) {

                return;
            }


            const studentId =
                student._id ||
                student.id;


            if (!studentId) {
                return;
            }


            const key =
                String(studentId);


            if (!studentMap.has(key)) {

                studentMap.set(
                    key,
                    {
                        id: key,

                        name:
                            student.name ||
                            student.email ||
                            "Student",

                        email:
                            student.email ||
                            ""
                    }
                );
            }
        }
    );


    return Array.from(
        studentMap.values()
    ).sort(
        (a, b) =>
            a.name.localeCompare(
                b.name
            )
    );
}


/* ==========================================================
   STUDENT SELECTOR
   ========================================================== */

function updateStudentSelector(studentList) {

    const select =
        document.getElementById(
            "studentProgressSelect"
        );


    if (!select) {
        return;
    }


    select.innerHTML = "";


    if (
        !Array.isArray(studentList) ||
        studentList.length === 0
    ) {

        const option =
            document.createElement(
                "option"
            );


        option.value = "";

        option.textContent =
            "No students available";


        select.appendChild(
            option
        );


        select.disabled = true;

        return;
    }


    const defaultOption =
        document.createElement(
            "option"
        );


    defaultOption.value = "";

    defaultOption.textContent =
        "Select a student";


    select.appendChild(
        defaultOption
    );


    studentList.forEach(
        student => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                student.id;


            option.textContent =
                student.email
                    ? `${student.name} (${student.email})`
                    : student.name;


            select.appendChild(
                option
            );
        }
    );


    select.disabled = false;
}


/* ==========================================================
   STUDENT SELECTOR EVENT
   ========================================================== */

function setupStudentSelector() {

    const select =
        document.getElementById(
            "studentProgressSelect"
        );


    if (!select) {
        return;
    }


    select.addEventListener(
        "change",
        () => {

            selectedStudentId =
                select.value;


            if (!selectedStudentId) {

                hideStudentInformation();
                hideSummary();
                hideProgressTable();
                hideError();
                hideNoStudents();


                showInitialMessage(
                    "Select a student",
                    "Choose a student above to view their progress across your escape rooms."
                );


                return;
            }


            renderStudentProgress(
                selectedStudentId
            );
        }
    );
}


/* ==========================================================
   RENDER SELECTED STUDENT
   ========================================================== */

function renderStudentProgress(studentId) {

    const student =
        students.find(
            currentStudent =>
                currentStudent.id ===
                studentId
        );


    if (!student) {

        showError(
            "Unable to find the selected student."
        );

        return;
    }


    const attempts =
        allStudentAttempts.filter(
            attempt => {

                const attemptStudentId =
                    attempt.student?._id ||
                    attempt.student?.id;


                return (
                    String(
                        attemptStudentId ||
                        ""
                    ) ===
                    String(studentId)
                );
            }
        );


    hideInitialState();
    hideError();
    hideNoStudents();


    showStudentInformation(
        student
    );


    renderStudentSummary(
        attempts
    );


    renderProgressTable(
        attempts
    );
}


/* ==========================================================
   STUDENT INFORMATION
   ========================================================== */

function showStudentInformation(student) {

    const container =
        document.getElementById(
            "selectedStudentInfo"
        );


    const name =
        document.getElementById(
            "selectedStudentName"
        );


    const email =
        document.getElementById(
            "selectedStudentEmail"
        );


    if (
        !container ||
        !name ||
        !email
    ) {

        return;
    }


    name.textContent =
        student.name ||
        "Student";


    email.textContent =
        student.email ||
        "";


    container.hidden = false;
}


/* ==========================================================
   STUDENT SUMMARY
   ========================================================== */

function renderStudentSummary(attempts) {

    const summary =
        document.getElementById(
            "studentProgressSummary"
        );


    if (!summary) {
        return;
    }


    const roomIds =
        new Set();


    attempts.forEach(
        attempt => {

            const roomId =
                attempt.roomInfo?._id ||
                attempt.room;


            if (roomId) {

                roomIds.add(
                    String(roomId)
                );
            }
        }
    );


    const completed =
        attempts.filter(
            attempt =>
                attempt.status ===
                "completed"
        );


    const inProgress =
        attempts.filter(
            attempt =>
                attempt.status ===
                "in-progress"
        );


    const averageScore =
        completed.length > 0
            ? Math.round(
                completed.reduce(
                    (total, attempt) =>
                        total +
                        getScorePercentage(
                            attempt
                        ),
                    0
                ) /
                completed.length
            )
            : 0;


    setText(
        "studentRoomsAttempted",
        roomIds.size
    );


    setText(
        "studentCompletedCount",
        completed.length
    );


    setText(
        "studentInProgressCount",
        inProgress.length
    );


    setText(
        "studentAverageScore",
        `${averageScore}%`
    );


    summary.hidden = false;
}


/* ==========================================================
   PROGRESS TABLE
   ========================================================== */

function renderProgressTable(attempts) {

    const section =
        document.getElementById(
            "studentRoomProgress"
        );


    const body =
        document.getElementById(
            "studentProgressTableBody"
        );


    if (
        !section ||
        !body
    ) {

        return;
    }


    body.innerHTML = "";


    if (
        !Array.isArray(attempts) ||
        attempts.length === 0
    ) {

        section.hidden = true;

        return;
    }


    const sortedAttempts =
        [...attempts].sort(
            (a, b) =>
                getDateValue(b) -
                getDateValue(a)
        );


    sortedAttempts.forEach(
        attempt => {

            const row =
                document.createElement(
                    "tr"
                );


            const roomName =
                attempt.roomInfo?.name ||
                "Escape Room";


            const attemptNumber =
                resultNumber(
                    attempt.attemptNumber,
                    1
                );


            const status =
                attempt.status ||
                "in-progress";


            const progress =
                getProgressPercentage(
                    attempt
                );


            const score =
                resultNumber(
                    attempt.score
                );


            const maximumScore =
                resultNumber(
                    attempt.maximumScore
                );


            const scorePercentage =
                getScorePercentage(
                    attempt
                );


            const scoreText =
                maximumScore > 0
                    ? `${score}/${maximumScore} (${scorePercentage}%)`
                    : `${scorePercentage}%`;


            const lastActivity =
                attempt.lastActivityAt ||
                attempt.updatedAt ||
                attempt.completedAt ||
                attempt.startedAt ||
                attempt.createdAt;


            row.innerHTML = `

                <td>
                    <strong>
                        ${escapeHTML(roomName)}
                    </strong>
                </td>


                <td>
                    #${attemptNumber}
                </td>


                <td>

                    <span
                        class="student-progress-status ${escapeHTML(status)}"
                    >
                        ${escapeHTML(
                            formatLabel(status)
                        )}
                    </span>

                </td>


                <td>

                    <div class="student-progress-bar-container">

                        <div
                            class="student-progress-bar"
                            role="progressbar"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow="${progress}"
                        >

                            <div
                                class="student-progress-bar-fill"
                                style="width: ${progress}%"
                            >
                            </div>

                        </div>

                        <span class="student-progress-percentage">
                            ${progress}%
                        </span>

                    </div>

                </td>


                <td>
                    ${escapeHTML(scoreText)}
                </td>


                <td>
                    ${escapeHTML(
                        formatDate(
                            lastActivity
                        )
                    )}
                </td>

            `;


            body.appendChild(
                row
            );
        }
    );


    section.hidden = false;
}


/* ==========================================================
   PROGRESS PERCENTAGE
   ========================================================== */

function getProgressPercentage(attempt) {

    if (
        attempt.progressPercentage !==
            undefined &&
        attempt.progressPercentage !==
            null
    ) {

        return clampPercentage(
            attempt.progressPercentage
        );
    }


    const answered =
        resultNumber(
            attempt.questionsAnswered
        );


    const total =
        resultNumber(
            attempt.totalQuestions
        );


    if (total <= 0) {
        return 0;
    }


    return clampPercentage(
        Math.round(
            (
                answered /
                total
            ) * 100
        )
    );
}


/* ==========================================================
   SCORE PERCENTAGE
   ========================================================== */

function getScorePercentage(attempt) {

    if (
        attempt.scorePercentage !==
            undefined &&
        attempt.scorePercentage !==
            null
    ) {

        return clampPercentage(
            attempt.scorePercentage
        );
    }


    const score =
        resultNumber(
            attempt.score
        );


    const maximum =
        resultNumber(
            attempt.maximumScore
        );


    if (maximum <= 0) {
        return 0;
    }


    return clampPercentage(
        Math.round(
            (
                score /
                maximum
            ) * 100
        )
    );
}


/* ==========================================================
   DATE HELPERS
   ========================================================== */

function getDateValue(attempt) {

    const date =
        attempt.lastActivityAt ||
        attempt.updatedAt ||
        attempt.completedAt ||
        attempt.startedAt ||
        attempt.createdAt;


    if (!date) {
        return 0;
    }


    const parsed =
        new Date(date);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {

        return 0;
    }


    return parsed.getTime();
}


function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";
    }


    return date.toLocaleString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* ==========================================================
   PAGE STATES
   ========================================================== */

function showLoading() {

    const element =
        document.getElementById(
            "studentProgressLoading"
        );


    if (element) {
        element.hidden = false;
    }
}


function hideLoading() {

    const element =
        document.getElementById(
            "studentProgressLoading"
        );


    if (element) {
        element.hidden = true;
    }
}


function showInitialMessage(
    title,
    message
) {

    hideLoading();
    hideError();
    hideNoStudents();


    const element =
        document.getElementById(
            "studentProgressInitial"
        );


    if (!element) {
        return;
    }


    element.innerHTML = `

        <strong>
            ${escapeHTML(title)}
        </strong>

        <p>
            ${escapeHTML(message)}
        </p>

    `;


    element.hidden = false;
}


function hideInitialState() {

    const element =
        document.getElementById(
            "studentProgressInitial"
        );


    if (element) {
        element.hidden = true;
    }
}


function showNoStudents(
    title,
    message
) {

    hideInitialState();
    hideError();


    const element =
        document.getElementById(
            "studentProgressNoStudents"
        );


    if (!element) {
        return;
    }


    element.innerHTML = `

        <strong>
            ${escapeHTML(title)}
        </strong>

        <p>
            ${escapeHTML(message)}
        </p>

    `;


    element.hidden = false;
}


function hideNoStudents() {

    const element =
        document.getElementById(
            "studentProgressNoStudents"
        );


    if (element) {
        element.hidden = true;
    }
}


function showError(message) {

    hideLoading();
    hideInitialState();
    hideNoStudents();


    const container =
        document.getElementById(
            "studentProgressError"
        );


    const messageElement =
        document.getElementById(
            "studentProgressErrorMessage"
        );


    if (messageElement) {

        messageElement.textContent =
            message;
    }


    if (container) {

        container.hidden = false;
    }
}


function hideError() {

    const element =
        document.getElementById(
            "studentProgressError"
        );


    if (element) {
        element.hidden = true;
    }
}


function hideStudentInformation() {

    const element =
        document.getElementById(
            "selectedStudentInfo"
        );


    if (element) {
        element.hidden = true;
    }
}


function hideSummary() {

    const element =
        document.getElementById(
            "studentProgressSummary"
        );


    if (element) {
        element.hidden = true;
    }
}


function hideProgressTable() {

    const element =
        document.getElementById(
            "studentRoomProgress"
        );


    if (element) {
        element.hidden = true;
    }


    const body =
        document.getElementById(
            "studentProgressTableBody"
        );


    if (body) {
        body.innerHTML = "";
    }
}


/* ==========================================================
   RETRY
   ========================================================== */

function setupRetryButton() {

    const button =
        document.getElementById(
            "studentProgressRetryButton"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            selectedStudentId = "";

            await loadStudentProgressData();
        }
    );
}


/* ==========================================================
   LOGOUT
   ========================================================== */

function setupLogout() {

    const button =
        document.getElementById(
            "logoutButton"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
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
   GENERAL HELPERS
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
        Number(value);


    return Number.isFinite(number)
        ? number
        : fallback;
}


function clampPercentage(value) {

    const number =
        resultNumber(value);


    return Math.min(
        100,
        Math.max(
            0,
            Math.round(number)
        )
    );
}


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
            String(value);
    }
}


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