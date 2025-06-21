// C:\Users\OKKKK\Desktop\G-Press\G-Press\Server\services\ingestionService.js

const TheHindu = require("../models/TheHindu");
const DNA = require("../models/DNA");
const HindustanTimes = require("../models/HindustanTimes");
const IndianExpress = require("../models/IndianExpress");
const TimesOfIndia = require("../models/TimesOfIndia");
const axios = require("axios");

// --- LLM Service Configuration ---
const LLM_CATEGORIZATION_URL =
  "http://localhost:5000/api/ai/categorize-article";
// ----------------------------------

// Map source strings to their Mongoose models
const newsModelMap = {
  thehindu: TheHindu, // Match source string from scraper output
  dna: DNA,
  hindustantimes: HindustanTimes,
  indianexpress: IndianExpress,
  timesofindia: TimesOfIndia,
};

// Function to call LLM for current affairs categorization
async function categorizeCurrentAffairsWithAI(title, description, content) {
  try {
    const prompt = `
        Analyze the following news article. Determine if it qualifies as significant 'Current Affairs' (i.e., impactful, relevant for general knowledge or competitive exams) and assign it to a single, most appropriate category from the list: ['Politics', 'Economy', 'International Relations', 'Science & Technology', 'Environment', 'Sports', 'Awards & Honors', 'Defence', 'Judiciary', 'Social Issues', 'Miscellaneous']. If it doesn't fit a specific significant category or isn't current affairs, use 'General'.

        Return your response in JSON format like this:
        {
          "isCurrentAffair": true/false,
          "category": "CategoryName"
        }

        Article Title: ${title || "N/A"}
        Article Description: ${description || "N/A"}
        ${
          content ? `Article Content: ${content.substring(0, 1000)}...` : ""
        } // Send a snippet of content
        `;

    const response = await axios.post(LLM_CATEGORIZATION_URL, { prompt });
    const llmResult = response.data;

    if (typeof llmResult.isCurrentAffair !== "boolean" || !llmResult.category) {
      console.warn(
        "LLM returned invalid format for current affairs categorization, falling back to default:",
        llmResult
      );
      return { isCurrentAffair: false, category: "General" };
    }
    return {
      isCurrentAffair: llmResult.isCurrentAffair,
      category: llmResult.category,
    };
  } catch (error) {
    console.error(
      "Error calling LLM for current affairs categorization:",
      error.message
    );
    return { isCurrentAffair: false, category: "General" }; // Fallback on error
  }
}

// Function for your existing keyword-based categorization for the 'categories' array
function applyKeywordCategories(title, description) {
  const categories = [];
  const lowerTitle = title.toLowerCase();
  const lowerDescription = description ? description.toLowerCase() : "";

  // **IMPORTANT**: Expand these rules with your actual keyword logic for the 'categories' array.
  // Example keyword mapping:
  if (
    lowerTitle.includes("election") ||
    lowerDescription.includes("government") ||
    lowerTitle.includes("parliament") ||
    lowerTitle.includes("policy")
  ) {
    categories.push("Polity & Governance");
  }
  if (
    lowerTitle.includes("economy") ||
    lowerDescription.includes("finance") ||
    lowerTitle.includes("bank") ||
    lowerTitle.includes("budget") ||
    lowerTitle.includes("market")
  ) {
    categories.push("Economy");
  }
  if (
    lowerTitle.includes("environment") ||
    lowerDescription.includes("climate") ||
    lowerTitle.includes("pollution") ||
    lowerTitle.includes("conservation")
  ) {
    categories.push("Environment & Ecology");
  }
  if (
    lowerTitle.includes("science") ||
    lowerTitle.includes("technology") ||
    lowerDescription.includes("research") ||
    lowerTitle.includes("discovery")
  ) {
    categories.push("Science & Technology");
  }
  if (
    lowerTitle.includes("international") ||
    lowerTitle.includes("diplomacy") ||
    lowerTitle.includes("un ") ||
    lowerDescription.includes("global")
  ) {
    categories.push("International Relations");
  }
  if (
    lowerTitle.includes("art") ||
    lowerTitle.includes("culture") ||
    lowerDescription.includes("festival") ||
    lowerTitle.includes("music")
  ) {
    categories.push("Art & Culture");
  }
  if (
    lowerTitle.includes("history") ||
    lowerDescription.includes("historical") ||
    lowerTitle.includes("ancient")
  ) {
    categories.push("History");
  }
  if (
    lowerTitle.includes("social") ||
    lowerTitle.includes("community") ||
    lowerDescription.includes("rights") ||
    lowerTitle.includes("gender")
  ) {
    categories.push("Social Issues");
  }
  if (
    lowerTitle.includes("defence") ||
    lowerTitle.includes("security") ||
    lowerDescription.includes("military") ||
    lowerTitle.includes("army") ||
    lowerTitle.includes("navy") ||
    lowerTitle.includes("air force")
  ) {
    categories.push("Defence & Security");
  }
  if (
    lowerTitle.includes("award") ||
    lowerTitle.includes("honor") ||
    lowerTitle.includes("person in news") ||
    lowerTitle.includes("place in news")
  ) {
    categories.push("Awards, Persons & Places in News");
  }
  if (lowerTitle.includes("world")) {
    categories.push("World");
  }
  if (lowerTitle.includes("national") || lowerTitle.includes("india")) {
    categories.push("National");
  }
  if (
    lowerTitle.includes("sport") ||
    lowerDescription.includes("game") ||
    lowerTitle.includes("match") ||
    lowerTitle.includes("olympics")
  ) {
    categories.push("Sports");
  }

  // Add a 'Miscellaneous' if no specific category matches
  if (categories.length === 0) {
    categories.push("Miscellaneous");
  }

  // Deduplicate categories just in case
  return [...new Set(categories)];
}

