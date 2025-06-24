const mongoose = require("mongoose");

const dnaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    link: { type: String, unique: true, required: true },
    description: { type: String, default: null },
    imageUrl: { type: String, default: null },
    content: { type: String, default: null }, // Ensures content field is present and defaults to null
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],

    lastGeneratedQuestionsAt: {
      type: Date,
    },
    questionsGenerationFailed: {
      type: Boolean,
      default: false,
    },
    pubDate: { type: Date, required: true },
    lastScrapedContentAt: { type: Date, default: null },
    contentScrapeFailed: { type: Boolean, default: false },
    source: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // Ensure source is stored consistently (e.g., 'dna')
    },
    isCurrentAffair: {
      type: Boolean,
      default: false,
      index: true,
    },
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

const DNA = mongoose.model("DNA", dnaSchema, "dnas");
module.exports = DNA;
