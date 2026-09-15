"use strict";

document.addEventListener("DOMContentLoaded", () => {

    const startMissionButton =
        document.getElementById("startMissionButton");

    if (startMissionButton) {

        startMissionButton.addEventListener("click", () => {

            startNewMission("cyber-security");

            window.location.href = "room.html";

        });

    }

    if (document.getElementById("puzzleForm")) {
        initialiseRoom();
    }

});


function startNewMission(roomId) {

    const room = rooms[roomId];

    if (!room) {
        console.error("Room not found:", roomId);
        return;
    }

    localStorage.setItem("fedEscapeRoomId", roomId);
    localStorage.setItem("fedEscapeCurrentPuzzle", "0");
    localStorage.setItem("fedEscapeScore", "0");
    localStorage.setItem("fedEscapeCorrectAnswers", "0");

    localStorage.setItem(
        "fedEscapeTimeRemaining",
        room.timeLimit.toString()
    );

    localStorage.setItem("fedEscapeCompleted", "false");
    localStorage.setItem("fedEscapeResultSaved", "false");

}


/*
    Try to load the room from the backend.

    If the backend room API is not available yet,
    the game will automatically use rooms.js instead.
*/
async function loadRoom(roomId) {

    try {

        const response = await fetch(
            `http://localhost:5000/api/rooms/${roomId}`
        );

        if (!response.ok) {
            throw new Error("Room API not available");
        }

        const room = await response.json();

        console.log("Room loaded from backend.");

        return room;

    } catch (error) {

        console.warn(
            "Backend unavailable. Using local room data."
        );

        return rooms[roomId];

    }

}


async function initialiseRoom() {

    const roomId =
        localStorage.getItem("fedEscapeRoomId");

    const room =
        await loadRoom(roomId);

    if (!room) {

        console.error(
            "Unable to initialise room:",
            roomId
        );

        return;

    }

    renderPuzzle(room);

    startGameTimer(room.timeLimit);

    const puzzleForm =
        document.getElementById("puzzleForm");

    puzzleForm.addEventListener(
        "submit",
        (event) => {

            event.preventDefault();

            submitAnswer(room);

        }
    );

    const restartButton =
        document.getElementById(
            "restartMissionButton"
        );

    if (restartButton) {

        restartButton.addEventListener(
            "click",
            () => {

                startNewMission(room.id);

                location.reload();

            }
        );

    }

}


function renderPuzzle(room) {

    const currentPuzzle =
        Number(
            localStorage.getItem(
                "fedEscapeCurrentPuzzle"
            )
        );

    if (
        currentPuzzle >=
        room.puzzles.length
    ) {

        showCompletion(room);

        return;

    }

    const puzzle =
        room.puzzles[currentPuzzle];

    document.getElementById(
        "puzzleProgress"
    ).textContent =
        `Puzzle ${currentPuzzle + 1} of ${room.puzzles.length}`;

    document.getElementById(
        "puzzleCategory"
    ).textContent =
        puzzle.category;

    document.getElementById(
        "puzzleTitle"
    ).textContent =
        puzzle.title;

    document.getElementById(
        "puzzleQuestion"
    ).textContent =
        puzzle.question;

    document.getElementById(
        "currentScore"
    ).textContent =
        localStorage.getItem(
            "fedEscapeScore"
        );

    const progress =
        Math.round(
            (
                (currentPuzzle + 1) /
                room.puzzles.length
            ) * 100
        );

    document.getElementById(
        "progressFill"
    ).style.width =
        progress + "%";

    document.getElementById(
        "progressText"
    ).textContent =
        progress + "% Complete";

    renderAnswerInput(puzzle);

    const message =
        document.getElementById(
            "puzzleMessage"
        );

    message.textContent = "";
    message.style.color = "";

}


