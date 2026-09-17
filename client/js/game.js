"use strict";

// ======================================================
// FedEscape Game
// Backend + MongoDB integrated version
// ======================================================

const GAME_API_BASE_URL = "http://localhost:5000/api";

let currentRoom = null;
let answerSubmitting = false;

// Prevents the completion API from being called twice.
let missionCompleting = false;


// ======================================================
// PAGE INITIALISATION
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {

    // --------------------------------------------------
    // START MISSION BUTTON
    // Used on intro.html
    // --------------------------------------------------

    const startMissionButton =
        document.getElementById("startMissionButton");

    if (startMissionButton) {

        startMissionButton.addEventListener(
            "click",
            async () => {

                const roomId =
                    localStorage.getItem(
                        "fedEscapeSelectedRoomId"
                    ) ||
                    localStorage.getItem(
                        "fedEscapeRoomId"
                    );

                if (!roomId) {

                    alert(
                        "Unable to identify the selected escape room."
                    );

                    return;
                }


                startMissionButton.disabled = true;

                startMissionButton.textContent =
                    "Starting Mission...";


                const started =
                    await startNewMission(roomId);


                if (started) {

                    window.location.href =
                        "room.html";

                    return;
                }


                startMissionButton.disabled = false;

                startMissionButton.textContent =
                    "Start Mission";
            }
        );
    }


    // --------------------------------------------------
    // GAME PAGE
    // --------------------------------------------------

    if (
        document.getElementById(
            "puzzleForm"
        )
    ) {

        await initialiseRoom();
    }

});


// ======================================================
// START / RESUME ATTEMPT
//
// POST /api/attempts/start/:roomId
// ======================================================

async function startNewMission(roomId) {

    const token =
        localStorage.getItem(
            "fedEscapeToken"
        );


    if (!token) {

        alert(
            "Please log in before starting a mission."
        );

        window.location.href =
            "../../login.html";

        return false;
    }


    if (!roomId) {

        alert(
            "Unable to identify the selected escape room."
        );

        return false;
    }


    try {

        const response = await fetch(
            `${GAME_API_BASE_URL}/attempts/start/${roomId}`,
            {
                method: "POST",

                headers: {

                    "Authorization":
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json"
                }
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "Unable to start attempt:",
                data
            );


            alert(
                data.message ||
                "Unable to start the escape room."
            );


            return false;
        }


        const attempt =
            data.attempt;


        if (
            !attempt ||
            !attempt._id
        ) {

            console.error(
                "Attempt missing from response:",
                data
            );


            alert(
                "The server did not return an escape room attempt."
            );


            return false;
        }


        // --------------------------------------------------
        // Store real MongoDB identifiers
        // --------------------------------------------------

        localStorage.setItem(
            "fedEscapeRoomId",
            roomId
        );


        localStorage.setItem(
            "fedEscapeSelectedRoomId",
            roomId
        );


        localStorage.setItem(
            "fedEscapeAttemptId",
            attempt._id
        );


        // --------------------------------------------------
        // Restore progress when backend resumes
        // an existing in-progress attempt.
        // --------------------------------------------------

        const answers =
            Array.isArray(
                attempt.answers
            )
                ? attempt.answers
                : [];


        const currentQuestion =
            Number(
                attempt.currentQuestion ??
                answers.length ??
                0
            );


        const score =
            Number(
                attempt.score || 0
            );


        const correctAnswers =
            answers.filter(
                (answer) =>
                    answer.isCorrect === true
            ).length;


        localStorage.setItem(
            "fedEscapeCurrentPuzzle",
            String(currentQuestion)
        );


        localStorage.setItem(
            "fedEscapeScore",
            String(score)
        );


        localStorage.setItem(
            "fedEscapeCorrectAnswers",
            String(correctAnswers)
        );


        localStorage.setItem(
            "fedEscapeCompleted",
            "false"
        );


        // New attempt/resume is not currently completing.
        missionCompleting = false;


        console.log(
            "FedEscape attempt ready:",
            attempt
        );


        return true;

    } catch (error) {

        console.error(
            "Start attempt error:",
            error
        );


        alert(
            "Unable to connect to the FedEscape server."
        );


        return false;
    }
}


