// C:\Users\OKKKK\Desktop\G-Press 1\G-Press\Server\models\Question.js

const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "articleSourceModel", // Dynamically refer to the model based on articleSourceModel
      required: true,
    },
    // This field will store the actual model name (e.g., 'TheHindu', 'DNA')
    // and is used by refPath to determine which collection to populate from.
    articleSourceModel: {
      type: String,
      required: true,
      enum: [
        "TheHindu",
        "DNA",
        "HindustanTimes",
        "IndianExpress",
        "TimesOfIndia",
      ],
    },
    articleSource: {
      type: String, // e.g., 'hindu', 'dna'
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
      required: true, // Still require the array to exist, but not a specific length
      // REMOVED: The 'validate' property that enforced array.length === 4
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

// Add a compound unique index to prevent duplicate questions for the same article
// and potentially the same question text (though AI generation should vary questions)
questionSchema.index({ articleId: 1, question: 1 }, { unique: true });

// Export the model, checking if it already exists to prevent OverwriteModelError
module.exports =
  mongoose.models.Question || mongoose.model("Question", questionSchema);
