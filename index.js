// C:\Users\OKKKK\Desktop\G-Press 1\G-Press\Server\index.js

require("dotenv").config(); // Load environment variables from .env

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const cron = require("node-cron");
const admin = require("firebase-admin"); // Firebase Admin SDK
const path = require("path"); // Added for path resolution

// --- Firebase Admin SDK Initialization ---
// IMPORTANT: For production, load service account key from environment variable
// For local development, load directly from file (ensured to be in .gitignore)
let serviceAccount;
if (
  process.env.NODE_ENV === "production" &&
  process.env.FIREBASE_ADMIN_SDK_JSON_BASE64
) {
  // In production, decode the base64 string from environment variable
  const serviceAccountJson = Buffer.from(
    process.env.FIREBASE_ADMIN_SDK_JSON_BASE64,
    "base64"
  ).toString("utf8");
  serviceAccount = JSON.parse(serviceAccountJson);
} else {
  // For local development, load from the file
  // Ensure 'serviceAccountKey.json' is the correct name you chose for the new key
  // and that it's located in the 'config' directory, which is in .gitignore
  try {
    serviceAccount = require(path.resolve(
      __dirname,
      "config",
      "serviceAccountKey.json"
    ));
  } catch (error) {
    console.error(
      "Failed to load Firebase service account key locally. Ensure 'serviceAccountKey.json' exists in 'Server/config/' and is properly configured for local development.",
      error
    );
    // You might want to exit the process or handle this more gracefully depending on your app's needs
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Add other Firebase configurations if you have them, e.g.,
  // databaseURL: "https://your-project-id.firebaseio.com",
});

console.log("✅ Firebase Admin SDK initialized.");
// --- End Firebase Admin SDK Initialization ---

// =======================================================================
// CRITICAL FIX: Explicitly require ALL Mongoose models here.
// This ensures they are registered with Mongoose before any population occurs.
// =======================================================================
require("./models/User"); // Your User model
require("./models/Question"); // Your Question model
require("./models/TheHindu"); // Your TheHindu news model
require("./models/DNA"); // Your DNA news model
require("./models/HindustanTimes"); // Your HindustanTimes news model
require("./models/IndianExpress"); // Your IndianExpress news model
require("./models/TimesOfIndia"); // Your TimesOfIndia news model
// =======================================================================

// Import all routers and utility functions
const {
  router: newsRoutes,
  runAllScrapers,
  cleanupOldNews,
} = require("./routes/news");
const { router: aiRouter } = require("./routes/ai"); // General AI router
const { router: questionsRouter } = require("./routes/questions"); // NEW: Dedicated questions router

// Services imported for cron jobs
const {
  processArticlesForContentAndAI,
} = require("./services/articleProcessor"); // Assumed to exist

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/newsDB", {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    // Start initial data pipeline and schedule cron jobs ONLY AFTER DB connection is successful
    console.log(
      `--- Starting Initial Data Pipeline on Server Startup (${new Date().toLocaleString()}) ---`
    );
    (async () => {
      try {
        await runAllScrapers(); // Run scrapers immediately on start
        await processArticlesForContentAndAI(); // Process content immediately on start
      } catch (error) {
        console.error("Error during initial data pipeline on startup:", error);
      }
      console.log(
        `--- Finished Initial Data Pipeline on Server Startup (${new Date().toLocaleString()}) ---`
      );
    })();

    // Schedule automated tasks
    cron.schedule("0 */2 * * *", async () => {
      // Every 2 hours
      console.log(
        `--- Starting Scheduled Full Data Pipeline (${new Date().toLocaleString()}) ---`
      );
      try {
        await runAllScrapers();
        await processArticlesForContentAndAI();
      } catch (error) {
        console.error("Error during scheduled data pipeline:", error);
      }
      console.log(
        `--- Finished Scheduled Full Data Pipeline (${new Date().toLocaleString()}) ---`
      );
    });

    cron.schedule("0 3 * * *", () => {
      // Every day at 3 AM
      console.log("Running scheduled cleanup job...");
      cleanupOldNews(3); // Clean articles older than 3 days
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// API Routes - Mount routers
app.use("/api/news", newsRoutes); // Handles /api/news/all, /api/news/:source, bookmarks, user sync
app.use("/api/ai", aiRouter); // Handles general AI endpoints (if any)
app.use("/api/questions", questionsRouter); // Handles /api/questions/generate-on-demand, /api/questions/get-by-article

// Basic route for testing server status
app.get("/", (req, res) => {
  res.status(200).send("G-Press Backend is running!");
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
});
