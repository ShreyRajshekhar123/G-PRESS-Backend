// index.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const cron = require("node-cron");
const admin = require("firebase-admin");
const path = require("path");
const axios = require("axios"); // NEW: Import axios for sending internal heartbeat requests

// Import your custom Firebase authentication middleware
const {
  verifyFirebaseTokenAndGetUserId,
} = require("./middleware/authMiddleware");

// Import routes
const newsRouter = require("./routes/news");
const aiRouter = require("./routes/ai");
const questionsRouter = require("./routes/questions");

// Import services for scheduled tasks
const {
  runAllScrapers,
  cleanupOldNews,
} = require("./services/ingestionService");
const {
  processArticlesForContentAndAI,
} = require("./services/articleProcessor");

// Import models (important for Mongoose to know about them if used in other modules implicitly)
require("./models/User");
require("./models/Question");
require("./models/TheHindu");
require("./models/DNA");
require("./models/HindustanTimes");
require("./models/IndianExpress");
require("./models/TimesOfIndia");

const app = express();

// Firebase Admin SDK Initialization
let serviceAccount;
if (
  process.env.NODE_ENV === "production" &&
  process.env.FIREBASE_ADMIN_SDK_JSON_BASE64
) {
  try {
    const serviceAccountJson = Buffer.from(
      process.env.FIREBASE_ADMIN_SDK_JSON_BASE64,
      "base64"
    ).toString("utf8");
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (error) {
    console.error(
      "❌ Error decoding or parsing FIREBASE_ADMIN_SDK_JSON_BASE64:",
      error.message
    );
    process.exit(1);
  }
} else {
  try {
    serviceAccount = require(path.resolve(
      __dirname,
      "config",
      "serviceAccountKey.json"
    ));
  } catch (error) {
    console.error(
      "❌ Failed to load Firebase service account key locally. Ensure 'serviceAccountKey.json' exists in 'config/' and is properly configured for local development.",
      error.message
    );
    process.exit(1);
  }
}

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
  // Do not exit process in production for Firebase errors unless critical.
  // In local development, exiting might be acceptable.
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
}

// Middleware
app.use(bodyParser.json());
app.use(express.json()); // Ensure express.json() is also used

