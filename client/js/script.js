"use strict";

// ======================================================
// FedEscape Authentication Frontend
// Connects login and registration forms to the backend.
// ======================================================

const API_BASE_URL = "http://localhost:5000/api";


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

                const response = await fetch(
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
                // Make sure token was returned
                // --------------------------------------

                if (!data.token) {

                    console.error(
                        "Login response did not contain a token:",
                        data
                    );

                    alert(
                        "Login succeeded but no authentication token was returned."
                    );

                    return;
                }


                // --------------------------------------
                // Store authentication information
                // --------------------------------------

                localStorage.setItem(
                    "fedEscapeToken",
                    data.token
                );


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


    registerForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


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


            try {

                // --------------------------------------
                // Send registration to backend
                // --------------------------------------

                const response = await fetch(
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


                alert(
                    "Registration successful. Please log in."
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
            }

        }
    );
}