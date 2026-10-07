const User = require("../models/User");
const { destroySession, touchSession } = require("./session");
// Bearer JWTs are no longer accepted, including tokens issued before this update.
const protect = async (req, res, next) => {
  const session = req.session;
  if (!session?.userId) return res.status(401).json({ success: false, message: "Please log in again." });
  const user = await User.findById(session.userId).select("+sessionVersion");
  if (!user || (user.sessionVersion || "") !== session.sessionVersion || !user.emailVerified) {
    await destroySession(req, res);
    return res.status(401).json({ success: false, message: "Your session has expired. Please log in again." });
  }
  if (user.accountStatus !== "active") {
    await destroySession(req, res);
    return res.status(403).json({ success: false, message: "Your account is currently unavailable." });
  }
  await touchSession(req);
  req.user = { id: user._id, role: user.role, email: user.email };
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to perform this action."
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize
};