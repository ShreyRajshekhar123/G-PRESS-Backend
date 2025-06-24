// models/User.js
const mongoose = require("mongoose");
// Import the SCHEMA_ENUM_CATEGORIES for consistency from articleProcessor
const { SCHEMA_ENUM_CATEGORIES } = require("../services/articleProcessor");

// Define the schema for a single bookmark entry
const bookmarkSchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // refPath is used for population, but for bookmarks we embed details
    // It's still good to indicate the source model for clarity and potential future population.
    refPath: "bookmarks.articleSourceModel",
  },
  articleSourceModel: {
    // This stores the Mongoose model name (e.g., 'TheHindu', 'DNA')
    // IMPORTANT: Ensure this enum matches your actual Mongoose model names from sourceConfig
    type: String,
    required: true,
    enum: [
      "TheHindu", // Corresponds to models/TheHindu.js
      "DNA", // Corresponds to models/DNA.js
      "HindustanTimes", // Corresponds to models/HindustanTimes.js
      "IndianExpress", // Corresponds to models/IndianExpress.js
      "TimesOfIndia", // Corresponds to models/TimesOfIndia.js
      // Add any other news source model names here if you expand
    ],
  },
  bookmarkedAt: {
    type: Date,
    default: Date.now,
  },
  // Embed essential article details directly within the bookmark
  // This avoids needing separate lookups when fetching user bookmarks,
  // and provides a snapshot of the article at the time of bookmarking.
  articleDetails: {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Store original _id
    title: { type: String, required: true },
    link: { type: String, required: true },
    imageUrl: String,
    description: String,
    publishedAt: Date, // Use 'publishedAt' as per frontend needs, maps to 'pubDate' in scraper models
    categories: {
      type: [String],
      enum: SCHEMA_ENUM_CATEGORIES,
      default: ["General"],
    }, // Use the imported enum
    source: { type: String, required: true }, // Stores the display-friendly string, e.g., "The Hindu"
  },
});

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  displayName: {
    type: String,
  },
  bookmarks: [bookmarkSchema], // Array of bookmark subdocuments
  preferences: {
    categories: { type: [String], enum: SCHEMA_ENUM_CATEGORIES }, // User preferences for categories
    sources: [String], // User preferences for sources (e.g., 'hindu', 'toi')
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound unique index to prevent duplicate bookmarks for the same user and article from the same source
userSchema.index(
  {
    firebaseUid: 1,
    "bookmarks.articleId": 1,
    "bookmarks.articleSourceModel": 1,
  },
  {
    unique: true,
    // partialFilterExpression ensures the index only applies to documents where these fields exist in bookmarks.
    // This is good for sparse arrays or if you sometimes add empty bookmark objects.
    partialFilterExpression: {
      "bookmarks.articleId": { $exists: true },
      "bookmarks.articleSourceModel": { $exists: true },
    },
  }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
