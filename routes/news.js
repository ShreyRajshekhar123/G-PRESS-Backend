const express = require("express");
const router = express.Router();
const { spawn } = require("child_process"); // For Python scraper
const path = require("path");
const mongoose = require("mongoose");

const {
  verifyFirebaseTokenAndGetUserId,
} = require("../middleware/authMiddleware"); // Import middleware
const { sourceConfig } = require("../config/sources"); // Import sourceConfig
const User = require("../models/User"); // Import User model
const Question =
  mongoose.models.Question ||
  mongoose.model(
    "Question",
    new mongoose.Schema({
      articleId: mongoose.Schema.Types.ObjectId,
      articleSource: String,
      question: String,
      options: [String],
      correctAnswer: String,
    })
  ); // Import Question model (or minimal schema if not fully defined elsewhere)

// Helper to get a Mongoose model by its name string
const getModelByName = (modelName) => {
  try {
    return mongoose.model(modelName);
  } catch (error) {
    console.error(`Error: Model '${modelName}' not registered.`, error.message);
    return null;
  }
};

// Helper to format source configKey (e.g., 'hindustan-times') to a display name (e.g., 'Hindustan Times')
const formatSourceForDisplay = (configKey) => {
  switch (configKey) {
    case "hindu":
      return "The Hindu";
    case "dna":
      return "DNA India";
    case "hindustan-times":
      return "Hindustan Times";
    case "ie":
      return "Indian Express";
    case "toi":
      return "Times of India";
    case "ndtv":
      return "NDTV";
    default:
      return configKey
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
};

// --- NEW: Category Assignment Logic ---
// IMPORTANT: These categories MUST exactly match the enum values in your Mongoose schema.
// If you add new categories here, you MUST update your Mongoose schema accordingly.
const categoryKeywords = {
  "Polity & Governance": [
    "modi",
    "government",
    "election",
    "parliament",
    "congress",
    "bjp",
    "party",
    "minister",
    "cabinet",
    "policy",
    "political",
    "judiciary",
    "justice",
    "supreme court",
    "governance",
    "rajnath",
    "gandhi",
    "karnataka",
    "bihar",
  ],
  Economy: [
    "economy",
    "market",
    "finance",
    "sbi",
    "company",
    "investment",
    "shares",
    "stock",
    "rupee",
    "bank",
    "ipo",
    "profit",
    "sales",
    "revenue",
    "bill gates",
    "amazon",
    "genpact",
    "hdfc",
    "icici",
    "jpmorgan chase",
    "fiscal",
    "tax",
  ],
  "Environment & Ecology": [
    "climate",
    "pollution",
    "environment",
    "global warming",
    "conservation",
    "water",
    "river",
    "ecology",
  ],
  "Science & Technology": [
    "ai",
    "tech",
    "software",
    "startup",
    "app",
    "google",
    "apple",
    "microsoft",
    "elon musk",
    "tesla",
    "spacex",
    "chip",
    "semiconductor",
    "nasa",
    "nuclear",
    "research",
    "discovery",
    "astronomy",
    "physics",
    "biology",
    "science",
  ],
  "International Relations": [
    "iran",
    "israel",
    "us",
    "russia",
    "china",
    "pakistan",
    "ukraine",
    "conflict",
    "international",
    "treaty",
    "global",
    "europe",
    "canada",
    "hong kong",
    "middle east",
    "diplomat",
    "un",
  ],
  "Art & Culture": [
    "artist",
    "portrait",
    "culture",
    "music",
    "bollywood",
    "hollywood",
    "film",
    "movie",
    "actor",
    "actress",
    "cinema",
    "celebrity",
    "series",
    "ott",
    "aamir khan",
    "hrithik roshan",
    "ranveer singh",
    "amitabh bachchan",
    "sonakshi sinha",
    "neena gupta",
    "kuvempu",
    "sushma thota",
    "thota vaikuntam",
    "world music day",
  ],
  History: ["history", "kanishka bombing"],
  "Social Issues": [
    "women",
    "gender",
    "social security",
    "human rights",
    "pension",
    "toilet clinic",
    "neurodivergence",
    "parkinson's",
    "public health",
    "issues",
    "migrant",
    "evacuation",
  ],
  "Defence & Security": [
    "defence",
    "security",
    "military",
    "army",
    "police",
    "dgca",
    "air india",
    "terror",
    "bombing",
    "quds force",
    "idf",
  ],
  "Awards, Persons & Places in News": [
    "awards",
    "persons",
    "places",
    "in news",
    "kuvempu",
    "sushma thota",
    "thota vaikuntam",
    "pawan kalyan",
    "h.d. kumaraswamy",
    "n. chandrababu naidu",
    "narendra modi",
    "r.n. ravi",
    "nitish kumar",
    "shahrukh khan",
    "randeep hooda",
    "jeff bezos",
    "lauren sanchez",
    "vance boelter",
    "sunjay kapur",
    "sanam saeed",
    "mohib mirza",
    "dorothy shea",
    "jamie dimon",
    "priyank kharge",
    "neeraj chopra",
    "parag parikh",
    "shabir shah",
    "shreya ghoshal",
    "dr. bhanu mishra",
    "amitabh bachchan",
    "yashasvi jaiswal",
    "rishabh pant",
    "shubman gill",
    "sunil gavaskar",
    "stuart broad",
    "ben stokes",
    "michael vaughan",
    "rahul gandhi",
    "donald trump",
    "asim munir",
    "shehbaz sharif",
    "maharaja of jaipur sawai padmanabh singh",
  ],
  National: [
    "india",
    "indian",
    "delhi",
    "mumbai",
    "bengaluru",
    "karnataka",
    "jammu",
    "madurai",
    "kochi",
    "bihar",
    "hyderabad",
    "ahmedabad",
    "visakhapatnam",
    "lok sabha",
    "state",
  ],
  Sports: [
    "cricket",
    "football",
    "match",
    "team",
    "player",
    "score",
    "tennis",
    "olympics",
    "world cup",
    "ipl",
    "test",
    "century",
    "shubman gill",
    "rishabh pant",
    "yashasvi jaiswal",
    "ben stokes",
    "super rugby",
  ],
  Miscellaneous: [
    "miscellaneous",
    "qr codes",
    "sugar mill",
    "monetary policy",
    "startup",
    "ecommerce",
    "train services",
    "footpath",
  ], // General terms that don't fit other specific categories
};

// Define the exact enum values from your Mongoose schema to filter assigned categories
const SCHEMA_ENUM_CATEGORIES = [
  "Polity & Governance",
  "Economy",
  "Environment & Ecology",
  "Science & Technology",
  "International Relations",
  "Art & Culture",
  "History",
  "Social Issues",
  "Defence & Security",
  "Awards, Persons & Places in News",
  "National",
  "Sports",
  "Miscellaneous",
  "General",
];

function assignCategoriesToArticle(title, description) {
  const text = (title + " " + (description || "")).toLowerCase();
  const assigned = new Set(); // Use a Set to avoid duplicate categories

  for (const category in categoryKeywords) {
    const keywords = categoryKeywords[category];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        assigned.add(category);
        // Do NOT break here. An article can belong to multiple categories.
      }
    }
  }

  // Filter assigned categories against the Mongoose schema's enum
  let filteredCategories = Array.from(assigned).filter((cat) =>
    SCHEMA_ENUM_CATEGORIES.includes(cat)
  );

  // If after filtering, no categories are left or assigned is empty, default to "General"
  if (filteredCategories.length === 0) {
    return ["General"];
  }

  return filteredCategories; // Convert Set back to Array
}
// --- END NEW: Category Assignment Logic ---