// ======================================================
// LOAD ROOM FROM MONGODB
//
// GET /api/rooms/:id
// ======================================================

async function loadRoom(roomId) {

    const token =
        localStorage.getItem(
            "fedEscapeToken"
        );


    if (!token) {

        alert(
            "Your login session is missing. Please log in again."
        );


        window.location.href =
            "../../login.html";


        return null;
    }


    try {

        const response = await fetch(
            `${GAME_API_BASE_URL}/rooms/${roomId}`,
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
                "Unable to load room:",
                data
            );


            alert(
                data.message ||
                "Unable to load the escape room."
            );


            return null;
        }


        if (!data.room) {

            console.error(
                "Room missing from API response:",
                data
            );


            return null;
        }


        console.log(
            "Room loaded from MongoDB:",
            data.room
        );


        return data.room;

    } catch (error) {

        console.error(
            "Load room error:",
            error
        );


        alert(
            "Unable to connect to the FedEscape server."
        );


        return null;
    }
}


// ======================================================
// INITIALISE GAME PAGE
// ======================================================

async function initialiseRoom() {

    const roomId =
        localStorage.getItem(
            "fedEscapeRoomId"
        ) ||
        localStorage.getItem(
            "fedEscapeSelectedRoomId"
        );


    if (!roomId) {

        console.error(
            "No FedEscape room ID was found."
        );


        alert(
            "No escape room has been selected."
        );


        return;
    }


    currentRoom =
        await loadRoom(roomId);


    if (!currentRoom) {

        console.error(
            "Unable to initialise room:",
            roomId
        );


        return;
    }


    // --------------------------------------------------
    // Set browser tab dynamically.
    // --------------------------------------------------

    document.title =
        `${currentRoom.name || "Escape Room"} | FedEscape`;


    // --------------------------------------------------
    // Validate questions
    // --------------------------------------------------

    if (
        !Array.isArray(
            currentRoom.questions
        ) ||
        currentRoom.questions.length === 0
    ) {

        alert(
            "This escape room does not contain any questions."
        );


        return;
    }


    // --------------------------------------------------
    // Sort questions by educator-defined order.
    // --------------------------------------------------

    currentRoom.questions.sort(
        (a, b) =>
            Number(a.order || 0) -
            Number(b.order || 0)
    );


    // --------------------------------------------------
    // Initialise timer.
    //
    // MongoDB room.time = minutes.
    // timer.js works with seconds.
    // --------------------------------------------------

    const savedTime =
        localStorage.getItem(
            "fedEscapeTimeRemaining"
        );


    if (
        savedTime === null ||
        Number(savedTime) <= 0
    ) {

        localStorage.setItem(
            "fedEscapeTimeRemaining",
            String(
                Number(
                    currentRoom.time
                ) * 60
            )
        );
    }


    // --------------------------------------------------
    // Render current question.
    // --------------------------------------------------

    renderPuzzle(
        currentRoom
    );


    // --------------------------------------------------
    // Start timer.
    // --------------------------------------------------

    if (
        typeof startGameTimer ===
        "function"
    ) {

        startGameTimer(
            Number(
                currentRoom.time
            ) * 60
        );
    }


    // --------------------------------------------------
    // Answer form
    // --------------------------------------------------

    const puzzleForm =
        document.getElementById(
            "puzzleForm"
        );


    if (puzzleForm) {

        puzzleForm.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();


                await submitAnswer(
                    currentRoom
                );
            }
        );
    }


    // --------------------------------------------------
    // Restart mission
    // --------------------------------------------------

    const restartButton =
        document.getElementById(
            "restartMissionButton"
        );


    if (restartButton) {

        restartButton.addEventListener(
            "click",
            async () => {

                await restartMission(
                    currentRoom
                );
            }
        );
    }
}


// ======================================================
// RENDER CURRENT QUESTION
// ======================================================

