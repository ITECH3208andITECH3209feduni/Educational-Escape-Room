// Shared API/session client. Authentication credentials are never available to JS.
(function () {
    "use strict";
    const nativeFetch = window.fetch.bind(window);
    const config = window.FEDEscapeConfig;
    let csrf = null;
    let csrfRequest = null;
    let loggingOut = false;
    const userKeys = ["fedEscapeToken", "fedEscapeLoggedIn", "fedEscapeUserId", "fedEscapeUserName", "fedEscapeUserEmail", "fedEscapeUserRole", "fedEscapeAttemptId"];
    function clearHints() { userKeys.forEach(key => localStorage.removeItem(key)); }
    // Remove credentials issued by older releases. Existing users must sign in again.
    if (localStorage.getItem("fedEscapeToken")) clearHints();
    async function getCsrf() {
        if (csrf) return csrf;
        if (!csrfRequest) csrfRequest = (async () => {
            const response = await nativeFetch(config.apiBaseUrl + "/auth/csrf", { credentials: "same-origin", cache: "no-store" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Unable to start a security session.");
            csrf = data.csrfToken;
            return csrf;
        })().finally(() => { csrfRequest = null; });
        return csrfRequest;
    }
    async function apiFetch(url, options = {}, retry = true) {
        const target = new URL(url, window.location.href);
        if (target.origin !== window.location.origin) throw new Error("Open FEDEscape through the Node server, normally http://localhost:5000, and try again.");
        const method = (options.method || "GET").toUpperCase();
        const headers = new Headers(options.headers);
        if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-CSRF-Token", await getCsrf());
        const response = await nativeFetch(target.href, { ...options, headers, credentials: "same-origin", cache: "no-store" });
        if (response.status === 403 && retry) {
            const data = await response.clone().json().catch(() => ({}));
            if (data.code === "CSRF_INVALID") {
                csrf = null;
                return apiFetch(url, options, false); // Rejected by middleware before any action ran.
            }
        }
        if (target.pathname.endsWith("/auth/login") && response.ok) {
            csrf = (await response.clone().json()).csrfToken;
        }
        if (response.ok && (target.pathname.includes("/auth/reset-password/") || target.pathname.endsWith("/auth/change-password"))) {
            csrf = null;
            clearHints();
        }
        if (response.status === 401 && !target.pathname.endsWith("/auth/login")) clearHints();
        return response;
    }
    async function logout() {
        if (loggingOut) return;
        loggingOut = true;
        try {
            const response = await apiFetch(config.apiBaseUrl + "/auth/logout", { method: "POST" });
            if (!response.ok) throw new Error("Logout could not be completed. Please try again.");
            csrf = null;
            clearHints();
            window.location.href = new URL("login.html", new URL(config.appBaseUrl, window.location.href)).href;
        } catch (error) { alert(error.message); }
        finally { loggingOut = false; }
    }
    document.addEventListener("click", event => {
        if (event.target.closest("[data-logout], #logoutButton, #logoutLink")) {
            event.preventDefault();
            logout();
        }
    });
    window.FEDEscapeSession = Object.freeze({ fetch: apiFetch, logout,
        hasSessionHint: () => localStorage.getItem("fedEscapeLoggedIn") === "true" });
})();