// --- SCRAPER AND NEWS FETCHING CORE FUNCTIONS (exported for index.js use) ---

async function runScraperAndStore(sourceKey, scraperPath, Model) {
  console.log(`[${sourceKey} Scraper] Starting scraper: ${scraperPath}`);
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [scraperPath]);
    let dataBuffer = "";
    let errorBuffer = "";

    pythonProcess.stdout.on("data", (data) => {
      dataBuffer += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorBuffer += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      console.log(`[${sourceKey} Scraper] Process exited with code: ${code}`);
      if (code !== 0) {
        console.error(
          `[${sourceKey} Scraper] Error in Python script for ${sourceKey}:\n${errorBuffer}`
        );
        return reject(
          new Error(`Python script exited with code ${code}: ${errorBuffer}`)
        );
      }

      try {
        const articles = JSON.parse(dataBuffer);
        console.log(
          `[${sourceKey} Scraper] Successfully parsed ${articles.length} articles from scraper output.`
        );

        let newArticlesCount = 0;
        let updatedArticlesCount = 0;
        let skippedArticlesCount = 0;

        // Define generic titles to skip for AI question generation
        const genericTitlesToSkip = [
          "representational image only. file",
          "representatve image",
          "photo used for representation purpose only.",
          "file", // Very short titles might be problematic
          "photo",
          "image",
          "a view of", // Often precedes a generic image description
          "image released by", // Often precedes image credit
          "representational image only", // From the screenshot
          "file photo", // From the screenshot
          "image might show:", // From your earlier logs
          "stream key mixer", // From your earlier logs
          "photo :", // Added to catch more image-only titles
          "representational photo of", // Added to catch more image-only titles
          "photo used for representation purpose only", // Added to catch more image-only titles
        ];

        for (const articleData of articles) {
          const {
            title,
            link,
            description,
            imageUrl,
            // categories, // Categories will now be assigned in Node.js
          } = articleData;

          const dateString = articleData.publishedAt || articleData.date;

          if (!title || !link || !dateString) {
            console.warn(
              `[${sourceKey} Scraper] Skipping article due to missing title, link, or date: ${JSON.stringify(
                articleData
              )}`
            );
            skippedArticlesCount++;
            continue;
          }

          // --- Filter out generic/unsuitable articles for AI ---
          const lowerCaseTitle = title.toLowerCase().trim();
          const isGenericTitle = genericTitlesToSkip.some((pattern) =>
            lowerCaseTitle.includes(pattern)
          );

          if (isGenericTitle) {
            console.warn(
              `[${sourceKey} Scraper] Skipping article with generic title (not suitable for AI): "${title}"`
            );
            skippedArticlesCount++;
            continue; // Skip this article entirely
          }
          // --- End Filtering ---

          let parsedDate;
          const tempDate = new Date(dateString);
          if (!isNaN(tempDate.getTime())) {
            parsedDate = tempDate;
          } else {
            console.warn(
              `[${sourceKey} Scraper] Invalid date format for article "${title}" (Date: "${dateString}"). Using current timestamp as fallback.`
            );
            parsedDate = new Date(); // Use current date as a robust fallback
          }

          // --- NEW: Assign categories here ---
          const assignedCategories = assignCategoriesToArticle(
            title,
            description
          );
          // --- End NEW: Assign categories ---

          const cleanLink = link.split("?")[0];
          const existingArticle = await Model.findOne({ link: cleanLink });

          if (existingArticle) {
            let hasChanged = false;

            // --- Enhanced Date Handling ---
            let verifiedExistingPubDate = null;
            if (existingArticle.pubDate) {
              try {
                const temp = new Date(existingArticle.pubDate);
                if (!isNaN(temp.getTime())) {
                  verifiedExistingPubDate = temp;
                }
              } catch (e) {
                console.warn(
                  `[${sourceKey} Scraper] Error verifying existingArticle.pubDate for article "${existingArticle.title}":`,
                  existingArticle.pubDate,
                  e.message
                );
              }
            }

            let verifiedNewPubDate = null;
            if (parsedDate) {
              try {
                const temp = new Date(parsedDate);
                if (!isNaN(temp.getTime())) {
                  verifiedNewPubDate = temp;
                }
              } catch (e) {
                console.warn(
                  `[${sourceKey} Scraper] Error verifying parsedDate for article "${title}":`,
                  parsedDate,
                  e.message
                );
              }
            }

            const existingPubDateStr = verifiedExistingPubDate
              ? verifiedExistingPubDate.toISOString().split("T")[0]
              : null;
            const newPubDateStr = verifiedNewPubDate
              ? verifiedNewPubDate.toISOString().split("T")[0]
              : null;
            // --- End Enhanced Date Handling ---

            if (existingArticle.title !== title) {
              existingArticle.title = title;
              hasChanged = true;
            }
            if (!existingArticle.description && description) {
              existingArticle.description = description;
              hasChanged = true;
            }
            if (!existingArticle.imageUrl && imageUrl) {
              existingArticle.imageUrl = imageUrl;
              hasChanged = true;
            }
            // Compare string representations of dates, handling potential nulls
            if (existingPubDateStr !== newPubDateStr) {
              existingArticle.pubDate = parsedDate; // Assign the original parsedDate (which has robust fallback)
              hasChanged = true;
            }
            // --- NEW: Update categories for existing articles if they've changed ---
            // Simple array comparison (may need a deeper check if order/duplicates matter)
            if (
              JSON.stringify(existingArticle.categories) !==
              JSON.stringify(assignedCategories)
            ) {
              existingArticle.categories = assignedCategories;
              hasChanged = true;
            }
            // --- End NEW ---

            if (hasChanged) {
              existingArticle.updatedAt = new Date();
              await existingArticle.save();
              updatedArticlesCount++;
            } else {
              skippedArticlesCount++;
            }
          } else {
            const newArticle = new Model({
              title,
              link: cleanLink,
              pubDate: parsedDate,
              source: sourceKey,
              description: description || null,
              imageUrl: imageUrl || null,
              categories: assignedCategories, // Use the assigned categories here
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            await newArticle.save();
            newArticlesCount++;
            console.log(`[${sourceKey} Scraper] New article saved: ${title}`);
          }
        }
        console.log(
          `[${sourceKey} Scraper] Summary: New: ${newArticlesCount}, Updated: ${updatedArticlesCount}, Skipped: ${skippedArticlesCount}`
        );
        resolve({
          newArticlesCount,
          updatedArticlesCount,
          skippedArticlesCount,
        });
      } catch (parseError) {
        console.error(
          `[${sourceKey} Scraper] Error parsing JSON from Python script for ${sourceKey}:`,
          parseError
        );
        reject(parseError);
      }
    });
  });
}