function renderPuzzle(room) {

    const questions =
        room.questions || [];


    const currentPuzzle =
        Number(
            localStorage.getItem(
                "fedEscapeCurrentPuzzle"
            ) || 0
        );


    // --------------------------------------------------
    // All questions already answered.
    // --------------------------------------------------

    if (
        currentPuzzle >=
        questions.length
    ) {

        completeMission(
            room
        );


        return;
    }


    const question =
        questions[
            currentPuzzle
        ];


    // --------------------------------------------------
    // Puzzle number
    // --------------------------------------------------

    setElementText(
        "puzzleProgress",
        `Puzzle ${currentPuzzle + 1} of ${questions.length}`
    );


    // --------------------------------------------------
    // Category
    // --------------------------------------------------

    setElementText(
        "puzzleCategory",
        room.category ||
        "Escape Room"
    );


    // --------------------------------------------------
    // Challenge heading
    // --------------------------------------------------

    setElementText(
        "puzzleTitle",
        `Challenge ${currentPuzzle + 1}`
    );


    // --------------------------------------------------
    // Question
    // --------------------------------------------------

    setElementText(
        "puzzleQuestion",
        question.questionText
    );


    // --------------------------------------------------
    // Current backend score
    // --------------------------------------------------

    setElementText(
        "currentScore",
        localStorage.getItem(
            "fedEscapeScore"
        ) || "0"
    );


    // --------------------------------------------------
    // Progress
    // --------------------------------------------------

    const progress =
        questions.length > 0
            ? Math.round(
                (
                    currentPuzzle /
                    questions.length
                ) * 100
            )
            : 0;


    const progressFill =
        document.getElementById(
            "progressFill"
        );


    if (progressFill) {

        progressFill.style.width =
            `${progress}%`;
    }


    setElementText(
        "progressText",
        `${progress}% Complete`
    );


    // --------------------------------------------------
    // Render input
    // --------------------------------------------------

    renderAnswerInput(
        question
    );


    // --------------------------------------------------
    // Clear previous feedback
    // --------------------------------------------------

    const message =
        document.getElementById(
            "puzzleMessage"
        );


    if (message) {

        message.textContent =
            "";

        message.style.color =
            "";
    }
}


// ======================================================
// RENDER ANSWER INPUT
// ======================================================

function renderAnswerInput(question) {

    const answerOptions =
        document.getElementById(
            "answerOptions"
        );


    if (!answerOptions) {

        return;
    }


    answerOptions.innerHTML =
        "";


    const questionType =
        question.questionType;


    // ==================================================
    // MULTIPLE CHOICE
    // ==================================================

    if (
        questionType ===
        "multiple-choice"
    ) {

        const options =
            Array.isArray(
                question.options
            )
                ? question.options
                : [];


        options.forEach(
            (option) => {

                const label =
                    document.createElement(
                        "label"
                    );


                label.className =
                    "answer-option";


                const input =
                    document.createElement(
                        "input"
                    );


                input.type =
                    "radio";

                input.name =
                    "answer";

                input.value =
                    option;


                label.appendChild(
                    input
                );


                label.appendChild(
                    document.createTextNode(
                        ` ${option}`
                    )
                );


                answerOptions.appendChild(
                    label
                );
            }
        );


        return;
    }


    // ==================================================
    // TRUE / FALSE
    // ==================================================

    if (
        questionType ===
        "true-false"
    ) {

        const options =
            (
                Array.isArray(
                    question.options
                ) &&
                question.options.length > 0
            )
                ? question.options
                : [
                    "True",
                    "False"
                ];


        options.forEach(
            (option) => {

                const label =
                    document.createElement(
                        "label"
                    );


                label.className =
                    "answer-option";


                const input =
                    document.createElement(
                        "input"
                    );


                input.type =
                    "radio";

                input.name =
                    "answer";

                input.value =
                    option;


                label.appendChild(
                    input
                );


                label.appendChild(
                    document.createTextNode(
                        ` ${option}`
                    )
                );


                answerOptions.appendChild(
                    label
                );
            }
        );


        return;
    }


    // ==================================================
    // TEXT ENTRY
    // ==================================================

    if (
        questionType ===
        "text"
    ) {

        const input =
            document.createElement(
                "input"
            );


        input.type =
            "text";

        input.id =
            "textAnswer";

        input.name =
            "answer";

        input.placeholder =
            "Enter your answer";

        input.autocomplete =
            "off";


        answerOptions.appendChild(
            input
        );


        input.focus();


        return;
    }


    // --------------------------------------------------
    // Unsupported question type
    // --------------------------------------------------

    answerOptions.textContent =
        "Unsupported question type.";
}


