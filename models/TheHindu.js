const mongoose = require("mongoose");

const theHinduSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    link: { type: String, unique: true, required: true },
    source: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: { type: String, default: null },
    imageUrl: { type: String, default: null },
    content: { type: String, default: null }, // Stores full article content
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
    pubDate: { type: Date, required: true },
    lastGeneratedQuestionsAt: {
      type: Date,
    },
    questionsGenerationFailed: {
      type: Boolean,
      default: false,
    },
    lastScrapedContentAt: { type: Date, default: null },
    contentScrapeFailed: { type: Boolean, default: false },
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
          "National",
          "Sports",
          "Miscellaneous",
          "General",
        ],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("TheHindu", theHinduSchema, "hindus");