function renderAnswerInput(puzzle) {

    const answerOptions =
        document.getElementById(
            "answerOptions"
        );

    answerOptions.innerHTML = "";

    /*
        MULTIPLE-CHOICE QUESTION
    */
    if (
        puzzle.type ===
        "multiple-choice"
    ) {

        puzzle.options.forEach(
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

                input.type = "radio";
                input.name = "answer";
                input.value = option;

                label.appendChild(input);

                label.appendChild(
                    document.createTextNode(
                        " " + option
                    )
                );

                answerOptions.appendChild(
                    label
                );

            }
        );

        return;

    }


    /*
        TEXT-ENTRY QUESTION
    */
    if (puzzle.type === "text") {

        const input =
            document.createElement(
                "input"
            );

        input.type = "text";
        input.id = "textAnswer";
        input.name = "answer";
        input.placeholder =
            "Enter your answer";

        input.autocomplete = "off";

        answerOptions.appendChild(
            input
        );

        input.focus();

    }

}


function submitAnswer(room) {

    const puzzleIndex =
        Number(
            localStorage.getItem(
                "fedEscapeCurrentPuzzle"
            )
        );

    const puzzle =
        room.puzzles[puzzleIndex];

    const message =
        document.getElementById(
            "puzzleMessage"
        );

    const userAnswer =
        getUserAnswer(puzzle);

    if (!userAnswer) {

        message.style.color =
            "#ff5a5a";

        message.textContent =
            "Please enter or choose an answer.";

        return;

    }

    const isCorrect =
        checkAnswer(
            userAnswer,
            puzzle.correctAnswer
        );

    /*
        INCORRECT ANSWER
    */
    if (!isCorrect) {

        message.style.color =
            "#ff5a5a";

        message.textContent =
            "❌ Incorrect. Please try again.";

        return;

    }


    /*
        CORRECT ANSWER
    */
    message.style.color =
        "#4CAF50";

    message.textContent =
        "✅ Correct! " +
        puzzle.explanation;

    const score =
        Number(
            localStorage.getItem(
                "fedEscapeScore"
            )
        );

    const correct =
        Number(
            localStorage.getItem(
                "fedEscapeCorrectAnswers"
            )
        );

    const updatedScore =
        score + puzzle.points;

    localStorage.setItem(
        "fedEscapeScore",
        updatedScore.toString()
    );

    localStorage.setItem(
        "fedEscapeCorrectAnswers",
        (correct + 1).toString()
    );

    localStorage.setItem(
        "fedEscapeCurrentPuzzle",
        (puzzleIndex + 1).toString()
    );

    document.getElementById(
        "currentScore"
    ).textContent =
        updatedScore;

    /*
        Wait briefly so the player can read
        the correct-answer feedback.
    */
    setTimeout(
        () => {

            renderPuzzle(room);

        },
        1200
    );

}


function getUserAnswer(puzzle) {

    /*
        MULTIPLE CHOICE
    */
    if (
        puzzle.type ===
        "multiple-choice"
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


    /*
        TEXT ENTRY
    */
    if (puzzle.type === "text") {

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


/*
    Normalise answers before comparison.

    For example:

    HELLO
    hello
    Hello

    are all treated as the same answer.
*/
function checkAnswer(
    userAnswer,
    correctAnswer
) {

    return (
        String(userAnswer)
            .trim()
            .toLowerCase() ===

        String(correctAnswer)
            .trim()
            .toLowerCase()
    );

}


function showCompletion(room) {

    stopGameTimer();

    localStorage.setItem(
        "fedEscapeCompleted",
        "true"
    );

    document.getElementById(
        "puzzleCategory"
    ).hidden = true;

    document.getElementById(
        "puzzleTitle"
    ).hidden = true;

    document.getElementById(
        "puzzleQuestion"
    ).hidden = true;

    document.getElementById(
        "puzzleForm"
    ).hidden = true;

    document.getElementById(
        "completionScreen"
    ).hidden = false;

    document.getElementById(
        "finalScore"
    ).textContent =
        localStorage.getItem(
            "fedEscapeScore"
        );

    document.getElementById(
        "finalCorrectAnswers"
    ).textContent =
        localStorage.getItem(
            "fedEscapeCorrectAnswers"
        )
        + " / "
        + room.puzzles.length;

    document.getElementById(
        "finalTime"
    ).textContent =
        formatGameTime(
            Number(
                localStorage.getItem(
                    "fedEscapeTimeRemaining"
                )
            )
        );

    /*
        Save the completed result using
        the existing results.js functionality.
    */
    if (
        typeof saveFedEscapeResult ===
        "function"
    ) {

        saveFedEscapeResult(room);

    }

}