// ======================================================
// GET STUDENT ANSWER
// ======================================================

function getUserAnswer(question) {

    if (
        question.questionType ===
        "multiple-choice" ||
        question.questionType ===
        "true-false"
    ) {

        const selected =
            document.querySelector(
                'input[name="answer"]:checked'
            );


        if (!selected) {

            return "";
        }


        return selected.value;
    }


    if (
        question.questionType ===
        "text"
    ) {

        const textInput =
            document.getElementById(
                "textAnswer"
            );


        if (!textInput) {

            return "";
        }


        return textInput.value.trim();
    }


    return "";
}


// ======================================================
// SUBMIT ANSWER
//
// PATCH /api/attempts/:attemptId/answer
//
// Backend is responsible for:
// - correctness
// - points
// - score
// - feedback
// ======================================================

async function submitAnswer(room) {

    if (
        answerSubmitting ||
        missionCompleting
    ) {

        return;
    }


    const token =
        localStorage.getItem(
            "fedEscapeToken"
        );


    const attemptId =
        localStorage.getItem(
            "fedEscapeAttemptId"
        );


    if (!token) {

        alert(
            "Your login session is missing. Please log in again."
        );


        return;
    }


    if (!attemptId) {

        alert(
            "No active attempt was found. Please return to the dashboard and start the room again."
        );


        return;
    }


    const puzzleIndex =
        Number(
            localStorage.getItem(
                "fedEscapeCurrentPuzzle"
            ) || 0
        );


    const question =
        room.questions[
            puzzleIndex
        ];


    if (!question) {

        await completeMission(
            room
        );


        return;
    }


    const message =
        document.getElementById(
            "puzzleMessage"
        );


    const userAnswer =
        getUserAnswer(
            question
        );


    if (!userAnswer) {

        if (message) {

            message.style.color =
                "#ff5a5a";


            message.textContent =
                "Please enter or choose an answer.";
        }


        return;
    }


    answerSubmitting =
        true;


    const submitButton =
        document.querySelector(
            '#puzzleForm button[type="submit"]'
        );


    if (submitButton) {

        submitButton.disabled =
            true;
    }


    try {

        const response = await fetch(
            `${GAME_API_BASE_URL}/attempts/${attemptId}/answer`,
            {
                method: "PATCH",

                headers: {

                    "Authorization":
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    questionId:
                        question._id,

                    answer:
                        userAnswer,

                    hintUsed:
                        false
                })
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "Answer submission failed:",
                data
            );


            if (message) {

                message.style.color =
                    "#ff5a5a";


                message.textContent =
                    data.message ||
                    "Unable to submit answer.";
            }


            return;
        }


        const result =
            data.result;


        if (!result) {

            console.error(
                "Answer result missing:",
                data
            );


            return;
        }


        // --------------------------------------------------
        // Backend score is source of truth.
        // --------------------------------------------------

        localStorage.setItem(
            "fedEscapeScore",
            String(
                result.score || 0
            )
        );


        // --------------------------------------------------
        // Update frontend correct-answer count.
        // --------------------------------------------------

        let correctAnswers =
            Number(
                localStorage.getItem(
                    "fedEscapeCorrectAnswers"
                ) || 0
            );


        if (
            result.isCorrect
        ) {

            correctAnswers +=
                1;


            localStorage.setItem(
                "fedEscapeCorrectAnswers",
                String(
                    correctAnswers
                )
            );
        }


        // --------------------------------------------------
        // Backend records both correct and incorrect
        // submissions, therefore advance after every
        // successful submission.
        // --------------------------------------------------

        const nextQuestion =
            puzzleIndex + 1;


        localStorage.setItem(
            "fedEscapeCurrentPuzzle",
            String(
                nextQuestion
            )
        );


        setElementText(
            "currentScore",
            String(
                result.score || 0
            )
        );


        // --------------------------------------------------
        // Backend feedback
        // --------------------------------------------------

        if (message) {

            if (
                result.isCorrect
            ) {

                message.style.color =
                    "#4CAF50";


                message.textContent =
                    "✅ " +
                    (
                        result.feedback ||
                        "Correct!"
                    );

            } else {

                message.style.color =
                    "#ff5a5a";


                message.textContent =
                    "❌ " +
                    (
                        result.feedback ||
                        "Incorrect."
                    );
            }
        }


        console.log(
            "Answer submitted:",
            result
        );


        // --------------------------------------------------
        // Wait so student can read feedback.
        // --------------------------------------------------

        setTimeout(
            async () => {

                if (
                    nextQuestion >=
                    room.questions.length
                ) {

                    await completeMission(
                        room
                    );

                } else {

                    renderPuzzle(
                        room
                    );
                }

            },
            1500
        );

    } catch (error) {

        console.error(
            "Submit answer error:",
            error
        );


        if (message) {

            message.style.color =
                "#ff5a5a";


            message.textContent =
                "Unable to connect to the FedEscape server.";
        }

    } finally {

        answerSubmitting =
            false;


        if (submitButton) {

            submitButton.disabled =
                false;
        }
    }
}


