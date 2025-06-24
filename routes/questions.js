// C:\Users\OKKKK\Desktop\G-Press\G-Press\Server\routes\questions.js

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const { sourceConfig } = require("../config/sources"); // Import sourceConfig
const { generateQuestionsForBatch } = require("../services/aiService"); // Import AI service
const Question = mongoose.models.Question || mongoose.model("Question"); // Import Question model

// GET /api/questions/generate-on-demand/:sourceKey/:articleId
// This route is called by the frontend to initiate (or fetch cached) question generation
router.get(
  "/generate-on-demand/:sourceKey/:articleId", // Note: No /api/questions prefix here, as it's mounted in index.js
  async (req, res) => {
    const { sourceKey, articleId } = req.params;

    if (!sourceKey || !articleId) {
      return res.status(400).json({
        message: "Missing sourceKey or articleId in request parameters.",
      });
    }

    const sourceConfigEntry = sourceConfig[sourceKey];
    if (!sourceConfigEntry || !sourceConfigEntry.model) {
      return res.status(400).json({
        message: "Invalid news source key provided for question generation.",
      });
    }

    const ArticleModel = sourceConfigEntry.model; // e.g., TheHindu, DNA
    let article;
    try {
      // Find the article and populate its questions if they exist
      article = await ArticleModel.findById(articleId).populate("questions");
      if (!article) {
        return res.status(404).json({ message: "Article not found." });
      }
    } catch (dbError) {
      console.error(
        `[API /generate-on-demand] Database error finding article ${articleId} in ${ArticleModel.modelName}:`,
        dbError
      );
      return res
        .status(500)
        .json({ message: "Error retrieving article from database." });
    }

    // Check if questions already exist for this article
    if (article.questions && article.questions.length > 0) {
      console.log(
        `[API /generate-on-demand] Questions already exist for article ID: ${articleId}. Returning cached.`
      );
      return res.status(200).json({
        message: "Questions retrieved from cache.",
        questions: article.questions,
        articleTitle: article.title,
      });
    }

    const articleTextForAI = article.description || article.title; // Use description or title for AI input
    if (!articleTextForAI) {
      console.warn(
        `[API /generate-on-demand] Article ${articleId} has no content for question generation.`
      );
      return res
        .status(400)
        .json({ message: "Article has no content for question generation." });
    }

    console.log(
      `[API /generate-on-demand] No cached questions found. Generating new questions for article ID: ${articleId}`
    );

    // Prepare article for AI batch generation
    const articleToGenerateFor = {
      _id: article._id.toString(),
      title: article.title,
      sourceName: sourceKey, // This is the lowercase source config key (e.g., 'hindu')
    };

    let aiGeneratedQuestionsMap = {};
    try {
      // Call the AI service to generate questions for this single article in a batch format
      aiGeneratedQuestionsMap = await generateQuestionsForBatch([
        articleToGenerateFor,
      ]);
    } catch (aiError) {
      console.error(
        `[API /generate-on-demand] Error during on-demand AI question generation for article ${articleId}:`,
        aiError.message
      );
      article.questionsGenerationFailed = true; // Mark as failed
      await article.save();
      return res.status(500).json({
        message: "Failed to generate questions. Please try again later.",
      });
    }

    const newQuestions = aiGeneratedQuestionsMap[articleToGenerateFor._id];

    if (newQuestions && newQuestions.length > 0) {
      const questionDocs = newQuestions.map((q) => ({
        articleId: article._id,
        articleSource: sourceKey, // This is the lowercase source config key
        articleSourceModel: sourceConfigEntry.modelName, // This will be the correct capitalized model name (e.g., 'TheHindu')
        articleTitle: article.title,
        question: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
      }));

      const insertedQuestionDocs = await Question.insertMany(questionDocs);
      const newQuestionIds = insertedQuestionDocs.map((doc) => doc._id);

      article.questions = newQuestionIds;
      article.lastGeneratedQuestionsAt = new Date();
      article.questionsGenerationFailed = false;
      await article.save();

      console.log(
        `[API /generate-on-demand] Successfully generated and saved ${newQuestions.length} questions for article ID: ${articleId}`
      );
      return res.status(200).json({
        message: "Questions generated and saved successfully.",
        questions: insertedQuestionDocs,
        articleTitle: article.title,
      });
    } else {
      console.warn(
        `[API /generate-on-demand] AI generated no questions for article ID: ${articleId}`
      );
      article.questionsGenerationFailed = true; // Mark as failed
      await article.save();
      return res.status(200).json({
        message: "AI generated no questions for this article.",
        questions: [],
      });
    }
  }
);

// GET /api/questions/get-by-article/:sourceKey/:articleId
// This route is called by the frontend to fetch already existing questions for an article
router.get("/get-by-article/:sourceKey/:articleId", async (req, res) => {
  const { sourceKey, articleId } = req.params;

  const sourceConfigEntry = sourceConfig[sourceKey]; // Use sourceKey from URL
  if (!sourceConfigEntry || !sourceConfigEntry.model) {
    console.error(
      `[API /get-by-article] Invalid news source key provided: ${sourceKey}`
    );
    return res.status(404).json({ message: "Invalid news source provided." });
  }

  const ArticleModel = sourceConfigEntry.model; // The specific news article model (e.g., TheHindu)

  try {
    const objectIdToQuery = new mongoose.Types.ObjectId(articleId);

    const article = await ArticleModel.findById(objectIdToQuery)
      .populate({
        path: "questions", // This is the field in your Article schema that stores question ObjectIds
        model: "Question", // Explicitly state the Question model
      })
      .lean(); // Use .lean() for faster query

    if (!article) {
      return res.status(404).json({ message: "Article not found." });
    }

    if (!article.questions || article.questions.length === 0) {
      return res.status(200).json({
        message: "No questions found for this article.",
        questions: [],
      });
    }

    console.log(
      `[API /get-by-article] Successfully retrieved ${article.questions.length} questions for article ID: ${articleId}`
    );
    res.status(200).json({
      message: "Questions retrieved successfully.",
      questions: article.questions,
      articleTitle: article.title,
    });
  } catch (error) {
    console.error(
      `[API /get-by-article] Server error fetching questions for article ${articleId}:`,
      error
    );
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid article ID format." });
    }
    res
      .status(500)
      .json({ message: "Internal server error fetching questions." });
  }
});

module.exports = router; // Export only the router
