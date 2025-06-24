const mongoose = require("mongoose");
const { generateQuestionsForBatch } = require("./aiService"); // Import from aiService
const { sourceConfig } = require("../config/sources"); // Import sourceConfig
const Question = require("../models/Question"); // Import Question model

const MAX_ARTICLES_FOR_AI_PER_RUN = 5; // Process up to 5 articles per run for AI generation

const categoryKeywords = {
  "Polity & Governance": [
    "modi",
    "government",
    "election",
    "parliament",
    "congress",
    "bjp",
    "party",
    "minister",
    "cabinet",
    "policy",
    "political",
    "judiciary",
    "justice",
    "supreme court",
    "governance",
    "rajnath",
    "gandhi",
    "karnataka",
    "bihar",
  ],
  Economy: [
    "economy",
    "market",
    "finance",
    "sbi",
    "company",
    "investment",
    "shares",
    "stock",
    "rupee",
    "bank",
    "ipo",
    "profit",
    "sales",
    "revenue",
    "bill gates",
    "amazon",
    "genpact",
    "hdfc",
    "icici",
    "jpmorgan chase",
    "fiscal",
    "tax",
  ],
  "Environment & Ecology": [
    "climate",
    "pollution",
    "environment",
    "global warming",
    "conservation",
    "water",
    "river",
    "ecology",
  ],
  "Science & Technology": [
    "ai",
    "tech",
    "software",
    "startup",
    "app",
    "google",
    "apple",
    "microsoft",
    "elon musk",
    "tesla",
    "spacex",
    "chip",
    "semiconductor",
    "nasa",
    "nuclear",
    "research",
    "discovery",
    "astronomy",
    "physics",
    "biology",
    "science",
  ],
  "International Relations": [
    "iran",
    "israel",
    "us",
    "russia",
    "china",
    "pakistan",
    "ukraine",
    "conflict",
    "international",
    "treaty",
    "global",
    "europe",
    "canada",
    "hong kong",
    "middle east",
    "diplomat",
    "un",
  ],
  "Art & Culture": [
    "artist",
    "portrait",
    "culture",
    "music",
    "bollywood",
    "hollywood",
    "film",
    "movie",
    "actor",
    "actress",
    "cinema",
    "celebrity",
    "series",
    "ott",
    "aamir khan",
    "hrithik roshan",
    "ranveer singh",
    "amitabh bachchan",
    "sonakshi sinha",
    "neena gupta",
    "kuvempu",
    "sushma thota",
    "thota vaikuntam",
    "world music day",
  ],
  History: ["history", "kanishka bombing"],
  "Social Issues": [
    "women",
    "gender",
    "social security",
    "human rights",
    "pension",
    "toilet clinic",
    "neurodivergence",
    "parkinson's",
    "public health",
    "issues",
    "migrant",
    "evacuation",
  ],
  "Defence & Security": [
    "defence",
    "security",
    "military",
    "army",
    "police",
    "dgca",
    "air india",
    "terror",
    "bombing",
    "quds force",
    "idf",
  ],
  "Awards, Persons & Places in News": [
    "awards",
    "persons",
    "places",
    "in news",
    "kuvempu",
    "sushma thota",
    "thota vaikuntam",
    "pawan kalyan",
    "h.d. kumaraswamy",
    "n. chandrababu naidu",
    "narendra modi",
    "r.n. ravi",
    "nitish kumar",
    "shahrukh khan",
    "randeep hooda",
    "jeff bezos",
    "lauren sanchez",
    "vance boelter",
    "sunjay kapur",
    "sanam saeed",
    "mohib mirza",
    "dorothy shea",
    "jamie dimon",
    "priyank kharge",
    "neeraj chopra",
    "parag parikh",
    "shabir shah",
    "shreya ghoshal",
    "dr. bhanu mishra",
    "amitabh bachchan",
    "yashasvi jaiswal",
    "rishabh pant",
    "shubman gill",
    "sunil gavaskar",
    "stuart broad",
    "ben stokes",
    "michael vaughan",
    "rahul gandhi",
    "donald trump",
    "asim munir",
    "shehbaz sharif",
    "maharaja of jaipur sawai padmanabh singh",
  ],
  National: [
    "india",
    "indian",
    "delhi",
    "mumbai",
    "bengaluru",
    "karnataka",
    "jammu",
    "madurai",
    "kochi",
    "bihar",
    "hyderabad",
    "ahmedabad",
    "visakhapatnam",
    "lok sabha",
    "state",
  ],
  Sports: [
    "cricket",
    "football",
    "match",
    "team",
    "player",
    "score",
    "tennis",
    "olympics",
    "world cup",
    "ipl",
    "test",
    "century",
    "shubman gill",
    "rishabh pant",
    "yashasvi jaiswal",
    "ben stokes",
    "super rugby",
  ],
  Miscellaneous: [
    "miscellaneous",
    "qr codes",
    "sugar mill",
    "monetary policy",
    "startup",
    "ecommerce",
    "train services",
    "footpath",
  ],
};

const SCHEMA_ENUM_CATEGORIES = [
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
];

/**
 * Assigns categories to an article based on keywords in its title and description.
 * @param {string} title - The title of the article.
 * @param {string} description - The description/summary of the article.
 * @returns {string[]} An array of assigned categories. Defaults to ['General'] if no keywords match.
 */
function assignCategoriesToArticle(title, description) {
  const text = (title + " " + (description || "")).toLowerCase();
  const assigned = new Set();

  for (const category in categoryKeywords) {
    const keywords = categoryKeywords[category];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        assigned.add(category);
      }
    }
  }

  let filteredCategories = Array.from(assigned).filter((cat) =>
    SCHEMA_ENUM_CATEGORIES.includes(cat)
  );

  if (filteredCategories.length === 0) {
    return ["General"];
  }

  return filteredCategories;
}

/**
 * Main function to process articles for AI question generation.
 */
async function processArticlesForContentAndAI() {
  console.log(
    `--- Starting AI Question Generation Cycle (${new Date().toLocaleString()}) ---`
  );

  for (const key in sourceConfig) {
    const { model: Model, sourceName, modelName } = sourceConfig[key]; // Using modelName as the Mongoose model name

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

      let aiGeneratedQuestions = {};
      try {
        // Send the batch to AI. Map to only send _id, title, and sourceName
        aiGeneratedQuestions = await generateQuestionsForBatch(
          articlesToProcessForAI.map((a) => ({
            _id: a._id.toString(), // Convert ObjectId to string for easy use
            title: a.title,
            sourceName: sourceName, // Pass the source name (configKey) for context
          }))
        );
      } catch (aiBatchError) {
        console.error(
          `[Article Processor] Critical AI batch generation failed for ${sourceName} starting with "${articlesToProcessForAI[0]?.title.substring(
            0,
            50
          )}...":`,
          aiBatchError.message
        );
        // Mark all articles in the failed batch as failed for question generation
        for (const articleInBatch of articlesToProcessForAI) {
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
      for (const articleLean of articlesToProcessForAI) {
        // Use articlesForAIProcessing, which is the fetched lean batch
        const article = await Model.findById(articleLean._id); // Fetch the full Mongoose document again to enable .save()
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
            articleSource: key, // Use the sourceKey (e.g., 'hindu') for consistent reference
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

module.exports = {
  assignCategoriesToArticle,
  SCHEMA_ENUM_CATEGORIES,
  processArticlesForContentAndAI,
};
