"use strict";

document.addEventListener("DOMContentLoaded", () => {
    initialiseLoginForm();
    initialiseRegisterForm();
});

function initialiseLoginForm() {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) {
        return;
    }

    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const email = document
            .getElementById("loginEmail")
            .value
            .trim();

        const password = document
            .getElementById("loginPassword")
            .value;

        if (!email || !password) {
            alert("Please enter your email and password.");
            return;
        }

        if (password.length < 6) {
            alert("Password must contain at least 6 characters.");
            return;
        }

        // Sprint 1 demonstration login.
        // Real authentication will be added with Node.js,
        // Express and MongoDB in a later sprint.
        localStorage.setItem("fedEscapeLoggedIn", "true");
        localStorage.setItem("fedEscapeUserEmail", email);

        window.location.href = "dashboard.html";
    });
}

function initialiseRegisterForm() {
    const registerForm = document.getElementById("registerForm");

    if (!registerForm) {
        return;
    }

    registerForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const fullName = document
            .getElementById("registerName")
            .value
            .trim();

        const email = document
            .getElementById("registerEmail")
            .value
            .trim();

        const password = document
            .getElementById("registerPassword")
            .value;

        const confirmPassword = document
            .getElementById("registerConfirmPassword")
            .value;

        const role = document
            .getElementById("registerRole")
            .value;

        if (
            !fullName ||
            !email ||
            !password ||
            !confirmPassword ||
            !role
        ) {
            alert("Please complete every registration field.");
            return;
        }

        if (password.length < 6) {
            alert("Password must contain at least 6 characters.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        // Sprint 1 demonstration registration.
        // The account will be stored in MongoDB in a later sprint.
        localStorage.setItem("fedEscapeRegisteredName", fullName);
        localStorage.setItem("fedEscapeRegisteredEmail", email);
        localStorage.setItem("fedEscapeRegisteredRole", role);

        alert("Registration successful. Please log in.");

        window.location.href = "login.html";
    });
}