async function runAllScrapers() {
  console.log(
    `--- Starting Headline Scrape Cycle (${new Date().toLocaleString()}) ---`
  );
  for (const sourceKey in sourceConfig) {
    const config = sourceConfig[sourceKey];
    try {
      await runScraperAndStore(sourceKey, config.scraperPath, config.model);
      console.log(`[${sourceKey} Scraper] Finished processing ${sourceKey}.`);
    } catch (error) {
      console.error(
        `[${sourceKey} Scraper] Failed to run scraper for ${sourceKey}:`,
        error.message
      );
    }
  }
  console.log(
    `--- Headline Scrape Cycle Completed (${new Date().toLocaleString()}) ---`
  );
}

async function cleanupOldNews(daysToKeep) {
  console.log(
    `[Cleanup] Starting cleanup of articles older than ${daysToKeep} days...`
  );
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  cutoffDate.setHours(0, 0, 0, 0);

  let totalDeleted = 0;
  for (const sourceKey in sourceConfig) {
    const config = sourceConfig[sourceKey];
    try {
      const articlesToDelete = await config.model
        .find({ pubDate: { $lt: cutoffDate } }, "_id")
        .lean();
      const articleIdsToDelete = articlesToDelete.map((a) => a._id);

      if (articleIdsToDelete.length > 0) {
        const questionDeleteResult = await Question.deleteMany({
          articleId: { $in: articleIdsToDelete },
        });
        console.log(
          `[Cleanup] Deleted ${questionDeleteResult.deletedCount} questions associated with old articles from ${sourceKey}.`
        );
      }

      const articleDeleteResult = await config.model.deleteMany({
        pubDate: { $lt: cutoffDate },
      });
      console.log(
        `[Cleanup] Deleted ${articleDeleteResult.deletedCount} articles from ${sourceKey}.`
      );
      totalDeleted += articleDeleteResult.deletedCount;
    } catch (error) {
      console.error(`[Cleanup] Error cleaning up ${sourceKey}:`, error.message);
    }
  }
  console.log(`[Cleanup] Total articles deleted: ${totalDeleted}`);
}

