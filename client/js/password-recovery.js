document.addEventListener("DOMContentLoaded", () => {
    "use strict";
    const forgotForm = document.getElementById("forgotPasswordForm");
    const resetForm = document.getElementById("resetPasswordForm");
    const form = forgotForm || resetForm;
    if (!form) return;
    const status = document.getElementById("recoveryStatus");
    const actions = document.getElementById("recoveryActions");
    const login = document.getElementById("recoveryLogin");
    const button = form.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    let pending = false;
    let complete = false;
    let token = null;
    function message(text, error = false) {
        status.setAttribute("role", error ? "alert" : "status");
        status.textContent = text;
    }
    if (resetForm) {
        const url = new URL(window.location.href);
        token = new URLSearchParams(url.hash.slice(1)).get("token");
        // Remove the secret from the address bar/history after reading it.
        window.history.replaceState(null, "", url.pathname);
        if (!/^[a-f0-9]{64}$/.test(token || "")) {
            form.hidden = true;
            actions.hidden = false;
            message("This reset link is missing or invalid. Open the link in your email again, or request a new one.", true);
            return;
        }
    }
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (pending || complete) return;
        let body;
        if (forgotForm) {
            body = { email: document.getElementById("recoveryEmail").value.trim() };
        } else {
            const password = document.getElementById("newPassword").value;
            const confirmPassword = document.getElementById("confirmNewPassword").value;
            if (password !== confirmPassword) {
                message("The passwords do not match. Please enter the same password twice.", true);
                return;
            }
            if (password.length < 6) {
                message("Use at least 6 characters for your password.", true);
                return;
            }
            if (new TextEncoder().encode(password).length > 72) {
                message("This password is too long. Please use a shorter passphrase.", true);
                return;
            }
            body = { password };
        }
        pending = true;
        button.disabled = true;
        form.setAttribute("aria-busy", "true");
        button.textContent = forgotForm ? "Requesting link…" : "Resetting password…";
        message(forgotForm ? "Requesting your reset link…" : "Updating your password…");
        try {
            const endpoint = forgotForm ? "/auth/forgot-password" : "/auth/reset-password/" + encodeURIComponent(token);
            const response = await window.FEDEscapeSession.fetch(window.FEDEscapeConfig.apiBaseUrl + endpoint, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok) {
                let text = data.message || "Unable to complete this request. Please try again.";
                if (response.status === 429) {
                    const seconds = Number(response.headers.get("Retry-After"));
                    if (Number.isFinite(seconds) && seconds > 0) text += ` Try again in about ${Math.ceil(seconds / 60)} minute(s).`;
                }
                message(text, true);
                if (resetForm && response.status === 400) actions.hidden = false;
                return;
            }
            complete = true;
            form.reset();
            form.hidden = true;
            login.hidden = false;
            if (forgotForm) {
                message(data.message + " The link expires 15 minutes after it is generated. If you request another email, use the newest link.");
                actions.hidden = false;
            } else {
                token = null;
                message("Your password has been reset. All previous sessions have been signed out. Log in with your new password.");
            }
            status.focus();
        } catch {
            message("We could not confirm the request. Check your connection and try again. If a reset may have completed, try logging in with your new password.", true);
        } finally {
            pending = false;
            button.disabled = complete;
            button.textContent = originalText;
            form.removeAttribute("aria-busy");
        }
    });
});
