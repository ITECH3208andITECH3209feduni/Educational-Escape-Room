"use strict";

let gameTimerInterval = null;

function startGameTimer(defaultTimeLimit) {
    const timerElement =
        document.getElementById("gameTimer");

    if (!timerElement) {
        return;
    }

    let timeRemaining = Number(
        localStorage.getItem("fedEscapeTimeRemaining")
    );

    if (
        !Number.isFinite(timeRemaining) ||
        timeRemaining < 0
    ) {
        timeRemaining = defaultTimeLimit;
    }

    timerElement.textContent =
        formatGameTime(timeRemaining);

    gameTimerInterval = setInterval(() => {
        timeRemaining -= 1;

        localStorage.setItem(
            "fedEscapeTimeRemaining",
            timeRemaining.toString()
        );

        timerElement.textContent =
            formatGameTime(timeRemaining);

        if (timeRemaining <= 0) {
            stopGameTimer();
            handleTimeExpired();
        }
    }, 1000);
}

function stopGameTimer() {
    if (gameTimerInterval !== null) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
}

function formatGameTime(totalSeconds) {
    const safeSeconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return (
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`
    );
}

function handleTimeExpired() {
    alert("Time is up. The mission has failed.");

    localStorage.setItem("fedEscapeCompleted", "false");

    window.location.href = "../../dashboard.html";
}