// ======================================================
// COMPLETE ATTEMPT
//
// PATCH /api/attempts/:attemptId/complete
// ======================================================

async function completeMission(room) {

    // --------------------------------------------------
    // FIX #1
    //
    // Prevent multiple calls while the completion
    // request is already running.
    // --------------------------------------------------

    if (missionCompleting) {

        return;
    }


    // --------------------------------------------------
    // Already successfully completed in this page state.
    // --------------------------------------------------

    const alreadyCompleted =
        localStorage.getItem(
            "fedEscapeCompleted"
        );


    if (
        alreadyCompleted === "true"
    ) {

        showCompletion(
            room,
            null
        );


        return;
    }


    const token =
        localStorage.getItem(
            "fedEscapeToken"
        );


    const attemptId =
        localStorage.getItem(
            "fedEscapeAttemptId"
        );


    if (
        !token ||
        !attemptId
    ) {

        console.error(
            "Cannot complete mission: authentication or attempt ID missing."
        );


        return;
    }


    // --------------------------------------------------
    // Lock completion before the request begins.
    // --------------------------------------------------

    missionCompleting =
        true;


    try {

        const response = await fetch(
            `${GAME_API_BASE_URL}/attempts/${attemptId}/complete`,
            {
                method: "PATCH",

                headers: {

                    "Authorization":
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json"
                }
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "Mission completion failed:",
                data
            );


            const message =
                document.getElementById(
                    "puzzleMessage"
                );


            if (message) {

                message.style.color =
                    "#ff5a5a";


                message.textContent =
                    data.message ||
                    "Unable to complete the mission.";
            }


            // Allow retry only when completion genuinely failed.
            missionCompleting =
                false;


            return;
        }


        // --------------------------------------------------
        // Completion succeeded.
        // --------------------------------------------------

        localStorage.setItem(
            "fedEscapeCompleted",
            "true"
        );


        if (data.result) {

            localStorage.setItem(
                "fedEscapeScore",
                String(
                    data.result.score || 0
                )
            );


            localStorage.setItem(
                "fedEscapeMaximumScore",
                String(
                    data.result.maximumScore || 0
                )
            );


            localStorage.setItem(
                "fedEscapeScorePercentage",
                String(
                    data.result.scorePercentage || 0
                )
            );
        }


        console.log(
            "Mission completed:",
            data
        );


        showCompletion(
            room,
            data.result
        );


        // IMPORTANT:
        // Do not reset missionCompleting here.
        // The mission is now permanently complete
        // for this attempt.

    } catch (error) {

        console.error(
            "Complete mission error:",
            error
        );


        // Network error can be retried.
        missionCompleting =
            false;
    }
}


// ======================================================
// SHOW COMPLETION SCREEN
// ======================================================

