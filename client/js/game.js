"use strict";

document.addEventListener("DOMContentLoaded", () => {

    const startMissionButton = document.getElementById("startMissionButton");

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

    localStorage.setItem("fedEscapeRoomId", roomId);
    localStorage.setItem("fedEscapeCurrentPuzzle", 0);
    localStorage.setItem("fedEscapeScore", 0);
    localStorage.setItem("fedEscapeCorrectAnswers", 0);
    localStorage.setItem("fedEscapeTimeRemaining", room.timeLimit);
    localStorage.setItem("fedEscapeCompleted", false);

}

function initialiseRoom() {

    const roomId = localStorage.getItem("fedEscapeRoomId");

    const room = rooms[roomId];

    renderPuzzle(room);

    startGameTimer(room.timeLimit);

    document
        .getElementById("puzzleForm")
        .addEventListener("submit", (event) => {

            event.preventDefault();

            submitAnswer(room);

        });

    document
        .getElementById("restartMissionButton")
        .addEventListener("click", () => {

            startNewMission(room.id);

            location.reload();

        });

}

function renderPuzzle(room) {

    const currentPuzzle = Number(
        localStorage.getItem("fedEscapeCurrentPuzzle")
    );

    if (currentPuzzle >= room.puzzles.length) {

        showCompletion(room);

        return;

    }

    const puzzle = room.puzzles[currentPuzzle];

    document.getElementById("puzzleProgress").textContent =
        `Puzzle ${currentPuzzle + 1} of ${room.puzzles.length}`;

    document.getElementById("puzzleCategory").textContent =
        puzzle.category;

    document.getElementById("puzzleTitle").textContent =
        puzzle.title;

    document.getElementById("puzzleQuestion").textContent =
        puzzle.question;

    document.getElementById("currentScore").textContent =
        localStorage.getItem("fedEscapeScore");

    const progress =
        Math.round(
            ((currentPuzzle + 1) / room.puzzles.length) * 100
        );

    document.getElementById("progressFill").style.width =
        progress + "%";

    document.getElementById("progressText").textContent =
        progress + "% Complete";

    const answerOptions =
        document.getElementById("answerOptions");

    answerOptions.innerHTML = "";

    puzzle.options.forEach(option => {

        answerOptions.innerHTML += `
            <label class="answer-option">

                <input
                    type="radio"
                    name="answer"
                    value="${option}">

                ${option}

            </label>
        `;

    });

    document.getElementById("puzzleMessage").textContent = "";

}

function submitAnswer(room) {

    const selected =
        document.querySelector('input[name="answer"]:checked');

    const message =
        document.getElementById("puzzleMessage");

    if (!selected) {

        message.textContent = "Please choose an answer.";

        return;

    }

    const puzzleIndex = Number(
        localStorage.getItem("fedEscapeCurrentPuzzle")
    );

    const puzzle =
        room.puzzles[puzzleIndex];

    if (selected.value !== puzzle.correctAnswer) {

        message.style.color = "#ff5a5a";

        message.textContent =
            "❌ Incorrect. Please try again.";

        return;

    }

    message.style.color = "#4CAF50";

    message.textContent =
        "✅ Correct! " + puzzle.explanation;

    const score =
        Number(localStorage.getItem("fedEscapeScore"));

    const correct =
        Number(localStorage.getItem("fedEscapeCorrectAnswers"));

    localStorage.setItem(
        "fedEscapeScore",
        score + puzzle.points
    );

    localStorage.setItem(
        "fedEscapeCorrectAnswers",
        correct + 1
    );

    localStorage.setItem(
        "fedEscapeCurrentPuzzle",
        puzzleIndex + 1
    );

    document.getElementById("currentScore").textContent =
        score + puzzle.points;

    setTimeout(() => {

        renderPuzzle(room);

    }, 1200);

}

function showCompletion(room) {

    stopGameTimer();

    document.getElementById("puzzleCategory").hidden = true;
    document.getElementById("puzzleTitle").hidden = true;
    document.getElementById("puzzleQuestion").hidden = true;
    document.getElementById("puzzleForm").hidden = true;

    document.getElementById("completionScreen").hidden = false;

    document.getElementById("finalScore").textContent =
        localStorage.getItem("fedEscapeScore");

    document.getElementById("finalCorrectAnswers").textContent =
        localStorage.getItem("fedEscapeCorrectAnswers")
        + " / "
        + room.puzzles.length;

    document.getElementById("finalTime").textContent =
        formatGameTime(
            Number(localStorage.getItem("fedEscapeTimeRemaining"))
        );

}