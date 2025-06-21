// C:\Users\OKKKK\Desktop\G-Press\G-Press\Server\models\User.js

const mongoose = require("mongoose");

// Define the schema for a single bookmark entry
const bookmarkSchema = new mongoose.Schema({
  articleId: {
    // This stores the ObjectId of the specific article from its source collection
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "bookmarks.articleSourceModel", // Dynamic reference to the correct news model
  },
  articleSourceModel: {
    // This stores the Mongoose model name (e.g., 'TheHindu', 'DNA')
    type: String,
    required: true,
    enum: [
      // IMPORTANT: Ensure this enum matches your actual Mongoose model names
      "TheHindu",
      "DNA",
      "HindustanTimes",
      "IndianExpress",
      "TimesOfIndia",
      // Add any other news source model names here if you expand
    ],
  },
  bookmarkedAt: {
    type: Date,
    default: Date.now,
  },
  // Embed essential article details directly within the bookmark
  // This avoids needing separate lookups when fetching user bookmarks
  articleDetails: {
    title: { type: String, required: true },
    link: { type: String, required: true },
    imageUrl: String,
    description: String,
    // Use 'publishedAt' as per your frontend needs, maps to 'pubDate' in scraper models
    publishedAt: Date,
    categories: [String],
    // Store the 'configKey' version (e.g., 'hindu', 'dna') for the frontend to use
    // e.g., for routing or displaying source icon
    source: { type: String, required: true },
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
    categories: [String],
    sources: [String],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: { // Added for tracking updates to user doc (e.g., preferences, displayName)
    type: Date,
    default: Date.now,
  },
});

// Compound index to prevent duplicate bookmarks for the same user and article from the same source
// The `unique: true` property means that the combination of firebaseUid, bookmarks.articleId,
// and bookmarks.articleSourceModel must be unique across all documents.
userSchema.index(
  {
    firebaseUid: 1,
    "bookmarks.articleId": 1,
    "bookmarks.articleSourceModel": 1,
  },
  {
    unique: true,
    // The `partialFilterExpression` is a more robust way to handle unique indexes
    // on array elements, ensuring it only applies when all fields are present.
    // However, for this specific use case, it's typically fine without it
    // if all bookmarks always have these fields. The simpler `unique: true`
    // on the compound index should handle it effectively for `addToSet` operations.
  }
);

module.exports = mongoose.model("User", userSchema);