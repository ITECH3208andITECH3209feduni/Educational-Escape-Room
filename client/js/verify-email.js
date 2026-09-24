document.addEventListener("DOMContentLoaded", async () => {
    const verificationTitle =
        document.getElementById("verificationTitle");

    const verificationMessage =
        document.getElementById("verificationMessage");

    const verificationActions =
        document.getElementById("verificationActions");

    // Backend API used during local development
    const API_BASE_URL = "http://localhost:5000/api";

    // Get verification token from the email link
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    // No token in the URL
    if (!token) {
        verificationTitle.textContent =
            "Invalid verification link";

        verificationMessage.textContent =
            "No verification token was provided. Please use the verification link sent to your email.";

        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/auth/verify-email/${encodeURIComponent(token)}`
        );

        const data = await response.json();

        // Verification failed
        if (!response.ok) {
            verificationTitle.textContent =
                "Email verification failed";

            verificationMessage.textContent =
                data.message ||
                "This verification link is invalid or has expired.";

            return;
        }

        // Verification successful
        verificationTitle.textContent =
            "Email verified successfully!";

        verificationMessage.textContent =
            "Your FEDEscape account has been activated. You can now log in.";

        verificationActions.style.display = "block";

    } catch (error) {
        console.error("Email verification error:", error);

        verificationTitle.textContent =
            "Unable to verify email";

        verificationMessage.textContent =
            "FEDEscape could not connect to the server. Please make sure the server is running and try again.";
    }
});