const getNewsAggregationPipeline = (page, limit) => {
  const skip = (page - 1) * limit;

  return [
    {
      $lookup: {
        from: "questions",
        localField: "_id",
        foreignField: "articleId",
        as: "populatedQuestions",
      },
    },
    {
      $addFields: {
        hasQuestions: { $gt: [{ $size: "$populatedQuestions" }, 0] },
      },
    },
    {
      $sort: {
        hasQuestions: -1,
        pubDate: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
    {
      $project: {
        populatedQuestions: 0,
      },
    },
  ];
};

// =========================================================
//           API ROUTES
// =========================================================

router.post("/sync-user", verifyFirebaseTokenAndGetUserId, async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const { displayName, email } = req.body;

    let user = await User.findOne({ firebaseUid });

    if (!user) {
      user = new User({
        firebaseUid,
        email,
        displayName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await user.save();
      console.log(`[User Sync] New user created in DB: ${firebaseUid}`);
      return res
        .status(201)
        .json({ message: "User synced and created.", user: user.toObject() });
    } else {
      let updated = false;
      if (displayName && user.displayName !== displayName) {
        user.displayName = displayName;
        updated = true;
      }
      if (email && user.email !== email) {
        user.email = email;
        updated = true;
      }
      if (updated) {
        user.updatedAt = new Date();
        await user.save();
        console.log(`[User Sync] Existing user ${firebaseUid} data updated.`);
      } else {
        console.log(
          `[User Sync] User ${firebaseUid} already exists and no updates needed.`
        );
      }
      return res
        .status(200)
        .json({ message: "User synced.", user: user.toObject() });
    }
  } catch (error) {
    // FIX: Access req.firebaseUid directly, with a fallback for robustness
    console.error(
      `[User Sync] Error syncing user ${req.firebaseUid || "N/A"}:`,
      error
    );
    res.status(500).json({ message: "Failed to sync user data." });
  }
});

router.get("/bookmarks", verifyFirebaseTokenAndGetUserId, async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;

    const user = await User.findOne({ firebaseUid: firebaseUid }).lean();

    if (!user) {
      return res.status(404).json({ message: "User record not found." });
    }

    const bookmarks = user.bookmarks || [];
    const populatedBookmarks = [];

    for (const bookmark of bookmarks) {
      if (!bookmark.articleId || !bookmark.articleSourceModel) {
        console.warn(
          `[Bookmarks] Skipping malformed bookmark: Missing articleId or articleSourceModel for bookmark ID ${bookmark._id}`
        );
        continue;
      }

      const sourceModelName = bookmark.articleSourceModel;

      const userBookmarkSchemaPath = User.schema.path("bookmarks");
      const articleSourceModelSchemaType =
        userBookmarkSchemaPath.caster.schema.path("articleSourceModel");
      const enumValues = articleSourceModelSchemaType
        ? articleSourceModelSchemaType.enumValues
        : [];

      if (!enumValues.includes(sourceModelName)) {
        console.warn(
          `[Bookmarks] Skipping bookmark: Invalid articleSourceModel '${sourceModelName}' for bookmark ID ${
            bookmark._id
          }. Allowed: ${enumValues.join(", ")}`
        );
        continue;
      }

      const sourceConfigEntry = Object.values(sourceConfig).find(
        (config) => config.modelName === sourceModelName
      );

      if (!sourceConfigEntry || !sourceConfigEntry.model) {
        console.warn(
          `[Bookmarks] Skipping bookmark: No matching config or model found for source '${sourceModelName}' (ID: ${bookmark._id}).`
        );
        continue;
      }

      const ArticleModel = sourceConfigEntry.model;
      const article = await ArticleModel.findById(bookmark.articleId).lean();

      if (article) {
        populatedBookmarks.push({
          _id: bookmark._id,
          articleId: article._id,
          articleSourceModel: bookmark.articleSourceModel,
          bookmarkedAt: bookmark.bookmarkedAt,
          articleDetails: {
            _id: article._id,
            title: article.title,
            link: article.link,
            imageUrl: article.imageUrl || null,
            description: article.description || null,
            publishedAt: article.pubDate || article.publishedAt,
            categories: article.categories || [], // Ensure categories are passed through
            source: formatSourceForDisplay(article.source),
          },
        });
      } else {
        console.log(
          `[Bookmarks] Article ID ${bookmark.articleId} from ${sourceModelName} not found. Skipping bookmark.`
        );
      }
    }

    console.log(
      `[Bookmarks] Fetched ${populatedBookmarks.length} populated bookmarks for user ${firebaseUid}.`
    );
    res.status(200).json(populatedBookmarks);
  } catch (error) {
    console.error("Error fetching user bookmarks:", error);
    res.status(500).json({ message: "Failed to load bookmarks." });
  }
});