function showCompletion(
    room,
    completionResult
) {

    // --------------------------------------------------
    // Completed mission always displays 100%.
    // --------------------------------------------------

    const progressFill =
        document.getElementById(
            "progressFill"
        );


    if (progressFill) {

        progressFill.style.width =
            "100%";
    }


    setElementText(
        "progressText",
        "100% Complete"
    );


    // --------------------------------------------------
    // HUD
    // --------------------------------------------------

    setElementText(
        "puzzleProgress",
        `Puzzle ${room.questions.length} of ${room.questions.length}`
    );


    // --------------------------------------------------
    // Stop timer
    // --------------------------------------------------

    if (
        typeof stopGameTimer ===
        "function"
    ) {

        stopGameTimer();
    }


    localStorage.setItem(
        "fedEscapeCompleted",
        "true"
    );


    // --------------------------------------------------
    // Hide question UI
    // --------------------------------------------------

    hideElement(
        "puzzleCategory"
    );


    hideElement(
        "puzzleTitle"
    );


    hideElement(
        "puzzleQuestion"
    );


    hideElement(
        "puzzleForm"
    );


    // --------------------------------------------------
    // Show completion screen
    // --------------------------------------------------

    const completionScreen =
        document.getElementById(
            "completionScreen"
        );


    if (completionScreen) {

        completionScreen.hidden =
            false;
    }


    // ==================================================
    // FIX #2
    // DYNAMIC ROOM COMPLETION TITLE
    // ==================================================

    setElementText(
        "completionTitle",
        `🎉 ${room.name || "Mission"} Complete`
    );


    // ==================================================
    // DYNAMIC MONGODB COMPLETION MESSAGE
    // ==================================================

    const completionMessage =
        room.completionMessage ||
        "Mission completed successfully.";


    setElementText(
        "completionMessage",
        completionMessage
    );


    // ==================================================
    // FINAL SCORE
    // ==================================================

    const finalScore =
        completionResult?.score ??
        Number(
            localStorage.getItem(
                "fedEscapeScore"
            ) || 0
        );


    setElementText(
        "finalScore",
        String(
            finalScore
        )
    );


    // Also ensure HUD displays final score.
    setElementText(
        "currentScore",
        String(
            finalScore
        )
    );


    // ==================================================
    // CORRECT ANSWERS
    // ==================================================

    const correctAnswers =
        Number(
            localStorage.getItem(
                "fedEscapeCorrectAnswers"
            ) || 0
        );


    setElementText(
        "finalCorrectAnswers",
        `${correctAnswers} / ${room.questions.length}`
    );


    // ==================================================
    // TIME REMAINING
    // ==================================================

    const remainingTime =
        Number(
            localStorage.getItem(
                "fedEscapeTimeRemaining"
            ) || 0
        );


    if (
        typeof formatGameTime ===
        "function"
    ) {

        setElementText(
            "finalTime",
            formatGameTime(
                remainingTime
            )
        );

    } else {

        setElementText(
            "finalTime",
            String(
                remainingTime
            )
        );
    }
}


// ======================================================
// RESTART MISSION
// ======================================================

async function restartMission(room) {

    const confirmed =
        window.confirm(
            "Restart this mission?"
        );


    if (!confirmed) {

        return;
    }


    const roomId =
        room._id;


    if (!roomId) {

        alert(
            "Unable to identify this escape room."
        );


        return;
    }


    // --------------------------------------------------
    // Clear old frontend attempt state.
    // --------------------------------------------------

    localStorage.removeItem(
        "fedEscapeAttemptId"
    );


    localStorage.setItem(
        "fedEscapeCurrentPuzzle",
        "0"
    );


    localStorage.setItem(
        "fedEscapeScore",
        "0"
    );


    localStorage.setItem(
        "fedEscapeCorrectAnswers",
        "0"
    );


    localStorage.setItem(
        "fedEscapeCompleted",
        "false"
    );


    localStorage.setItem(
        "fedEscapeTimeRemaining",
        String(
            Number(
                room.time
            ) * 60
        )
    );


    // Allow completion for the next attempt.
    missionCompleting =
        false;


    // --------------------------------------------------
    // Backend creates a new attempt when the previous
    // attempt has already completed.
    // --------------------------------------------------

    const started =
        await startNewMission(
            roomId
        );


    if (started) {

        window.location.reload();
    }
}


// ======================================================
// HELPER FUNCTIONS
// ======================================================

function setElementText(
    elementId,
    text
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            text;
    }
}


function hideElement(
    elementId
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.hidden =
            true;
    }
}