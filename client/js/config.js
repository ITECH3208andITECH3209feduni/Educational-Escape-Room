// The Node server normally supplies this configuration dynamically.
// This fallback also expects the frontend and API on the same origin.
(function () {
    "use strict";
    const frontendBase = new URL("../", document.currentScript.src);
    const appBase = new URL(frontendBase.href.replace(/client\/$/, ""));
    window.FEDEscapeConfig = Object.freeze({
        apiBaseUrl: new URL("api", appBase).href.replace(/\/+$/, ""),
        appBaseUrl: appBase.href
    });
})();
