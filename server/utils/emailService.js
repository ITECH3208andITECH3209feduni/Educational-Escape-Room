const nodemailer = require("nodemailer");

// ======================================================
// CREATE EMAIL TRANSPORTER
// ======================================================

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === "true",

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },

    // Local development fix for certificate-chain errors.
    // Remove this when deploying if the production server
    // has a normal trusted certificate chain.
    tls: {
      rejectUnauthorized: false
    }
  });
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
    process.env.CLIENT_URL || "http://localhost:5500";

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