"use strict";


        const INTRO_API_BASE_URL =
            window.FEDEscapeConfig.apiBaseUrl;


        // ==================================================
        // LOAD ROOM WHEN PAGE OPENS
        // ==================================================

        document.addEventListener(
            "DOMContentLoaded",
            loadMissionIntroduction
        );


        // ==================================================
        // LOAD SELECTED ROOM FROM BACKEND
        // GET /api/rooms/:roomId
        // ==================================================

        async function loadMissionIntroduction() {

            const roomId =
                localStorage.getItem(
                    "fedEscapeSelectedRoomId"
                ) ||
                localStorage.getItem(
                    "fedEscapeRoomId"
                );


            const sessionHint =
                window.FEDEscapeSession.hasSessionHint();


            // ----------------------------------------------
            // Room ID check
            // ----------------------------------------------

            if (!roomId) {

                showIntroError(
                    "No escape room has been selected."
                );

                return;
            }


            // ----------------------------------------------
            // Authentication check
            // ----------------------------------------------

            if (!sessionHint) {

                alert(
                    "Please log in before opening an escape room."
                );


                window.location.href =
                    "../../login.html";


                return;
            }


            try {

                // ------------------------------------------
                // Request selected MongoDB room
                // ------------------------------------------

                const response = await window.FEDEscapeSession.fetch(
                    `${INTRO_API_BASE_URL}/rooms/${roomId}`,
                    {
                        method: "GET",

                        headers: {

                            
                        }
                    }
                );


                const data =
                    await response.json();


                // ------------------------------------------
                // Backend error
                // ------------------------------------------

                if (!response.ok) {

                    console.error(
                        "Unable to load room:",
                        data
                    );


                    showIntroError(
                        data.message ||
                        "Unable to load this escape room."
                    );


                    return;
                }


                // ------------------------------------------
                // Missing room object
                // ------------------------------------------

                if (!data.room) {

                    console.error(
                        "Room missing from response:",
                        data
                    );


                    showIntroError(
                        "Room information was not returned by the server."
                    );


                    return;
                }


                // ------------------------------------------
                // Render room information
                // ------------------------------------------

                renderMissionIntroduction(
                    data.room
                );


                console.log(
                    "Intro room loaded from MongoDB:",
                    data.room
                );


            } catch (error) {

                console.error(
                    "Intro room loading error:",
                    error
                );


                showIntroError(
                    "Unable to connect to the FedEscape server."
                );
            }
        }


        // ==================================================
        // DISPLAY ROOM INFORMATION
        // ==================================================

        function renderMissionIntroduction(room) {

            // ----------------------------------------------
            // Browser tab title
            // ----------------------------------------------

            document.title =
                `${room.name || "Escape Room"} | FedEscape`;


            // ----------------------------------------------
            // Category
            // ----------------------------------------------

            setIntroText(
                "missionLabel",
                room.category ||
                "Escape Room"
            );


            // ----------------------------------------------
            // Room name
            // ----------------------------------------------

            setIntroText(
                "missionTitle",
                room.name ||
                "Escape Room"
            );


            // ----------------------------------------------
            // Mission status
            // ----------------------------------------------

            setIntroText(
                "missionWarning",
                "Mission Ready"
            );


            // ----------------------------------------------
            // Description
            // ----------------------------------------------

            setIntroText(
                "missionDescription",
                room.description ||
                "Complete the challenges to finish this escape room."
            );


            // ----------------------------------------------
            // Number of questions
            // ----------------------------------------------

            const questionCount =
                Array.isArray(
                    room.questions
                )
                    ? room.questions.length
                    : 0;


            setIntroText(
                "missionQuestionCount",
                String(
                    questionCount
                )
            );


            // ----------------------------------------------
            // Time limit
            // MongoDB stores room.time in minutes
            // ----------------------------------------------

            const minutes =
                Number(
                    room.time || 0
                );


            setIntroText(
                "missionTime",
                `${minutes}:00`
            );


            // ----------------------------------------------
            // Difficulty
            // ----------------------------------------------

            const difficulty =
                room.difficulty
                    ? capitalise(
                        room.difficulty
                    )
                    : "Not Set";


            setIntroText(
                "missionDifficulty",
                difficulty
            );


            // ----------------------------------------------
            // Instructions
            // ----------------------------------------------

            const instructions =
                document.getElementById(
                    "missionInstructions"
                );


            if (
                instructions &&
                room.instructions
            ) {

                instructions.textContent =
                    room.instructions;


                instructions.hidden =
                    false;
            }


            // ----------------------------------------------
            // Enable Start Mission button
            // ----------------------------------------------

            const startButton =
                document.getElementById(
                    "startMissionButton"
                );


            if (startButton) {

                startButton.disabled =
                    false;


                startButton.textContent =
                    "Start Mission";
            }
        }


        // ==================================================
        // DISPLAY ERROR
        // ==================================================

        function showIntroError(message) {

            setIntroText(
                "missionLabel",
                "Escape Room"
            );


            setIntroText(
                "missionTitle",
                "Unable to Load Mission"
            );


            setIntroText(
                "missionWarning",
                "Mission Unavailable"
            );


            setIntroText(
                "missionDescription",
                message
            );


            setIntroText(
                "missionQuestionCount",
                "-"
            );


            setIntroText(
                "missionTime",
                "-"
            );


            setIntroText(
                "missionDifficulty",
                "-"
            );


            const startButton =
                document.getElementById(
                    "startMissionButton"
                );


            if (startButton) {

                startButton.disabled =
                    true;


                startButton.textContent =
                    "Mission Unavailable";
            }
        }


        // ==================================================
        // HELPER: SET TEXT
        // ==================================================

        function setIntroText(
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


        // ==================================================
        // HELPER: CAPITALISE
        // ==================================================

        function capitalise(value) {

            const text =
                String(value);


            return (
                text.charAt(0).toUpperCase() +
                text.slice(1)
            );
        }

    