const allowedOrigins = ["http://localhost:3000", "https://g-press.vercel.app"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Database Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/newsDB", {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    // Removed useNewUrlParser and useUnifiedTopology as they are deprecated in recent Mongoose versions.
    // If you are using an older Mongoose version that requires them, uncomment these lines if needed for your Mongoose version:
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully.");

    // Initial data pipeline run on startup
    (async () => {
      try {
        console.log("🚀 Starting initial data pipeline run...");
        const initialPipelineStartTime = process.hrtime.bigint();

        const scraperStartTime = process.hrtime.bigint();
        console.log("Running initial scrapers...");
        await runAllScrapers();
        const scraperEndTime = process.hrtime.bigint();
        const scraperDurationMs =
          Number(scraperEndTime - scraperStartTime) / 1_000_000;
        console.log(
          `Initial scraping and ingestion completed in ${scraperDurationMs.toFixed(
            2
          )} ms.`
        );

        const articleProcessorStartTime = process.hrtime.bigint();
        console.log("Processing articles for content and AI...");
        await processArticlesForContentAndAI();
        const articleProcessorEndTime = process.hrtime.bigint();
        const articleProcessorDurationMs =
          Number(articleProcessorEndTime - articleProcessorStartTime) /
          1_000_000;
        console.log(
          `Initial article content and AI processing completed in ${articleProcessorDurationMs.toFixed(
            2
          )} ms.`
        );

        const cleanupInitialStartTime = process.hrtime.bigint();
        console.log("Running initial cleanup of old news (on startup)...");
        await cleanupOldNews(20); // Keep news for 20 days
        const cleanupInitialEndTime = process.hrtime.bigint();
        const cleanupInitialDurationMs =
          Number(cleanupInitialEndTime - cleanupInitialStartTime) / 1_000_000;
        console.log(
          `Initial cleanup completed in ${cleanupInitialDurationMs.toFixed(
            2
          )} ms.`
        );

        const initialPipelineEndTime = process.hrtime.bigint();
        const initialPipelineDurationMs =
          Number(initialPipelineEndTime - initialPipelineStartTime) / 1_000_000;
        console.log(
          `✅ Initial data pipeline run complete in ${initialPipelineDurationMs.toFixed(
            2
          )} ms.`
        );
      } catch (error) {
        console.error(
          "❌ Error during initial data pipeline on startup:",
          error
        );
      }
    })();

    // Schedule scrapers and AI processing to run every 2 hours
    cron.schedule(
      "0 */2 * * *",
      async () => {
        const scheduledPipelineStartTime = process.hrtime.bigint();
        console.log(
          `⏰ Starting scheduled data pipeline at ${new Date().toISOString()}...`
        );
        try {
          const scraperStartTime = process.hrtime.bigint();
          console.log("Running scheduled scrapers...");
          await runAllScrapers();
          const scraperEndTime = process.hrtime.bigint();
          const scraperDurationMs =
            Number(scraperEndTime - scraperStartTime) / 1_000_000;
          console.log(
            `Scheduled scraping and ingestion completed in ${scraperDurationMs.toFixed(
              2
            )} ms.`
          );

          const articleProcessorStartTime = process.hrtime.bigint();
          console.log("Processing articles for content and AI...");
          await processArticlesForContentAndAI();
          const articleProcessorEndTime = process.hrtime.bigint();
          const articleProcessorDurationMs =
            Number(articleProcessorEndTime - articleProcessorStartTime) /
            1_000_000;
          console.log(
            `Scheduled article content and AI processing completed in ${articleProcessorDurationMs.toFixed(
              2
            )} ms.`
          );

          console.log("✅ Scheduled data pipeline run complete.");
        } catch (error) {
          console.error("❌ Error during scheduled data pipeline:", error);
        } finally {
          const scheduledPipelineEndTime = process.hrtime.bigint();
          const scheduledPipelineDurationMs =
            Number(scheduledPipelineEndTime - scheduledPipelineStartTime) /
            1_000_000;
          console.log(
            `--- Scheduled data pipeline finished in ${scheduledPipelineDurationMs.toFixed(
              2
            )} ms ---`
          );
        }
      },
      {
        timezone: "Asia/Kolkata",
      }
    );

    // Schedule cleanup of old news daily at 3 AM
    cron.schedule(
      "0 3 * * *",
      async () => {
        const cleanupStartTime = process.hrtime.bigint();
        console.log(
          `🧹 Running scheduled cleanup of old news at ${new Date().toISOString()}...`
        );
        try {
          await cleanupOldNews(20); // Keep news for 20 days
          console.log("✅ Scheduled cleanup complete.");
        } catch (error) {
          console.error("❌ Error during scheduled cleanup:", error);
        } finally {
          const cleanupEndTime = process.hrtime.bigint();
          const cleanupDurationMs =
            Number(cleanupEndTime - cleanupStartTime) / 1_000_000;
          console.log(
            `--- Scheduled cleanup finished in ${cleanupDurationMs.toFixed(
              2
            )} ms ---`
          );
        }
      },
      {
        timezone: "Asia/Kolkata",
      }
    );
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Define public routes BEFORE applying authentication middleware
app.get("/health", (req, res) => {
  res.status(200).send("G-Press Backend is healthy and awake!");
});

// NEW: Add a simple endpoint for internal randomized heartbeat monitoring
app.get("/internal-heartbeat", (req, res) => {
  console.log("Internal heartbeat endpoint hit at:", new Date().toISOString());
  res.status(200).send("OK");
});

app.get("/", (req, res) => {
  res.status(200).send("G-Press Backend is running!");
});

// IMPORTANT: Assuming you have an authentication-specific router for login/registration
// that does NOT use the token verification middleware.
// For example, if you have routes like /api/auth/login, /api/auth/register etc.
// you would apply them here without the middleware.
// For now, based on your frontend, the /api/news/sync-user route should be here or handled appropriately.
// Your frontend makes a POST to `/api/news/sync-user` *with* the token immediately after Firebase login.
// This means `sync-user` itself needs to be protected, or at least capable of handling the `firebaseUid`.
// Let's assume for now `sync-user` is part of newsRouter and will be protected.
// If your `sync-user` route *must* be accessible without token for the very first sync,
// you'd need to define it *before* the `app.use` that applies `verifyFirebaseTokenAndGetUserId` to `newsRouter`.

// Apply authentication middleware to all routes that require it
app.use("/api/news", verifyFirebaseTokenAndGetUserId, newsRouter);
app.use("/api/ai", verifyFirebaseTokenAndGetUserId, aiRouter);
app.use("/api/questions", verifyFirebaseTokenAndGetUserId, questionsRouter);

// NEW: Randomized Heartbeat Logic
// This logic will run continuously as part of your main application.
function getRandomInterval(minMinutes, maxMinutes) {
  const minMs = minMinutes * 60 * 1000;
  const maxMs = maxMinutes * 60 * 1000;
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);

  // Determine the base URL for the internal heartbeat
  // Corrected approach: Always use localhost for internal pings
  const HEARTBEAT_TARGET_URL = `http://localhost:${PORT}/internal-heartbeat`;

  // Function to send the internal heartbeat
  async function sendInternalHeartbeat() {
    try {
      const response = await axios.get(HEARTBEAT_TARGET_URL);
      console.log(
        `Self-ping to internal-heartbeat successful. Status: ${response.status}`
      );
    } catch (error) {
      console.error(
        `Error during self-ping to internal-heartbeat: ${error.message}`
      );
      // Log the full error for debugging, especially network errors
      if (error.response) {
        console.error("Error Response Data:", error.response.data);
        console.error("Error Response Status:", error.response.status);
        console.error("Error Response Headers:", error.response.headers);
      } else if (error.request) {
        console.error("Error Request:", error.request);
      } else {
        console.error("Error Message:", error.message);
      }
    }
  }

  // Function to schedule the next randomized heartbeat
  function scheduleNextRandomHeartbeat() {
    // MODIFIED LINE: Changed the getRandomInterval range to 1 to 4 minutes
    const interval = getRandomInterval(1, 4); // Randomized interval between 1 and 4 minutes
    console.log(
      `Scheduling next randomized internal heartbeat in ${
        interval / 1000 / 60
      } minutes.`
    );
    setTimeout(() => {
      sendInternalHeartbeat();
      scheduleNextRandomHeartbeat(); // Schedule the next one after this one runs
    }, interval);
  }

  // Start the randomized heartbeat scheduler after the server starts
  console.log("🚀 Starting randomized internal heartbeat scheduler...");
  sendInternalHeartbeat(); // Send an initial heartbeat immediately
  scheduleNextRandomHeartbeat();
});