router.post("/bookmark", verifyFirebaseTokenAndGetUserId, async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const { articleId, articleSourceModel } = req.body;

    if (!articleId || !articleSourceModel) {
      return res
        .status(400)
        .json({ message: "Missing articleId or articleSourceModel." });
    }
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({ message: "Invalid article ID format." });
    }

    const userSchema = User.schema;
    const bookmarkSchemaPath = userSchema.path("bookmarks");
    const articleSourceModelSchemaType =
      bookmarkSchemaPath.caster.schema.path("articleSourceModel");

    if (
      !articleSourceModelSchemaType ||
      !articleSourceModelSchemaType.enumValues ||
      !articleSourceModelSchemaType.enumValues.includes(articleSourceModel)
    ) {
      console.warn(
        `[Bookmark Add] Invalid source model name: ${articleSourceModel} for article ${articleId}. Allowed: ${articleSourceModelSchemaType.enumValues.join(
          ", "
        )}`
      );
      return res.status(400).json({
        message: `Invalid source model name provided for bookmark: '${articleSourceModel}'. Allowed values are: ${
          articleSourceModelSchemaType
            ? articleSourceModelSchemaType.enumValues.join(", ")
            : "N/A"
        }`,
      });
    }

    const user = await User.findOne({ firebaseUid: firebaseUid });

    if (!user) {
      return res.status(404).json({
        message: "User record not found. Please ensure user data is synced.",
      });
    }

    const isAlreadyBookmarkedInMemory = user.bookmarks.some(
      (bookmark) =>
        bookmark.articleId &&
        String(bookmark.articleId) === String(articleId) &&
        bookmark.articleSourceModel === articleSourceModel
    );

    if (isAlreadyBookmarkedInMemory) {
      console.log(
        `[Bookmark Add] Article ${articleId} from ${articleSourceModel} already bookmarked by user ${firebaseUid}.`
      );
      return res.status(409).json({ message: "Article already bookmarked." });
    }

    const sourceConfigEntry = Object.values(sourceConfig).find(
      (config) => config.modelName === articleSourceModel
    );

    if (!sourceConfigEntry || !sourceConfigEntry.model) {
      return res.status(400).json({
        message:
          "Invalid articleSourceModel provided (no matching config entry to fetch article details).",
      });
    }

    const ArticleModel = sourceConfigEntry.model;
    const article = await ArticleModel.findById(articleId).lean();

    if (!article) {
      return res.status(404).json({
        message:
          "Article not found in source collection. Cannot bookmark missing article.",
      });
    }

    const newBookmark = {
      articleId: new mongoose.Types.ObjectId(articleId),
      articleSourceModel: articleSourceModel,
      bookmarkedAt: new Date(),
      articleDetails: {
        _id: article._id,
        title: article.title,
        link: article.link,
        imageUrl: article.imageUrl || null,
        description: article.description || null,
        publishedAt: article.pubDate,
        categories: article.categories, // Use the assigned categories here
        source: formatSourceForDisplay(article.source),
      },
    };

    user.bookmarks.push(newBookmark);
    await user.save();

    console.log(
      `[Bookmark Add] Successfully bookmarked article ${articleId} from ${articleSourceModel} for user ${firebaseUid}.`
    );
    res.status(201).json({
      message: "Article bookmarked successfully!",
      bookmark: newBookmark,
    });
  } catch (error) {
    console.error(`Error adding bookmark for user ${req.firebaseUid}:`, error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Article already bookmarked." });
    }
    res
      .status(500)
      .json({ message: "Failed to add bookmark.", error: error.message });
  }
});

