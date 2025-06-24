const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const {
  verifyFirebaseTokenAndGetUserId,
} = require("../middleware/authMiddleware");
const { sourceConfig } = require("../config/sources");
const User = require("../models/User");
const Question = require("../models/Question"); // Correctly import the compiled Question model
const {
  assignCategoriesToArticle, // Import categorization logic (not directly used here but good to keep)
  SCHEMA_ENUM_CATEGORIES, // Import enum for categories (not directly used here but good to keep)
} = require("../services/articleProcessor"); // Adjust path if needed

// Helper to format source names for display
const formatSourceForDisplay = (configKey) => {
  const configEntry = sourceConfig[configKey];
  if (configEntry && configEntry.sourceName) {
    return configEntry.sourceName;
  }
  return configKey
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Moved getNewsAggregationPipeline from the old news.js
const getNewsAggregationPipeline = (page, limit, isCurrentAffair = false) => {
  const skip = (page - 1) * limit;

  let pipeline = [
    {
      $lookup: {
        from: "questions", // This refers to the collection name for Questions
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
        hasQuestions: -1, // Articles with questions first
        pubDate: -1, // Then by newest publication date
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
        populatedQuestions: 0, // Exclude the populated questions array from the final output
      },
    },
  ];

  if (isCurrentAffair) {
    pipeline.unshift({
      $match: {
        isCurrentAffair: true,
      },
    });
  }

  return pipeline;
};

// --- API ROUTES ---

// Sync User data (Firebase UID, email, displayName)
router.post("/sync-user", verifyFirebaseTokenAndGetUserId, async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    const { displayName, email } = req.body;

    if (!firebaseUid) {
      return res
        .status(401)
        .json({ message: "Firebase UID not provided by middleware." });
    }

    let user = await User.findOne({ firebaseUid: firebaseUid });

    if (!user) {
      // If no user found by firebaseUid, try to find by email
      user = await User.findOne({ email: email });

      if (user) {
        // User found by email, but with a different (or missing) firebaseUid.
        // This means the same person is logging in with a different method.
        // Update their firebaseUid and displayName if provided.
        let updated = false;
        if (user.firebaseUid !== firebaseUid) {
          user.firebaseUid = firebaseUid;
          updated = true;
        }
        if (displayName && user.displayName !== displayName) {
          user.displayName = displayName;
          updated = true;
        }
        if (updated) {
          user.updatedAt = new Date();
          await user.save();
        }
        return res.status(200).json({
          message: "User synced (Firebase UID updated).",
          user: user.toObject(),
        });
      } else {
        // No user found by firebaseUid or email, so create a new one.
        user = new User({
          firebaseUid,
          email,
          displayName,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await user.save();
        return res.status(201).json({
          message: "New user created and synced.",
          user: user.toObject(),
        });
      }
    } else {
      // User found by firebaseUid, now update displayName/email if different
      let updated = false;
      if (displayName && user.displayName !== displayName) {
        user.displayName = displayName;
        updated = true;
      }
      if (email && user.email !== email) {
        // Before updating email, ensure the new email isn't already used by another user
        const existingUserWithEmail = await User.findOne({
          email: email,
          firebaseUid: { $ne: firebaseUid },
        });
        if (existingUserWithEmail) {
          return res.status(409).json({
            message: "Email is already associated with another account.",
          });
        }
        user.email = email;
        updated = true;
      }
      if (updated) {
        user.updatedAt = new Date();
        await user.save();
      }
      return res
        .status(200)
        .json({ message: "User synced.", user: user.toObject() });
    }
  } catch (error) {
    console.error(
      `[User Sync] Error syncing user ${req.firebaseUid || "N/A"}:`,
      error
    ); // Specifically check for duplicate key error from the Mongoose unique index
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "A user with this email or Firebase UID already exists in the system.",
      });
    }
    res.status(500).json({
      message: "Failed to sync user data due to an internal server error.",
    });
  }
});

// Get User Bookmarks
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
      // Basic validation for essential bookmark fields
      if (!bookmark.articleId || !bookmark.articleSourceModel) {
        console.warn(
          `Skipping invalid bookmark entry for user ${firebaseUid}:`,
          bookmark
        );
        continue;
      }

      const sourceModelName = bookmark.articleSourceModel; // Validate articleSourceModel against the User model's enum to prevent arbitrary model names

      const userBookmarkSchemaPath = User.schema.path("bookmarks");
      const articleSourceModelSchemaType =
        userBookmarkSchemaPath.caster.schema.path("articleSourceModel");
      const enumValues = articleSourceModelSchemaType
        ? articleSourceModelSchemaType.enumValues
        : [];

      if (!enumValues.includes(sourceModelName)) {
        console.warn(
          `Bookmark for user ${firebaseUid} contains invalid articleSourceModel: '${sourceModelName}'. Skipping.`
        );
        continue;
      } // Find the corresponding config entry to get the Mongoose model

      const sourceConfigEntry = Object.values(sourceConfig).find(
        (config) => config.modelName === sourceModelName
      );

      if (!sourceConfigEntry || !sourceConfigEntry.model) {
        console.warn(
          `No valid sourceConfig entry or model found for sourceModelName: ${sourceModelName}. Skipping bookmark.`
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
            // Note: articleDetails from the bookmark schema already has these,
            // but fetching the latest from the article ensures data consistency.
            _id: article._id,
            title: article.title,
            link: article.link,
            imageUrl: article.imageUrl || null,
            description: article.description || null,
            publishedAt: article.pubDate || article.publishedAt, // Use pubDate first
            categories: article.categories || [],
            source: formatSourceForDisplay(article.source), // Use the helper for display
          },
        });
      } else {
        // Log if an article linked in a bookmark no longer exists in its collection
        console.warn(
          `Article with ID ${bookmark.articleId} from ${bookmark.articleSourceModel} not found for user ${firebaseUid}'s bookmark. It might have been deleted.`
        );
      }
    }

    res.status(200).json(populatedBookmarks);
  } catch (error) {
    console.error("Error fetching user bookmarks:", error);
    res.status(500).json({ message: "Failed to load bookmarks." });
  }
});

