const nodemailer = require("nodemailer");

// ======================================================
// CREATE EMAIL TRANSPORTER
// ======================================================

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
  const options = { host, port, secure, ignoreTLS };
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
    (process.env.CLIENT_URL || "http://localhost:5500").replace(/\/+$/, "");

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

        <p>Hello ${name},</p>

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

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  sendVerificationEmail
};