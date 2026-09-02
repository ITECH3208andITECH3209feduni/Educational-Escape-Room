"use strict";

/*
    Save a completed room result.

    Later this function can be changed to send the
    result to /api/results instead of localStorage.
*/
function saveFedEscapeResult(room) {

    if (!room) {
        return;
    }

    /*
        Prevent the same completed mission
        from being saved more than once.
    */
    const resultSaved =
        localStorage.getItem("fedEscapeResultSaved");

    if (resultSaved === "true") {
        return;
    }


    const score =
        Number(
            localStorage.getItem("fedEscapeScore")
        ) || 0;


    const timeRemaining =
        Number(
            localStorage.getItem(
                "fedEscapeTimeRemaining"
            )
        ) || 0;


    /*
        Completion time means how long the
        student actually took to finish.
    */
    const completionSeconds =
        Math.max(
            0,
            room.timeLimit - timeRemaining
        );


    const result = {

        studentId:
            getStudentId(),

        roomId:
            room.id,

        score:
            score,

        completionTime:
            completionSeconds,

        progressStatus:
            "Completed",

        completionDate:
            new Date().toISOString()

    };


    let results =
        getFedEscapeResults();


    results.push(result);


    localStorage.setItem(
        "fedEscapeResults",
        JSON.stringify(results)
    );


    localStorage.setItem(
        "fedEscapeResultSaved",
        "true"
    );


    console.log(
        "FedEscape result saved:",
        result
    );

}


/*
    Get the current student ID.

    When authentication is connected to the backend,
    this can use the logged-in student's real ID.
*/
function getStudentId() {

    return (
        localStorage.getItem("studentId") ||
        localStorage.getItem(
            "fedEscapeStudentId"
        ) ||
        "student-demo"
    );

}


/*
    Read all previously saved results.
*/
function getFedEscapeResults() {

    const savedResults =
        localStorage.getItem(
            "fedEscapeResults"
        );


    if (!savedResults) {
        return [];
    }


    try {

        const results =
            JSON.parse(savedResults);

        return Array.isArray(results)
            ? results
            : [];

    } catch (error) {

        console.error(
            "Unable to read results:",
            error
        );

        return [];

    }

}


/*
    Convert seconds to MM:SS.
*/
function formatCompletionTime(
    totalSeconds
) {

    totalSeconds =
        Math.max(
            0,
            Number(totalSeconds) || 0
        );


    const minutes =
        Math.floor(
            totalSeconds / 60
        );


    const seconds =
        totalSeconds % 60;


    return (
        String(minutes).padStart(2, "0")
        +
        ":"
        +
        String(seconds).padStart(2, "0")
    );

}


/*
    Everything below this point is only used
    when results.html is open.
*/
document.addEventListener(
    "DOMContentLoaded",
    () => {

        const resultsTable =
            document.getElementById(
                "resultsTableBody"
            );

        /*
            If we are not on results.html,
            don't try to display anything.
        */
        if (!resultsTable) {
            return;
        }


        displayProgressSummary();
        displayResults();
        displayLeaderboard();

    }
);


/*
    Progress summary.
*/
function displayProgressSummary() {

    const results =
        getFedEscapeResults();


    const completed =
        results.filter(
            result =>
                result.progressStatus
                === "Completed"
        );


    const roomsCompleted =
        completed.length;


    const totalScore =
        completed.reduce(
            (total, result) =>
                total +
                Number(result.score || 0),
            0
        );


    const bestScore =
        completed.length > 0
            ? Math.max(
                ...completed.map(
                    result =>
                        Number(
                            result.score || 0
                        )
                )
            )
            : 0;


    setText(
        "roomsCompleted",
        roomsCompleted
    );


    setText(
        "totalScore",
        totalScore
    );


    setText(
        "bestScore",
        bestScore
    );

}


/*
    Show saved results.
*/
function displayResults() {

    const results =
        getFedEscapeResults();


    const tableBody =
        document.getElementById(
            "resultsTableBody"
        );


    const noResults =
        document.getElementById(
            "noResultsMessage"
        );


    tableBody.innerHTML = "";


    if (results.length === 0) {

        if (noResults) {
            noResults.style.display =
                "block";
        }

        return;
    }


    if (noResults) {
        noResults.style.display =
            "none";
    }


    const newestFirst =
        [...results].reverse();


    newestFirst.forEach(
        result => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        result.roomId
                    )}
                </td>

                <td>
                    ${Number(
                        result.score
                    )}
                </td>

                <td>
                    ${formatCompletionTime(
                        result.completionTime
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        result.progressStatus
                    )}
                </td>

                <td>
                    ${formatCompletionDate(
                        result.completionDate
                    )}
                </td>

            `;


            tableBody.appendChild(
                row
            );

        }
    );

}


/*
    Leaderboard.

    Higher score wins.

    If scores are equal,
    faster completion time wins.
*/
function displayLeaderboard() {

    const results =
        getFedEscapeResults();


    const leaderboard =
        document.getElementById(
            "leaderboardList"
        );


    const noLeaderboard =
        document.getElementById(
            "noLeaderboardMessage"
        );


    if (!leaderboard) {
        return;
    }


    leaderboard.innerHTML = "";


    const completed =
        results.filter(
            result =>
                result.progressStatus
                === "Completed"
        );


    if (completed.length === 0) {

        if (noLeaderboard) {
            noLeaderboard.style.display =
                "block";
        }

        return;
    }


    if (noLeaderboard) {
        noLeaderboard.style.display =
            "none";
    }


    const sorted =
        [...completed].sort(
            (a, b) => {

                if (
                    Number(b.score)
                    !==
                    Number(a.score)
                ) {

                    return (
                        Number(b.score)
                        -
                        Number(a.score)
                    );
                }


                return (
                    Number(
                        a.completionTime
                    )
                    -
                    Number(
                        b.completionTime
                    )
                );

            }
        );


    sorted
        .slice(0, 10)
        .forEach(
            (result, index) => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "leaderboard-row";


                row.innerHTML = `

                    <span>
                        ${index + 1}
                    </span>

                    <span>
                        ${escapeHTML(
                            result.studentId
                        )}
                    </span>

                    <strong>
                        ${Number(
                            result.score
                        )}
                    </strong>

                    <span>
                        ${formatCompletionTime(
                            result.completionTime
                        )}
                    </span>

                `;


                leaderboard.appendChild(
                    row
                );

            }
        );

}


/*
    Convert ISO date into Australian date.
*/
function formatCompletionDate(
    isoDate
) {

    const date =
        new Date(isoDate);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }


    return date.toLocaleDateString(
        "en-AU"
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
            value;
    }

}


function escapeHTML(value) {

    const element =
        document.createElement(
            "div"
        );


    element.textContent =
        String(value ?? "");


    return element.innerHTML;

}