// Add Bookmark
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
    } // Validate articleSourceModel against the User model's enum

    const userSchema = User.schema;
    const bookmarkSchemaPath = userSchema.path("bookmarks");
    const articleSourceModelSchemaType =
      bookmarkSchemaPath.caster.schema.path("articleSourceModel");

    if (
      !articleSourceModelSchemaType ||
      !articleSourceModelSchemaType.enumValues ||
      !articleSourceModelSchemaType.enumValues.includes(articleSourceModel)
    ) {
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
    } // Check for existing bookmark before attempting to add

    const isAlreadyBookmarkedInMemory = user.bookmarks.some(
      (bookmark) =>
        String(bookmark.articleId) === String(articleId) &&
        bookmark.articleSourceModel === articleSourceModel
    );

    if (isAlreadyBookmarkedInMemory) {
      return res.status(409).json({ message: "Article already bookmarked." });
    } // Find the corresponding config entry to get the Mongoose model

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
    const article = await ArticleModel.findById(articleId).lean(); // Fetch the actual article to embed its details

    if (!article) {
      return res.status(404).json({
        message:
          "Article not found in source collection. Cannot bookmark missing article.",
      });
    }

    const newBookmark = {
      articleId: new mongoose.Types.ObjectId(articleId), // Ensure it's an ObjectId
      articleSourceModel: articleSourceModel,
      bookmarkedAt: new Date(),
      articleDetails: {
        _id: article._id,
        title: article.title,
        link: article.link,
        imageUrl: article.imageUrl || null,
        description: article.description || null,
        publishedAt: article.pubDate, // Use pubDate from the scraped article
        categories: article.categories,
        source: formatSourceForDisplay(article.source), // Use the helper for display
      },
    };

    user.bookmarks.push(newBookmark);
    await user.save(); // Mongoose will automatically handle the unique index validation here

    res.status(201).json({
      message: "Article bookmarked successfully!",
      bookmark: newBookmark,
    });
  } catch (error) {
    console.error(`Error adding bookmark for user ${req.firebaseUid}:`, error);
    if (error.code === 11000) {
      // Duplicate key error from the Mongoose unique index
      return res.status(409).json({ message: "Article already bookmarked." });
    }
    res
      .status(500)
      .json({ message: "Failed to add bookmark.", error: error.message });
  }
});

// Delete Bookmark
router.delete(
  "/bookmark/:bookmarkId",
  verifyFirebaseTokenAndGetUserId,
  async (req, res) => {
    try {
      const firebaseUid = req.firebaseUid;
      const { bookmarkId } = req.params;

      if (!bookmarkId || !mongoose.Types.ObjectId.isValid(bookmarkId)) {
        return res.status(400).json({
          message: "Invalid or missing bookmark ID in URL parameters.",
        });
      }

      const user = await User.findOne({ firebaseUid: firebaseUid });

      if (!user) {
        return res.status(404).json({ message: "User record not found." });
      } // Find the index of the bookmark to remove

      const bookmarkIndex = user.bookmarks.findIndex(
        (b) => String(b._id) === String(bookmarkId)
      );

      if (bookmarkIndex === -1) {
        return res
          .status(404)
          .json({ message: "Bookmark not found for this user." });
      } // Remove the bookmark from the array

      user.bookmarks.splice(bookmarkIndex, 1);
      await user.save();

      res.status(200).json({ message: "Bookmark removed successfully!" });
    } catch (error) {
      console.error(
        `Error removing bookmark for user ${req.firebaseUid || "N/A"}:`,
        error
      );
      res.status(500).json({ message: "Failed to remove bookmark." });
    }
  }
);

