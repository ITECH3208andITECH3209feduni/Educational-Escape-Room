"use strict";

const rooms = {
    "cyber-security": {
        id: "cyber-security",
        title: "Cybersecurity Emergency",
        subject: "Information Technology",
        difficulty: "Beginner",
        timeLimit: 900,
        description:
            "Stop the cyberattack before the university server is encrypted.",

        puzzles: [
            {
                id: 1,
                type: "multiple-choice",
                category: "Network Security",
                title: "Secure the Connection",
                question:
                    "Which protocol encrypts web traffic between a browser and a website?",
                options: [
                    "HTTP",
                    "HTTPS",
                    "FTP",
                    "Telnet"
                ],
                correctAnswer: "HTTPS",
                explanation:
                    "HTTPS encrypts communication between the browser and server using TLS.",
                points: 100
            },

            {
                id: 2,
                type: "multiple-choice",
                category: "Password Security",
                title: "Strengthen the Password",
                question:
                    "Which of the following passwords is the strongest?",
                options: [
                    "password123",
                    "santosh2026",
                    "F3d!Escape#2026",
                    "12345678"
                ],
                correctAnswer: "F3d!Escape#2026",
                explanation:
                    "A strong password uses uppercase and lowercase letters, numbers and special characters.",
                points: 100
            },

            {
                id: 3,
                type: "text",
                category: "Cipher Analysis",
                title: "Recover the Access Code",
                question:
                    "The attacker shifted every letter forward by one. Decode this message: IFMMP",
                correctAnswer: "HELLO",
                explanation:
                    "Moving every letter in IFMMP back by one produces HELLO.",
                points: 100
            },

            {
                id: 4,
                type: "text",
                category: "Cyber Awareness",
                title: "Identify the Threat",
                question:
                    "What type of cyberattack tricks users into revealing passwords or sensitive information?",
                correctAnswer: "phishing",
                explanation:
                    "Phishing uses deceptive emails, messages or websites to steal sensitive information.",
                points: 100
            }
        ]
    }
};