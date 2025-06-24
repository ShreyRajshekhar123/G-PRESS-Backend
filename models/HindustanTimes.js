const mongoose = require("mongoose");
const hindustanTimesSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    link: { type: String, unique: true, required: true },
    description: { type: String, default: null },
    imageUrl: { type: String, default: null },
    content: { type: String, default: null },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],

    lastGeneratedQuestionsAt: {
      type: Date,
    },
    questionsGenerationFailed: {
      type: Boolean,
      default: false,
    },
    lastScrapedContentAt: { type: Date, default: null },
    contentScrapeFailed: { type: Boolean, default: false },
    source: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    isCurrentAffair: {
      type: Boolean,
      default: false,
      index: true,
    },
    pubDate: { type: Date, required: true },
    currentAffairsCategory: {
      type: String,
      enum: [
        // UPDATED: Now matches the 'categories' enum below
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
      ],
      default: "General",
    },
    aiCategorizationTimestamp: {
      type: Date,
      default: null,
    },
    categories: [
      {
        type: String,
        enum: [
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
          "National", // Aligned with news.js SCHEMA_ENUM_CATEGORIES
          "Sports", // Aligned with news.js SCHEMA_ENUM_CATEGORIES
          "Miscellaneous", // Aligned with news.js SCHEMA_ENUM_CATEGORIES
          "General", // <--- ADDED: Critical for resolving the validation error
        ],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "HindustanTimes",
  hindustanTimesSchema,
  "hindustantimes"
);