// Get Current Affairs News (AI-categorized as isCurrentAffair: true)
router.get("/current-affairs", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  try {
    let allArticles = []; // Iterate through all configured sources

    for (const sourceKey in sourceConfig) {
      const config = sourceConfig[sourceKey];
      if (config.model) {
        // Apply the pipeline with isCurrentAffair: true filter
        const sourceArticles = await config.model.aggregate(
          getNewsAggregationPipeline(1, limit * 2, true), // Fetch more to allow sorting and pagination
          { maxTimeMS: 30000 }
        );
        allArticles.push(...sourceArticles);
      }
    } // Sort globally across all sources

    allArticles.sort((a, b) => {
      // Articles with questions should appear first, then by date
      if (a.hasQuestions && !b.hasQuestions) return -1;
      if (!a.hasQuestions && b.hasQuestions) return 1;
      return new Date(b.pubDate) - new Date(a.pubDate); // Sort by newest first
    }); // Apply global pagination

    const skipGlobal = (page - 1) * limit;
    const finalArticles = allArticles.slice(skipGlobal, skipGlobal + limit);

    res.status(200).json({
      news: finalArticles,
      currentPage: page,
      totalPages: Math.ceil(allArticles.length / limit), // Calculate total pages based on all fetched articles
      totalResults: allArticles.length,
    });
  } catch (error) {
    console.error(`Error fetching current affairs news:`, error);
    res.status(500).json({ message: `Failed to fetch current affairs news.` });
  }
});

// Get All News
router.get("/all", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  try {
    let allArticles = []; // Iterate through all configured sources

    for (const sourceKey in sourceConfig) {
      const config = sourceConfig[sourceKey];
      if (config.model) {
        // Fetch more articles initially to allow global sorting and pagination
        const sourceArticles = await config.model.aggregate(
          getNewsAggregationPipeline(1, limit * 2), // Fetch twice the limit to ensure enough for global sort
          { maxTimeMS: 30000 }
        );
        allArticles.push(...sourceArticles);
      }
    } // Sort globally across all sources

    allArticles.sort((a, b) => {
      // Articles with questions should appear first, then by date
      if (a.hasQuestions && !b.hasQuestions) return -1;
      if (!a.hasQuestions && b.hasQuestions) return 1;
      return new Date(b.pubDate) - new Date(a.pubDate); // Sort by newest first
    }); // Apply global pagination

    const skipGlobal = (page - 1) * limit;
    const finalArticles = allArticles.slice(skipGlobal, skipGlobal + limit);

    res.status(200).json({
      news: finalArticles,
      currentPage: page,
      totalPages: Math.ceil(allArticles.length / limit), // Calculate total pages based on all fetched articles
      totalResults: allArticles.length,
    });
  } catch (error) {
    console.error("Error fetching all news:", error);
    res.status(500).json({ message: "Error fetching all news" });
  }
});

// Search News (THIS NEEDS TO BE BEFORE /:sourceKey)
router.get("/search", async (req, res) => {
  const query = req.query.q;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  if (!query || query.trim() === "") {
    return res.status(200).json({
      news: [],
      currentPage: page,
      totalPages: 0,
      totalResults: 0,
    });
  }

  try {
    let searchResults = []; // Using $regex for partial match, 'i' for case-insensitivity
    const regex = new RegExp(query, "i");

    for (const sourceKey in sourceConfig) {
      const Model = sourceConfig[sourceKey].model;
      if (Model) {
        const sourceSearchResults = await Model.find({
          $or: [{ title: regex }, { description: regex }],
        })
          .sort({ pubDate: -1 }) // Sort each source's results by date
          .lean();
        searchResults.push(...sourceSearchResults);
      }
    } // Sort globally across all sources by publication date

    searchResults.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedResults = searchResults.slice(startIndex, endIndex);

    res.status(200).json({
      news: paginatedResults,
      currentPage: page,
      totalPages: Math.ceil(searchResults.length / limit),
      totalResults: searchResults.length,
    });
  } catch (error) {
    console.error("Error during news search:", error);
    res.status(500).json({ message: "Failed to perform search." });
  }
});

// Get News by Source (THIS MUST BE AFTER /search, /current-affairs, /all)
router.get("/:sourceKey", async (req, res) => {
  const sourceKey = req.params.sourceKey;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  const config = sourceConfig[sourceKey];
  if (!config || !config.model) {
    return res.status(404).json({ message: "News source not found." });
  }

  try {
    const news = await config.model.aggregate(
      getNewsAggregationPipeline(page, limit),
      { maxTimeMS: 30000 } // Apply maxTimeMS as an option
    );

    if (!news || news.length === 0) {
      // It's better to return an empty array with success if no news found,
      // rather than a 404 or an error, unless it's truly an unexpected issue.
      return res.status(200).json({
        news: [],
        message: `No articles found for ${formatSourceForDisplay(sourceKey)}.`,
      });
    }

    res.status(200).json({ news });
  } catch (error) {
    console.error(`Error fetching news from ${sourceKey}:`, error);
    if (
      error.name === "MongooseError" &&
      error.message.includes("buffering timed out")
    ) {
      return res.status(500).json({
        message: `Database query timed out for ${sourceKey}. This usually means the query is too slow or database is unreachable.`,
      });
    }
    res
      .status(500)
      .json({ message: `Failed to fetch news from ${sourceKey}.` });
  }
});

module.exports = router; // Export only the router
