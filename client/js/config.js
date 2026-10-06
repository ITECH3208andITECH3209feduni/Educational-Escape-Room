// Shared API configuration. This file must load before application scripts.
// Evan: if the proxy uses /api instead, set API_BASE_OVERRIDE to "/api".
// A blank override uses an API under the directory containing this frontend.
(function () {
    "use strict";
    const API_BASE_OVERRIDE = "";
    const scriptUrl = document.currentScript.src;
    const appBase = new URL("../", scriptUrl);
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const apiBase = API_BASE_OVERRIDE
        ? new URL(API_BASE_OVERRIDE, window.location.origin).href
        : isLocal
            ? "http://localhost:5000/api"
            : new URL("api", new URL(appBase.href.replace(/client\/$/, ""))).href;
    window.FEDEscapeConfig = Object.freeze({
        apiBaseUrl: apiBase.replace(/\/+$/, ""),
        appBaseUrl: appBase.href
    });
})();