router.delete(
  "/bookmark/:bookmarkId",
  verifyFirebaseTokenAndGetUserId,
  async (req, res) => {
    try {
      const firebaseUid = req.firebaseUid;
      const { bookmarkId } = req.params;

      console.log(
        `[Bookmark Remove] Received DELETE request for bookmarkId: ${bookmarkId}`
      );

      if (!bookmarkId || !mongoose.Types.ObjectId.isValid(bookmarkId)) {
        return res.status(400).json({
          message: "Invalid or missing bookmark ID in URL parameters.",
        });
      }

      const user = await User.findOne({ firebaseUid: firebaseUid });

      if (!user) {
        return res.status(404).json({ message: "User record not found." });
      }

      const initialBookmarkCount = user.bookmarks.length;

      user.bookmarks = user.bookmarks.filter(
        (b) => String(b._id) !== String(bookmarkId)
      );

      if (user.bookmarks.length === initialBookmarkCount) {
        return res
          .status(404)
          .json({ message: "Bookmark not found for this user." });
      }

      await user.save();
      console.log(
        `[Bookmark Remove] Successfully removed bookmark with ID ${bookmarkId} for user ${firebaseUid}.`
      );
      res.status(200).json({ message: "Bookmark removed successfully!" });
    } catch (error) {
      // FIX: Access req.firebaseUid directly here as well, with a fallback for robustness
      console.error(
        `Error removing bookmark for user ${req.firebaseUid || "N/A"}:`,
        error
      );
      res.status(500).json({ message: "Failed to remove bookmark." });
    }
  }
);

