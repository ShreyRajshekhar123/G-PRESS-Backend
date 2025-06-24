// models/Question.js
const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      // No refPath here for articleId if you are doing a manual lookup/aggregation
      // The `$lookup` in news.js uses the collection name "questions" and links by articleId.
      // If you intend to use `populate` on this `articleId` field from *another* model,
      // you would need `refPath` or a fixed `ref`. Given the setup, a fixed `ref` to 'Article'
      // or similar is not possible since articles are in different collections.
      // So, direct aggregation is preferred.
      required: true,
    },
    // This field stores the Mongoose model name (e.g., 'TheHindu', 'DNA')
    // This is useful for knowing which collection the articleId refers to if you need to fetch it later manually
    articleSourceModel: {
      type: String,
      required: true,
      enum: [
        "TheHindu",
        "DNA",
        "HindustanTimes",
        "IndianExpress",
        "TimesOfIndia",
        // Add all other actual Mongoose model names here
      ],
    },
    articleSource: {
      type: String, // Stores the source key (e.g., 'hindu', 'dna')
      required: true,
      lowercase: true,
      trim: true,
    },
    articleTitle: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String], // Array of strings for options
      required: true,
    },
    correctAnswer: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

// Add an index for efficient lookups by articleId.
// A compound unique index (articleId, question) is good to prevent duplicate questions for the same article.
questionSchema.index({ articleId: 1, question: 1 }, { unique: true });

// Export the model, checking if it already exists to prevent OverwriteModelError
module.exports =
  mongoose.models.Question || mongoose.model("Question", questionSchema);
