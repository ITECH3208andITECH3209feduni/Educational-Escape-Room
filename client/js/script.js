"use strict";

// ======================================================
// FedEscape Authentication Frontend
// Connects login and registration forms to the backend.
// ======================================================

const API_BASE_URL = window.FEDEscapeConfig.apiBaseUrl;


document.addEventListener("DOMContentLoaded", () => {

    initialiseLoginForm();
    initialiseRegisterForm();

});


// ======================================================
// LOGIN
// POST /api/auth/login
// ======================================================

function initialiseLoginForm() {

    const loginForm =
        document.getElementById("loginForm");

    if (!loginForm) {
        return;
    }


    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const email =
                document
                    .getElementById("loginEmail")
                    .value
                    .trim();


            const password =
                document
                    .getElementById("loginPassword")
                    .value;


            // ------------------------------------------
            // Basic validation
            // ------------------------------------------

            if (!email || !password) {

                alert(
                    "Please enter your email and password."
                );

                return;
            }


            if (password.length < 6) {

                alert(
                    "Password must contain at least 6 characters."
                );

                return;
            }


            try {

                // --------------------------------------
                // Send login request to backend
                // --------------------------------------

                const response = await window.FEDEscapeSession.fetch(
                    `${API_BASE_URL}/auth/login`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            email,
                            password
                        })
                    }
                );


                const data =
                    await response.json();


                // --------------------------------------
                // Login failed
                // --------------------------------------

                if (!response.ok) {

                    alert(
                        data.message ||
                        "Unable to log in."
                    );

                    return;
                }


                // --------------------------------------
                // Authentication stays in an HttpOnly cookie; store only UI details.
                localStorage.setItem(
                    "fedEscapeLoggedIn",
                    "true"
                );


                // --------------------------------------
                // Store user information
                // --------------------------------------

                if (data.user) {

                    if (data.user.id) {

                        localStorage.setItem(
                            "fedEscapeUserId",
                            data.user.id
                        );
                    }


                    if (data.user.name) {

                        localStorage.setItem(
                            "fedEscapeUserName",
                            data.user.name
                        );
                    }


                    if (data.user.email) {

                        localStorage.setItem(
                            "fedEscapeUserEmail",
                            data.user.email
                        );

                    } else {

                        localStorage.setItem(
                            "fedEscapeUserEmail",
                            email
                        );
                    }


                    if (data.user.role) {

                        localStorage.setItem(
                            "fedEscapeUserRole",
                            data.user.role
                        );
                    }
                }


                console.log(
                    "FedEscape login successful:",
                    data.user
                );


                // --------------------------------------
                // Redirect according to role
                // --------------------------------------

                const role =
                    data.user?.role;


                if (role === "educator") {

                    window.location.href =
                        "teacherdashboard.html";

                    return;
                }


                if (role === "admin") {

                    // Temporary admin destination.
                    // Can be changed when an admin
                    // dashboard is implemented.

                    window.location.href =
                        "dashboard.html";

                    return;
                }


                // Student
                window.location.href =
                    "dashboard.html";

            } catch (error) {

                console.error(
                    "FedEscape login error:",
                    error
                );


                alert(
                    "Unable to connect to the FedEscape server. " +
                    "Please make sure the backend is running."
                );
            }

        }
    );
}


// ======================================================
// REGISTER
// POST /api/auth/register
// ======================================================

function initialiseRegisterForm() {

    const registerForm =
        document.getElementById(
            "registerForm"
        );


    if (!registerForm) {
        return;
    }


    let registrationPending = false;
    const registerButton = registerForm.querySelector('button[type="submit"]');
    const registerStatus = document.getElementById("registerStatus");
    registerForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();
            if (registrationPending) return;


            const fullName =
                document
                    .getElementById(
                        "registerName"
                    )
                    .value
                    .trim();


            const email =
                document
                    .getElementById(
                        "registerEmail"
                    )
                    .value
                    .trim();


            const password =
                document
                    .getElementById(
                        "registerPassword"
                    )
                    .value;


            const confirmPassword =
                document
                    .getElementById(
                        "registerConfirmPassword"
                    )
                    .value;


            const role =
                document
                    .getElementById(
                        "registerRole"
                    )
                    .value;


            // ------------------------------------------
            // Validation
            // ------------------------------------------

            if (
                !fullName ||
                !email ||
                !password ||
                !confirmPassword ||
                !role
            ) {

                alert(
                    "Please complete every registration field."
                );

                return;
            }


            if (password.length < 6) {

                alert(
                    "Password must contain at least 6 characters."
                );

                return;
            }


            if (
                password !==
                confirmPassword
            ) {

                alert(
                    "Passwords do not match."
                );

                return;
            }


            registrationPending = true;
            const originalButtonText = registerButton.textContent;
            registerButton.disabled = true;
            registerButton.textContent = "Creating account…";
            registerForm.setAttribute("aria-busy", "true");
            registerStatus.textContent = "Creating your account and sending your verification email…";
            const waitingMessage = setTimeout(() => {
                registerStatus.textContent = "Still waiting for the email service. Please keep this page open; you do not need to click again.";
            }, 10000);

            try {

                // --------------------------------------
                // Send registration to backend
                // --------------------------------------

                const response = await window.FEDEscapeSession.fetch(
                    `${API_BASE_URL}/auth/register`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            name: fullName,

                            email,

                            password,

                            role
                        })
                    }
                );


                const data =
                    await response.json();


                // --------------------------------------
                // Registration failed
                // --------------------------------------

                if (!response.ok) {

                    alert(
                        data.message ||
                        "Unable to register account."
                    );

                    return;
                }


                console.log(
                    "FedEscape registration successful:",
                    data
                );

                if (data.requiresEmailVerification) {

                    alert(
                        "Account created successfully!\n\n" +
                        "A verification email has been sent to " +
                        email +
                        ".\n\n" +
                        "Please check your inbox and verify your email before logging in."
                    );

                    window.location.href =
                        "login.html";

                    return;
                }

                alert(
                    data.message ||
                    "Account created successfully."
                );

                window.location.href =
                    "login.html";

            } catch (error) {

                console.error(
                    "FedEscape registration error:",
                    error
                );


                alert(
                    "Unable to connect to the FedEscape server. " +
                    "Please make sure the backend is running."
                );
            } finally {
                clearTimeout(waitingMessage);
                registrationPending = false;
                registerButton.disabled = false;
                registerButton.textContent = originalButtonText;
                registerForm.removeAttribute("aria-busy");
                registerStatus.textContent = "";
            }

        }
    );
}