// Function to ingest and categorize a single scraped article
async function ingestAndCategorizeArticle(articleData) {
  const { title, link, description, date, source, imageUrl, content } =
    articleData;

  if (!title || !link || !source) {
    console.error(
      "Missing required article data for ingestion: title, link, or source.",
      articleData
    );
    return { success: false, message: "Missing required data." };
  }

  const NewsModel = newsModelMap[source.toLowerCase()];
  if (!NewsModel) {
    console.error(`Invalid source received: ${source}`);
    return { success: false, message: `Invalid news source: ${source}` };
  }

  try {
    // Check if article already exists to prevent duplicates based on link
    const existingArticle = await NewsModel.findOne({ link });
    if (existingArticle) {
      console.log(`Article already exists, skipping ingestion: ${link}`);
      return {
        success: true,
        message: "Article already exists.",
        articleId: existingArticle._id,
      };
    }

    // 1. Apply your existing keyword-based categorization for the 'categories' array
    // Use the title and description (summary in Python output) for this
    const traditionalCategories = applyKeywordCategories(
      title,
      description || articleData.summary || title
    );

    // 2. Call AI for Current Affairs categorization
    // Send what's available from the initial scrape (title, description/summary).
    // Full content is likely null at this stage, but pass it if it exists.
    const { isCurrentAffair, category: currentAffairsAI_Category } =
      await categorizeCurrentAffairsWithAI(
        title,
        description || articleData.summary || title, // Pass description or summary
        content // Will be null for initial scrape
      );

    // 3. Create and save the new article
    const newArticle = new NewsModel({
      title,
      link,
      description: description || articleData.summary, // Use summary if description is null
      imageUrl,
      content, // Content will be null initially for most scrapers
      publishedAt: date ? new Date(date) : new Date(), // Ensure it's a Date object
      source: source.toLowerCase(),
      categories: traditionalCategories, // Populated by keyword mapping
      isCurrentAffair, // Populated by AI
      currentAffairsCategory: currentAffairsAI_Category, // Populated by AI
      aiCategorizationTimestamp: new Date(),
    });

    await newArticle.save();
    console.log(
      `Ingested and categorized new article from ${source}: ${title.substring(
        0,
        50
      )}...`
    );
    return {
      success: true,
      message: "Article ingested and categorized successfully.",
      articleId: newArticle._id,
    };
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error code
      console.warn(`Duplicate article link attempted to save: ${link}`);
      return {
        success: true,
        message: "Article already exists (duplicate link).",
      };
    }
    console.error(`Error ingesting article from ${source}: ${error.message}`);
    return {
      success: false,
      message: "Failed to ingest article.",
      error: error.message,
    };
  }
}

module.exports = {
  ingestAndCategorizeArticle,
};
