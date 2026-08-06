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

    const puzzleForm = document.getElementById("puzzleForm");

    if (puzzleForm) {
        initialiseRoom();
    }
});

function startNewMission(roomId) {
    const room = rooms[roomId];

    if (!room) {
        console.error(`Room not found: ${roomId}`);
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
    localStorage.setItem(
        "fedEscapeStartedAt",
        Date.now().toString()
    );
}

function initialiseRoom() {
    const roomId =
        localStorage.getItem("fedEscapeRoomId") ||
        "cyber-security";

    const room = rooms[roomId];

    if (!room) {
        showGameError("The selected room could not be found.");
        return;
    }

    renderCurrentPuzzle(room);
    startGameTimer(room.timeLimit);

    const puzzleForm =
        document.getElementById("puzzleForm");

    puzzleForm.addEventListener("submit", (event) => {
        event.preventDefault();
        submitAnswer(room);
    });

    const restartButton =
        document.getElementById("restartMissionButton");

    if (restartButton) {
        restartButton.addEventListener("click", () => {
            startNewMission(room.id);
            window.location.reload();
        });
    }
}

function renderCurrentPuzzle(room) {
    const currentPuzzleIndex = Number(
        localStorage.getItem("fedEscapeCurrentPuzzle") || "0"
    );

    if (currentPuzzleIndex >= room.puzzles.length) {
        showCompletionScreen(room);
        return;
    }

    const puzzle = room.puzzles[currentPuzzleIndex];

    document.getElementById("puzzleProgress").textContent =
        `Puzzle ${currentPuzzleIndex + 1} of ${room.puzzles.length}`;

    document.getElementById("puzzleCategory").textContent =
        puzzle.category;

    document.getElementById("puzzleTitle").textContent =
        puzzle.title;

    document.getElementById("puzzleQuestion").textContent =
        puzzle.question;

    const progressPercentage =
        ((currentPuzzleIndex + 1) / room.puzzles.length) * 100;

    document.getElementById("progressFill").style.width =
        `${progressPercentage}%`;

    const answerOptions =
        document.getElementById("answerOptions");

    answerOptions.innerHTML = "";

    puzzle.options.forEach((option) => {
        const label = document.createElement("label");
        label.className = "answer-option";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "answer";
        input.value = option;

        const text = document.createElement("span");
        text.textContent = option;

        label.append(input, text);
        answerOptions.appendChild(label);
    });

    document.getElementById("puzzleMessage").textContent = "";
}

function submitAnswer(room) {
    const selectedAnswer = document.querySelector(
        'input[name="answer"]:checked'
    );

    const puzzleMessage =
        document.getElementById("puzzleMessage");

    if (!selectedAnswer) {
        puzzleMessage.textContent =
            "Please select an answer.";
        return;
    }

    const currentPuzzleIndex = Number(
        localStorage.getItem("fedEscapeCurrentPuzzle") || "0"
    );

    const puzzle = room.puzzles[currentPuzzleIndex];

    if (selectedAnswer.value !== puzzle.correctAnswer) {
        puzzleMessage.textContent =
            "Incorrect. Try again.";
        return;
    }

    const currentScore = Number(
        localStorage.getItem("fedEscapeScore") || "0"
    );

    const correctAnswers = Number(
        localStorage.getItem(
            "fedEscapeCorrectAnswers"
        ) || "0"
    );

    localStorage.setItem(
        "fedEscapeScore",
        (currentScore + puzzle.points).toString()
    );

    localStorage.setItem(
        "fedEscapeCorrectAnswers",
        (correctAnswers + 1).toString()
    );

    localStorage.setItem(
        "fedEscapeCurrentPuzzle",
        (currentPuzzleIndex + 1).toString()
    );

    puzzleMessage.textContent =
        `Correct! ${puzzle.explanation}`;

    setTimeout(() => {
        renderCurrentPuzzle(room);
    }, 1200);
}

function showCompletionScreen(room) {
    stopGameTimer();

    localStorage.setItem("fedEscapeCompleted", "true");

    document.getElementById("puzzleForm").hidden = true;
    document.getElementById("puzzleCategory").hidden = true;
    document.getElementById("puzzleTitle").hidden = true;
    document.getElementById("puzzleQuestion").hidden = true;
    document.getElementById("puzzleProgress").textContent =
        "Mission Complete";

    const completionScreen =
        document.getElementById("completionScreen");

    completionScreen.hidden = false;

    document.getElementById("finalScore").textContent =
        localStorage.getItem("fedEscapeScore") || "0";

    document.getElementById("finalCorrectAnswers").textContent =
        `${localStorage.getItem("fedEscapeCorrectAnswers") || "0"}` +
        `/${room.puzzles.length}`;

    document.getElementById("finalTime").textContent =
        formatGameTime(
            Number(
                localStorage.getItem(
                    "fedEscapeTimeRemaining"
                ) || "0"
            )
        );
}

function showGameError(message) {
    const puzzleMessage =
        document.getElementById("puzzleMessage");

    if (puzzleMessage) {
        puzzleMessage.textContent = message;
    }
}