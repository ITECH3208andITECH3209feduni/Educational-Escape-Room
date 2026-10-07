// Explicit equivalents of the relevant Helmet headers, with an app-specific CSP.
// Inline styles support the existing UI; executable inline scripts are never allowed.
module.exports = (req, res, next) => {
  const production = process.env.NODE_ENV === "production";
  const policy = [
    "default-src 'self'", "script-src 'self'", "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https:",
    "media-src 'self' https:", "connect-src 'self'", "frame-src https://www.youtube.com",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"
  ];
  if (production) policy.push("upgrade-insecure-requests");
  res.set({
    "Content-Security-Policy": policy.join("; "),
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer", "X-DNS-Prefetch-Control": "off",
    "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Permitted-Cross-Domain-Policies": "none"
  });
  if (production) res.set("Strict-Transport-Security", "max-age=31536000");
  next();
};
