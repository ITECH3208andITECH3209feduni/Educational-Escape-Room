const nodemailer = require("nodemailer");

// ======================================================
// CREATE EMAIL TRANSPORTER
// ======================================================

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

const createTransporter = () => {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT);
  const secure = process.env.EMAIL_SECURE === "true";
  const ignoreTLS = process.env.EMAIL_IGNORE_TLS === "true";
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Set EMAIL_HOST and a valid EMAIL_PORT");
  }
  if (Boolean(user) !== Boolean(pass)) {
    throw new Error("Set both EMAIL_USER and EMAIL_PASS, or leave both empty");
  }
  // Evan's no-TLS setting is for the local Postfix connection only.
  if (ignoreTLS && (secure || !["127.0.0.1", "localhost", "::1"].includes(host))) {
    throw new Error("EMAIL_IGNORE_TLS requires a local SMTP host and EMAIL_SECURE=false");
  }
  const options = { host, port, secure, ignoreTLS, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000 };
  if (user && pass) options.auth = { user, pass };
  // Keep Nodemailer's normal TLS certificate validation for TLS connections.
  return nodemailer.createTransport(options);
};

// ======================================================
// SEND EMAIL VERIFICATION EMAIL
// ======================================================

const sendVerificationEmail = async (
  email,
  name,
  verificationToken
) => {
  const transporter = createTransporter();

  const clientUrl =
    (process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 5000}${(process.env.APP_BASE_PATH || "").replace(/\/+$/, "")}`).replace(/\/+$/, "");

  const verificationUrl =
    `${clientUrl}/verify-email.html?token=${verificationToken}`;

  const mailOptions = {
    from:
      process.env.EMAIL_FROM ||
      process.env.EMAIL_USER,

    to: email,

    subject: "Verify your FEDEscape email address",

    text: `
Hello ${name},

Welcome to FEDEscape.

Please verify your email address by opening the link below:

${verificationUrl}

This verification link will expire in 24 hours.

If you did not create a FEDEscape account, you can ignore this email.

FEDEscape Team
`,

    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
      ">

        <h2>Welcome to FEDEscape</h2>

        <p>Hello ${escapeHtml(name)},</p>

        <p>
          Thank you for creating a FEDEscape account.
          Please verify your email address before logging in.
        </p>

        <p style="margin: 30px 0;">
          <a
            href="${verificationUrl}"
            style="
              background: #2563eb;
              color: white;
              padding: 12px 22px;
              text-decoration: none;
              border-radius: 6px;
              display: inline-block;
            "
          >
            Verify Email
          </a>
        </p>

        <p>
          This verification link will expire in 24 hours.
        </p>

        <p>
          If you did not create a FEDEscape account,
          you can safely ignore this email.
        </p>

        <p>FEDEscape Team</p>

      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

// Build links only from server configuration, never from a request Host header.
function passwordResetUrl(token) {
  const base = (process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 5000}${(process.env.APP_BASE_PATH || "").replace(/\/+$/, "")}`).replace(/\/+$/, "");
  const url = new URL(base + "/reset-password.html");
  if (!["http:", "https:"].includes(url.protocol) || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
    throw new Error("CLIENT_URL must use HTTPS in production");
  }
  // Fragment tokens never enter the web server's page-access logs or Referer header.
  url.hash = new URLSearchParams({ token }).toString();
  return url.href;
}
async function sendPasswordResetEmail(email, name, token) {
  const url = passwordResetUrl(token);
  return createTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to: email,
    subject: "Reset your FEDEscape password",
    text: `Hello ${name},\n\nYou requested a new FEDEscape password. Open this link to choose one:\n\n${url}\n\nThis link expires in 15 minutes and can be used once. A newer reset email replaces earlier links. If you did not request this, ignore this email; your password has not changed.\n\nFEDEscape Team`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>Reset your password</h2><p>Hello ${escapeHtml(name)},</p><p>Use the link below to choose a new FEDEscape password.</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>This link expires in 15 minutes and can be used once. A newer reset email replaces earlier links.</p><p>If you did not request this, ignore this email. Your password has not changed.</p><p>FEDEscape Team</p></div>`
  });
}
async function sendPasswordChangedEmail(email, name) {
  return createTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to: email,
    subject: "Your FEDEscape password was changed",
    text: `Hello ${name},\n\nYour FEDEscape password has been reset. All existing sessions have been signed out.\n\nIf you did not make this change, reset your password again through FEDEscape and contact your project administrator.\n\nFEDEscape Team`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>Password changed</h2><p>Hello ${escapeHtml(name)},</p><p>Your FEDEscape password has been reset. All existing sessions have been signed out.</p><p>If you did not make this change, reset your password again through FEDEscape and contact your project administrator.</p><p>FEDEscape Team</p></div>`
  });
}
module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail, passwordResetUrl };
