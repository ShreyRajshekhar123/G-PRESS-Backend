require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const cron = require("node-cron");
const admin = require("firebase-admin");
const path = require("path");

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
      "❌ Failed to load Firebase service account key locally. Ensure 'serviceAccountKey.json' exists in 'Server/config/' and is properly configured for local development.",
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
  process.exit(1);
}

require("./models/User");
require("./models/Question");
require("./models/TheHindu");
require("./models/DNA");
require("./models/HindustanTimes");
require("./models/IndianExpress");
require("./models/TimesOfIndia");

const {
  router: newsRoutes,
  runAllScrapers,
  cleanupOldNews,
} = require("./routes/news");
const { router: aiRouter } = require("./routes/ai");
const { router: questionsRouter } = require("./routes/questions");

const {
  processArticlesForContentAndAI,
} = require("./services/articleProcessor");

const app = express();

app.use(bodyParser.json());

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

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/newsDB", {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    (async () => {
      try {
        await runAllScrapers();
        await processArticlesForContentAndAI();
      } catch (error) {
        console.error("Error during initial data pipeline on startup:", error);
      }
    })();

    cron.schedule("0 */2 * * *", async () => {
      try {
        await runAllScrapers();
        await processArticlesForContentAndAI();
      } catch (error) {
        console.error("Error during scheduled data pipeline:", error);
      }
    });

    cron.schedule("0 3 * * *", () => {
      cleanupOldNews(3);
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.use("/api/news", newsRoutes);
app.use("/api/ai", aiRouter);
app.use("/api/questions", questionsRouter);

app.get("/", (req, res) => {
  res.status(200).send("G-Press Backend is running!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
});
