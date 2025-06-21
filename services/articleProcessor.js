// C:\Users\OKKKK\Desktop\G-Press\G-Press\Server\services\articleProcessor.js

const mongoose = require("mongoose");

const { generateQuestionsForBatch } = require("./aiService"); // UPDATED: Import from aiService
const { sourceConfig } = require("../config/sources"); // IMPORT sourceConfig
const Question = require("../models/Question");

const MAX_ARTICLES_FOR_AI_PER_RUN = 5; // Process up to 5 articles per run for AI generation

/**
 * Main function to process articles for AI question generation.
 */
async function processArticlesForContentAndAI() {
  console.log(
    `--- Starting AI Question Generation Cycle (${new Date().toLocaleString()}) ---`
  );

  for (const key in sourceConfig) {
    // Iterate using sourceConfig
    const { model: Model, sourceName, modelName } = sourceConfig[key];

    console.log(
      `[Article Processor] Processing articles for AI question generation for source: ${sourceName}`
    );

    try {
      // Fetch articles that need questions generated or had previous failures
      const articlesToProcessForAI = await Model.find({
        $or: [
          { questions: { $exists: false } }, // No questions array at all
          { questions: { $size: 0 } }, // Questions array is empty
          { questionsGenerationFailed: true }, // Previous question generation failed
        ],
        // Ensure they have a title and link to send to AI
        title: { $exists: true, $ne: null, $ne: "" },
        link: { $exists: true, $ne: null, $ne: "" },
      })
        .limit(MAX_ARTICLES_FOR_AI_PER_RUN) // Limit candidates to avoid overwhelming the system
        .sort({ createdAt: -1 }) // Prioritize newer articles
        .lean(); // Use .lean() for performance since we're just reading initially

      if (articlesToProcessForAI.length === 0) {
        console.log(
          `[Article Processor] No new articles to process for AI for ${sourceName}.`
        );
        continue;
      }

      console.log(
        `[Article Processor] Found ${articlesToProcessForAI.length} articles from ${sourceName} as candidates for AI question generation.`
      );

      // --- AI Question Generation ---
      const articlesForAIProcessing = articlesToProcessForAI; // Use the fetched lean articles

      let aiGeneratedQuestions = {};
      try {
        // Send the batch to AI. Map to only send _id, title, and sourceName
        aiGeneratedQuestions = await generateQuestionsForBatch(
          articlesForAIProcessing.map((a) => ({
            _id: a._id.toString(), // Convert ObjectId to string for easy use
            title: a.title,
            sourceName: sourceName, // Pass the source name (configKey) for context
          }))
        );
      } catch (aiBatchError) {
        console.error(
          `[Article Processor] Critical AI batch generation failed for ${sourceName} starting with "${articlesForAIProcessing[0]?.title.substring(
            0,
            50
          )}...":`,
          aiBatchError.message
        );
        // Mark all articles in the failed batch as failed for question generation
        for (const articleInBatch of articlesForAIProcessing) {
          try {
            // Find the original document to update its questionsGenerationFailed status
            const originalArticleDoc = await Model.findById(articleInBatch._id); // Load full document
            if (originalArticleDoc) {
              originalArticleDoc.questionsGenerationFailed = true;
              await originalArticleDoc.save();
              console.log(
                `[Article Processor] Marked article "${articleInBatch.title.substring(
                  0,
                  50
                )}..." as failed.`
              );
            }
          } catch (saveError) {
            console.error(
              `[Article Processor] Error saving failed AI status for "${articleInBatch.title.substring(
                0,
                50
              )}...":`,
              saveError
            );
          }
        }
        continue; // Move to the next source
      }

      // Process questions returned for each article in the batch
      for (const articleLean of articlesForAIProcessing) {
        // Fetch the full Mongoose document again to enable .save()
        const article = await Model.findById(articleLean._id);
        if (!article) {
          console.warn(
            `[Article Processor] Article ${articleLean._id} not found during final save phase.`
          );
          continue;
        }

        const questionsForThisArticle =
          aiGeneratedQuestions[article._id.toString()]; // Use string ID from AI response

        if (questionsForThisArticle && questionsForThisArticle.length > 0) {
          console.log(
            `[Article Processor] Processing questions for "${article.title.substring(
              0,
              50
            )}..."`
          );
          // Clear existing questions for this article before inserting new ones if regenerating due to failure
          if (
            (article.questions && article.questions.length > 0) ||
            article.questionsGenerationFailed
          ) {
            await Question.deleteMany({ articleId: article._id });
            // Clear the questions array in the article document as well
            article.questions = [];
            console.log(
              `[Article Processor] Cleared existing questions for "${article.title.substring(
                0,
                50
              )}...".`
            );
          }

          const questionDocs = questionsForThisArticle.map((q) => ({
            articleId: article._id,
            articleSource: sourceName, // e.g., 'hindu' (the configKey)
            articleSourceModel: modelName, // e.g., 'TheHindu' (the Mongoose model name)
            articleTitle: article.title,
            question: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
          }));

          // Insert questions and get the inserted documents to obtain their _id values
          const insertedQuestionDocs = await Question.insertMany(questionDocs);
          const newQuestionIds = insertedQuestionDocs.map((doc) => doc._id);

          // Assign the new question ObjectIds to the article's 'questions' field
          article.questions = newQuestionIds;

          article.lastGeneratedQuestionsAt = new Date();
          article.questionsGenerationFailed = false;
          console.log(
            `[Article Processor] Successfully saved ${
              questionsForThisArticle.length
            } questions for "${article.title.substring(
              0,
              50
            )}..." and updated article references.`
          );
        } else {
          // This article was part of the batch sent to AI, but AI didn't return questions for it
          article.questionsGenerationFailed = true;
          console.warn(
            `[Article Processor] No questions generated by AI for "${article.title.substring(
              0,
              50
            )}..." in this specific AI response. Marking as failed.`
          );
        }

        // Save the article's AI status after processing its questions
        try {
          await article.save();
        } catch (saveError) {
          console.error(
            `[Article Processor] Error saving AI status for "${article.title.substring(
              0,
              50
            )}...":`,
            saveError
          );
        }
      }
    } catch (sourceError) {
      console.error(
        `[Article Processor] Error processing source ${sourceName}:`,
        sourceError
      );
    }
  }
  console.log(
    `--- Finished AI Question Generation Cycle (${new Date().toLocaleString()}) ---`
  );
}

module.exports = { processArticlesForContentAndAI };
