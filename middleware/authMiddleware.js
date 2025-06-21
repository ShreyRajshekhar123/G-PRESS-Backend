// C:\Users\OKKKK\Desktop\G-Press\G-Press\Server\middleware\authMiddleware.js

const admin = require("firebase-admin"); // Import Firebase Admin SDK

// Middleware to verify Firebase ID token and attach firebaseUid to request
const verifyFirebaseTokenAndGetUserId = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn(
      "[Auth Middleware] No Authorization header or invalid format."
    );
    return res
      .status(401)
      .json({ message: "No authentication token provided or invalid format." });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.firebaseUid = decodedToken.uid; // Attach Firebase UID to request object
    // console.log(`[Auth Middleware] Token verified for UID: ${req.firebaseUid}`); // Uncomment for verbose logging
    next();
  } catch (error) {
    console.error(
      "[Auth Middleware] Error verifying Firebase ID token:",
      error.message
    );
    // Specifically check for token expiration or invalidity
    if (error.code === "auth/id-token-expired") {
      return res
        .status(401)
        .json({
          message: "Unauthorized: Session expired. Please log in again.",
        });
    }
    if (
      error.code === "auth/argument-error" ||
      error.code === "auth/invalid-id-token"
    ) {
      return res.status(401).json({ message: "Unauthorized: Invalid token." });
    }
    return res.status(403).json({ message: "Unauthorized: Access denied." });
  }
};

module.exports = { verifyFirebaseTokenAndGetUserId };
