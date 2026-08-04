/* ============================================================
   FedEscape – client/js/script.js
   Sprint 1: front-end behaviour only (no backend yet)

   Responsibilities (Rylan):
     - Navigation (mobile menu toggle + smooth scroll)
     - Login form validation
     - Register form validation
     - General button interactions / navigation

   NOTE ON IDs:
   This script looks for specific element IDs (listed under each
   section). If a teammate's HTML uses different IDs, either rename
   the HTML to match, or update the selector here. Every listener is
   guarded with an existence check, so a page that doesn't contain a
   given element simply skips that block instead of throwing an error.
   ============================================================ */

// Wait for the HTML to be fully parsed before touching the DOM.
document.addEventListener("DOMContentLoaded", function () {

  /* ----------------------------------------------------------
     HELPERS
     ---------------------------------------------------------- */

  // Simple, readable email pattern. Good enough for a front-end check;
  // real validation still happens on the server in a later sprint.
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Show an error message directly beneath a field.
  function showError(field, message) {
    // Highlight the offending input.
    field.style.borderColor = "#c0392b";

    // Re-use an existing error node if we already made one...
    let error = field.parentElement.querySelector(".js-error-message");

    // ...otherwise create it once and insert it right after the field.
    if (!error) {
      error = document.createElement("span");
      error.className = "js-error-message";
      error.style.color = "#c0392b";
      error.style.fontSize = "0.85rem";
      error.style.display = "block";
      error.style.marginTop = "4px";
      field.insertAdjacentElement("afterend", error);
    }
    error.textContent = message;
  }

  // Remove the error state + message from a field.
  function clearError(field) {
    field.style.borderColor = "";
    const error = field.parentElement.querySelector(".js-error-message");
    if (error) error.remove();
  }

  // Convenience: clear a field's error as soon as the user starts fixing it.
  function clearOnInput(field) {
    if (field) field.addEventListener("input", () => clearError(field));
  }


  /* ----------------------------------------------------------
     1. NAVIGATION
     Expected HTML:
       - a hamburger button with class "nav-toggle"
       - the menu container with class "nav-menu"
       - in-page links written as <a href="#about"> etc.
     ---------------------------------------------------------- */

  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.querySelector(".nav-menu");

  // Mobile hamburger: show/hide the menu.
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      navMenu.classList.toggle("open");
    });
  }

  // Smooth-scroll for same-page anchor links (Home / About / Features).
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      const targetId = link.getAttribute("href");
      // Ignore a lone "#" (often used as a placeholder link).
      if (targetId.length > 1) {
        const target = document.querySelector(targetId);
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: "smooth" });
          // Close the mobile menu after clicking a link.
          if (navMenu) navMenu.classList.remove("open");
        }
      }
    });
  });


  /* ----------------------------------------------------------
     2. LOGIN FORM VALIDATION
     Expected HTML (login.html):
       <form id="loginForm">
         <input id="loginEmail"    type="email">
         <input id="loginPassword" type="password">
       </form>
     ---------------------------------------------------------- */

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    const email = document.getElementById("loginEmail");
    const password = document.getElementById("loginPassword");

    // Clear each field's error as the user edits it.
    clearOnInput(email);
    clearOnInput(password);

    loginForm.addEventListener("submit", function (event) {
      event.preventDefault(); // No backend yet — stop the real submit.
      let valid = true;

      // Email: required + must look like an email.
      if (!email.value.trim()) {
        showError(email, "Please enter your email.");
        valid = false;
      } else if (!EMAIL_PATTERN.test(email.value.trim())) {
        showError(email, "Please enter a valid email address.");
        valid = false;
      }

      // Password: required.
      if (!password.value) {
        showError(password, "Please enter your password.");
        valid = false;
      }

      // Placeholder success behaviour for the Sprint 1 demo.
      if (valid) {
        alert("Login details look good! (Backend connection comes later.)");
        // Later: send credentials to the server, then redirect:
        // window.location.href = "dashboard.html";
      }
    });
  }


  /* ----------------------------------------------------------
     3. REGISTER FORM VALIDATION
     Expected HTML (register.html – Rijan's page):
       <form id="registerForm">
         <input  id="registerName">
         <input  id="registerEmail"           type="email">
         <input  id="registerPassword"        type="password">
         <input  id="registerConfirmPassword" type="password">
         <select id="registerRole">Teacher / Student</select>
       </form>
     ---------------------------------------------------------- */

  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    const name = document.getElementById("registerName");
    const email = document.getElementById("registerEmail");
    const password = document.getElementById("registerPassword");
    const confirmPw = document.getElementById("registerConfirmPassword");
    const role = document.getElementById("registerRole");

    [name, email, password, confirmPw, role].forEach(clearOnInput);

    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      let valid = true;

      // Full name: required.
      if (!name.value.trim()) {
        showError(name, "Please enter your full name.");
        valid = false;
      }

      // Email: required + format.
      if (!email.value.trim()) {
        showError(email, "Please enter your email.");
        valid = false;
      } else if (!EMAIL_PATTERN.test(email.value.trim())) {
        showError(email, "Please enter a valid email address.");
        valid = false;
      }

      // Password: required + minimum length.
      if (!password.value) {
        showError(password, "Please choose a password.");
        valid = false;
      } else if (password.value.length < 6) {
        showError(password, "Password must be at least 6 characters.");
        valid = false;
      }

      // Confirm password: must be filled and must match.
      if (!confirmPw.value || confirmPw.value !== password.value) {
        showError(confirmPw, "Passwords do not match.");
        valid = false;
      }

      // Role: must pick Teacher or Student (empty default value = not chosen).
      if (role && !role.value) {
        showError(role, "Please select a role.");
        valid = false;
      }

      if (valid) {
        alert("Registration details look good! (Backend connection comes later.)");
        // Later: send new-user data to the server, then redirect:
        // window.location.href = "login.html";
      }
    });
  }


  /* ----------------------------------------------------------
     4. GENERAL BUTTON / NAVIGATION INTERACTIONS
     Any element with a data-href attribute navigates on click, e.g.
       <button class="btn" data-href="login.html">Login</button>
     This keeps navigation buttons working without inline onclick.
     ---------------------------------------------------------- */

  document.querySelectorAll("[data-href]").forEach(function (button) {
    button.addEventListener("click", function () {
      window.location.href = button.getAttribute("data-href");
    });
  });

});