const { spawn } = require("child_process");
const mongoose = require("mongoose");
const { sourceConfig } = require("../config/sources"); // Import sourceConfig
const { assignCategoriesToArticle } = require("./articleProcessor"); // Import categorization logic

/**
 * Runs a single Python scraper and stores the articles.
 * @param {string} sourceKey - The key of the news source (e.g., 'hindu').
 * @param {string} scraperPath - The path to the Python scraper script.
 * @param {mongoose.Model} Model - The Mongoose model for the articles.
 * @returns {Promise<{newArticlesCount: number, updatedArticlesCount: number, skippedArticlesCount: number}>}
 */
async function runScraperAndStore(sourceKey, scraperPath, Model) {
  const startTime = Date.now(); // Start timing the scraper execution
  console.log(`[Scraper] Starting scraper for ${sourceKey}...`);
  console.time(`[Scraper] ${sourceKey} scraper execution`); // Use console.time for precise measurement

  return new Promise((resolve, reject) => {
    console.log(
      `[Scraper] Executing Python script: ${scraperPath} for ${sourceKey}`
    );
    const pythonProcess = spawn("python", [scraperPath]);
    let dataBuffer = "";
    let errorBuffer = "";

    pythonProcess.stdout.on("data", (data) => {
      dataBuffer += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorBuffer += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      const endTime = Date.now(); // End timing
      const duration = ((endTime - startTime) / 1000).toFixed(2); // Calculate duration in seconds
      console.timeEnd(`[Scraper] ${sourceKey} scraper execution`); // Output the console.time duration
      console.log(
        `[Scraper] ${sourceKey} finished in ${duration} seconds. Exit Code: ${code}`
      );

      if (code !== 0) {
        console.error(
          `[Scraper] Python script for ${sourceKey} exited with code ${code}.`
        );
        console.error(`[Scraper] Stderr for ${sourceKey}: ${errorBuffer}`);
        return reject(
          new Error(
            `Python script for ${sourceKey} exited with code ${code}: ${errorBuffer}`
          )
        );
      }

      // Log errors even if the script exited with code 0 (e.g., warnings from Python)
      if (errorBuffer) {
        console.warn(
          `[Scraper] Python script for ${sourceKey} produced stderr output (warnings?): ${errorBuffer}`
        );
      }

      try {
        const articles = JSON.parse(dataBuffer);
        console.log(
          `[Scraper] Received ${articles.length} articles from ${sourceKey}.`
        );

        let newArticlesCount = 0;
        let updatedArticlesCount = 0;
        let skippedArticlesCount = 0;

        const genericTitlesToSkip = [
          "representational image only. file",
          "representatve image",
          "photo used for representation purpose only.",
          "file",
          "photo",
          "image",
          "a view of",
          "image released by",
          "representational image only",
          "file photo",
          "image might show:",
          "stream key mixer",
          "photo :",
          "representational photo of",
          "photo used for representation purpose only",
        ];

        for (const articleData of articles) {
          const { title, link, description, imageUrl, content } = articleData;
          const dateString = articleData.publishedAt || articleData.date;

          if (!title || !link || !dateString) {
            skippedArticlesCount++;
            continue;
          }

          const lowerCaseTitle = title.toLowerCase().trim();
          const isGenericTitle = genericTitlesToSkip.some((pattern) =>
            lowerCaseTitle.includes(pattern)
          );

          if (isGenericTitle) {
            skippedArticlesCount++;
            continue;
          }

          let parsedDate;
          const tempDate = new Date(dateString);
          if (!isNaN(tempDate.getTime())) {
            parsedDate = tempDate;
          } else {
            console.warn(
              `[${sourceKey} Scraper] Invalid date string "${dateString}" for article "${title}". Using current date.`
            );
            parsedDate = new Date();
          }

          const cleanLink = link.split("?")[0].split("#")[0];
          const existingArticle = await Model.findOne({ link: cleanLink });

          if (existingArticle) {
            let hasChanged = false;

            if (!existingArticle.description && description) {
              existingArticle.description = description;
              hasChanged = true;
            }
            if (!existingArticle.imageUrl && imageUrl) {
              existingArticle.imageUrl = imageUrl;
              hasChanged = true;
            }
            if (existingArticle.title !== title) {
              existingArticle.title = title;
              hasChanged = true;
            }
            if (
              content &&
              (!existingArticle.content || existingArticle.content.length < 50)
            ) {
              existingArticle.content = content;
              hasChanged = true;
            }

            const newCategories = assignCategoriesToArticle(
              title,
              description || content
            );
            if (
              JSON.stringify(existingArticle.categories) !==
              JSON.stringify(newCategories)
            ) {
              existingArticle.categories = newCategories;
              hasChanged = true;
            }

            // Logic for isCurrentAffair and currentAffairsCategory based on keyword categories
            if (
              existingArticle.categories.length > 0 &&
              existingArticle.categories[0] !== "General"
            ) {
              if (
                existingArticle.isCurrentAffair !== true ||
                existingArticle.currentAffairsCategory !==
                  existingArticle.categories[0]
              ) {
                existingArticle.isCurrentAffair = true;
                existingArticle.currentAffairsCategory =
                  existingArticle.categories[0];
                existingArticle.aiCategorizationTimestamp = new Date();
                hasChanged = true;
              }
            } else if (
              existingArticle.isCurrentAffair === undefined ||
              existingArticle.currentAffairsCategory === undefined ||
              existingArticle.isCurrentAffair !== false ||
              existingArticle.currentAffairsCategory !== "General"
            ) {
              existingArticle.isCurrentAffair = false;
              existingArticle.currentAffairsCategory = "General";
              existingArticle.aiCategorizationTimestamp = new Date();
              hasChanged = true;
            }

            if (hasChanged) {
              existingArticle.updatedAt = new Date();
              await existingArticle.save();
              updatedArticlesCount++;
            } else {
              skippedArticlesCount++;
            }
          } else {
            // New article
            const assignedCategories = assignCategoriesToArticle(
              title,
              description || content
            );

            let isCurrentAffair = false;
            let currentAffairsCategory = "General";

            if (
              assignedCategories.length > 0 &&
              assignedCategories[0] !== "General"
            ) {
              isCurrentAffair = true;
              currentAffairsCategory = assignedCategories[0];
            }

            const newArticle = new Model({
              title,
              link: cleanLink,
              pubDate: parsedDate,
              source: sourceKey,
              description: description || null,
              imageUrl: imageUrl || null,
              content: content || null,
              categories: assignedCategories,
              isCurrentAffair: isCurrentAffair,
              currentAffairsCategory: currentAffairsCategory,
              aiCategorizationTimestamp: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            await newArticle.save();
            newArticlesCount++;
          }
        }
        resolve({
          newArticlesCount,
          updatedArticlesCount,
          skippedArticlesCount,
        });
      } catch (parseError) {
        console.error(
          `[Scraper] Error parsing JSON from Python script for ${sourceKey}:`,
          parseError
        );
        reject(parseError);
      }
    });
  });
}

/**
 * Runs all configured scrapers.
 */
async function runAllScrapers() {
  console.log("[Scraper] Starting all scrapers...");
  const overallStartTime = Date.now(); // Start timing for the entire scraping run

  for (const sourceKey in sourceConfig) {
    const config = sourceConfig[sourceKey];
    try {
      // The "Running scraper for X..." log is now handled by runScraperAndStore itself
      const { newArticlesCount, updatedArticlesCount, skippedArticlesCount } =
        await runScraperAndStore(sourceKey, config.scraperPath, config.model);
      console.log(
        `[Scraper] ${sourceKey}: New: ${newArticlesCount}, Updated: ${updatedArticlesCount}, Skipped: ${skippedArticlesCount}`
      );
    } catch (error) {
      console.error(
        `[Scraper] Failed to run scraper for ${sourceKey}:`,
        error.message
      );
    }
  }
  console.log("[Scraper] All scrapers finished.");
  const overallEndTime = Date.now(); // End timing for the entire run
  const overallDuration = ((overallEndTime - overallStartTime) / 1000).toFixed(
    2
  ); // Overall duration in seconds
  console.log(
    `[Scraper] Total scraping and ingestion time: ${overallDuration} seconds.`
  );
}

/**
 * Cleans up old news articles and associated questions.
 * @param {number} daysToKeep - Number of days to keep articles.
 */
async function cleanupOldNews(daysToKeep) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  cutoffDate.setHours(0, 0, 0, 0); // Set to start of the day for consistency

  let totalDeletedArticles = 0;
  let totalDeletedQuestions = 0;

  console.log(
    `[Cleanup] Starting cleanup for articles older than ${cutoffDate.toISOString()}...`
  );

  for (const sourceKey in sourceConfig) {
    const config = sourceConfig[sourceKey];
    try {
      // Find articles to delete
      const articlesToDelete = await config.model
        .find({ pubDate: { $lt: cutoffDate } }, "_id") // Only fetch _id for performance
        .lean();
      const articleIdsToDelete = articlesToDelete.map((a) => a._id);

      if (articleIdsToDelete.length > 0) {
        // Delete associated questions first
        const questionDeleteResult = await mongoose
          .model("Question")
          .deleteMany({
            articleId: { $in: articleIdsToDelete },
          });
        totalDeletedQuestions += questionDeleteResult.deletedCount;
        console.log(
          `[Cleanup] Deleted ${questionDeleteResult.deletedCount} questions associated with ${sourceKey} articles.`
        );
      } // Delete the articles themselves

      const articleDeleteResult = await config.model.deleteMany({
        pubDate: { $lt: cutoffDate },
      });
      totalDeletedArticles += articleDeleteResult.deletedCount;
      console.log(
        `[Cleanup] Deleted ${articleDeleteResult.deletedCount} articles from ${sourceKey}.`
      );
    } catch (error) {
      console.error(`[Cleanup] Error cleaning up ${sourceKey}:`, error.message);
    }
  }
  console.log(`[Cleanup] Total articles deleted: ${totalDeletedArticles}`);
  console.log(`[Cleanup] Total questions deleted: ${totalDeletedQuestions}`);
}

module.exports = {
  runScraperAndStore, // Exported if you need to run specific scrapers manually
  runAllScrapers,
  cleanupOldNews,
};