// NEW ROUTE: 5a. GET /api/news/current-affairs - Now functions like /api/news/all
// This should come BEFORE the dynamic /:sourceKey route to be prioritized
router.get("/current-affairs", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  try {
    let allArticles = [];

    // Fetch articles from all configured sources
    for (const sourceKey in sourceConfig) {
      const config = sourceConfig[sourceKey];
      // Only process if the model exists and is valid
      if (config.model) {
        // Use the aggregation pipeline for consistency and question population
        const sourceArticles = await config.model.aggregate(
          getNewsAggregationPipeline(1, limit * 2) // Fetch more than `limit` for global sorting
        );
        allArticles.push(...sourceArticles);
      }
    }

    // Sort all combined results globally based on the pipeline's sort order
    allArticles.sort((a, b) => {
      // Primary sort: articles with questions come first
      if (a.hasQuestions && !b.hasQuestions) return -1;
      if (!a.hasQuestions && b.hasQuestions) return 1;
      // Secondary sort: by publication date (most recent first)
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    const skipGlobal = (page - 1) * limit;
    const finalArticles = allArticles.slice(skipGlobal, skipGlobal + limit);

    res.status(200).json({
      news: finalArticles,
      currentPage: page,
      totalPages: Math.ceil(allArticles.length / limit),
      totalResults: allArticles.length,
    });
  } catch (error) {
    console.error(`Error fetching current affairs news:`, error);
    res.status(500).json({ message: `Failed to fetch current affairs news.` });
  }
});

router.get("/all", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  try {
    let allArticles = [];

    for (const sourceKey in sourceConfig) {
      const config = sourceConfig[sourceKey];
      if (config.model) {
        const sourceArticles = await config.model.aggregate(
          getNewsAggregationPipeline(1, limit * 2)
        );
        allArticles.push(...sourceArticles);
      }
    }

    allArticles.sort((a, b) => {
      if (a.hasQuestions && !b.hasQuestions) return -1;
      if (!a.hasQuestions && b.hasQuestions) return 1;
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    const skipGlobal = (page - 1) * limit;
    const finalArticles = allArticles.slice(skipGlobal, skipGlobal + limit);

    res.status(200).json({
      news: finalArticles,
      currentPage: page,
      totalPages: Math.ceil(allArticles.length / limit),
      totalResults: allArticles.length,
    });
  } catch (error) {
    console.error("Error fetching all news:", error);
    res.status(500).json({ message: "Error fetching all news" });
  }
});

router.get("/search", async (req, res) => {
  const query = req.query.q;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  if (!query || query.trim() === "") {
    return res.status(200).json([]);
  }

  try {
    let searchResults = [];
    const regex = new RegExp(query, "i");

    for (const sourceKey in sourceConfig) {
      const Model = sourceConfig[sourceKey].model;
      if (Model) {
        const searchPipeline = [
          {
            $match: {
              $or: [
                { title: { $regex: regex } },
                { description: { $regex: regex } },
                { content: { $regex: regex } },
                { categories: { $regex: regex } },
              ],
            },
          },
          ...getNewsAggregationPipeline(1, limit * 2),
        ];
        const articles = await Model.aggregate(searchPipeline);
        searchResults.push(...articles);
      }
    }

    searchResults.sort((a, b) => {
      if (a.hasQuestions && !b.hasQuestions) return -1;
      if (!a.hasQuestions && b.hasQuestions) return 1;
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    const skipGlobal = (page - 1) * limit;
    const finalSearchResults = searchResults.slice(
      skipGlobal,
      skipGlobal + limit
    );

    res.status(200).json({
      news: finalSearchResults,
      currentPage: page,
      totalPages: Math.ceil(searchResults.length / limit),
      totalResults: searchResults.length,
    });
  } catch (error) {
    console.error("Error during search:", error);
    res.status(500).json({ message: "Error during search" });
  }
});

router.get("/:sourceKey", async (req, res) => {
  const sourceKey = req.params.sourceKey.toLowerCase();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  const config = sourceConfig[sourceKey];

  if (!config || !config.model) {
    return res
      .status(404)
      .json({ message: "News source not found or configured." });
  }

  try {
    const Model = config.model;
    const articles = await Model.aggregate(
      getNewsAggregationPipeline(page, limit)
    );

    const totalCount = await Model.countDocuments();

    res.status(200).json({
      news: articles,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalResults: totalCount,
    });
  } catch (error) {
    console.error(`Error fetching news from ${req.params.sourceKey}:`, error);
    res
      .status(500)
      .json({ message: `Failed to fetch news from ${req.params.sourceKey}.` });
  }
});

module.exports = {
  router,
  runAllScrapers,
  cleanupOldNews,
};
