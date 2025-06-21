// C:\Users\OKKKK\Desktop\G-Press\G-Press\Server\services\aiService.js

const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// IMPORTANT: Using "gemini-1.5-flash" as requested
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const MAX_RETRIES = 5; // Max retries for API calls
const INITIAL_RETRY_DELAY_MS = 2000; // Initial delay in milliseconds (2 seconds)

/**
 * Generates questions for a batch of articles using the Gemini API.
 * The input is an array of objects like { _id: string, title: string, sourceName: string }.
 *
 * @param {Array<Object>} articles An array of article objects, each with at least _id, title, and sourceName.
 * @returns {Promise<Object>} A promise that resolves to an object where keys are article _ids
 * and values are arrays of generated questions, or an empty object if no questions generated.
 */
async function generateQuestionsForBatch(articles) {
  if (!articles || articles.length === 0) {
    console.log(
      "[AI Service] No articles to generate questions for in this batch."
    );
    return {};
  }

  const articleInputs = articles.map((article) => ({
    id: article._id, // Use _id as the unique identifier for AI to return
    title: article.title,
    source: article.sourceName,
  }));

  // Construct the prompt to guide the AI based on title and source only
  const prompt = `Generate 5 multiple-choice questions (MCQs) for each of the following news articles.
  Each question should have 4 options (A, B, C, D) and specify the single correct answer.
  Focus on general current affairs knowledge that might be implied or directly stated by the title and source, rather than deep specifics that would require the full article content.
  The questions should be relevant to the provided title and news source.
  The output must be a JSON object where keys are the article IDs (matching the 'id' field provided in the input) and values are arrays of question objects.
  Each question object should have 'questionText', 'options' (an array of strings), and 'correctAnswer' (a string matching one of the options).

  Example JSON format for one article:
  {
    "65e6d628d0b5e98f2d5e305e": [ // This key MUST be the actual MongoDB _id string
      {
        "questionText": "Question 1 related to article 1 title.",
        "options": ["A. Option A", "B. Option B", "C. Option C", "D. Option D"],
        "correctAnswer": "A. Option A"
      },
      {
        "questionText": "Question 2 related to article 1 title.",
        "options": ["A. Opt A", "B. Opt B", "C. Opt C", "D. Opt D"],
        "correctAnswer": "B. Opt B"
      }
    ]
  }

  Here are the articles (Title and Source only):
  ${JSON.stringify(articleInputs, null, 2)}
  `;

  let retryCount = 0;
  let delay = INITIAL_RETRY_DELAY_MS;

  while (retryCount < MAX_RETRIES) {
    try {
      console.log(
        `[AI Service] Sending batch of ${
          articles.length
        } articles to Gemini for question generation. Attempt: ${
          retryCount + 1
        }`
      );

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json", // This is the correct place for it
          temperature: 0.7,
          topP: 0.95,
          topK: 60,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE",
          },
        ],
      });

      const response = await result.response;
      let text = response.text(); // The raw text response from Gemini

      console.log(
        `[AI Service] Raw Gemini response (first 500 chars): ${text.substring(
          0,
          500
        )}...`
      );

      // --- CRITICAL FIX START: Clean the response text to remove markdown code block delimiters ---
      let cleanedJsonString = text.trim();

      // Remove leading '```json'
      if (cleanedJsonString.startsWith("```json")) {
        cleanedJsonString = cleanedJsonString
          .substring("```json".length)
          .trim();
      }
      // Remove any single leading newline if present after '```json'
      if (cleanedJsonString.startsWith("\n")) {
        cleanedJsonString = cleanedJsonString.substring(1).trim();
      }

      // Remove trailing '```'
      if (cleanedJsonString.endsWith("```")) {
        cleanedJsonString = cleanedJsonString.slice(0, -"```".length).trim();
      }
      // --- CRITICAL FIX END ---

      console.log(
        `[AI Service] Cleaned JSON string (first 500 chars): ${cleanedJsonString.substring(
          0,
          500
        )}...`
      );

      // Attempt to parse JSON
      const parsedQuestions = JSON.parse(cleanedJsonString);

      // Validate the structure slightly: Ensure it's an object and contains arrays for IDs
      if (
        typeof parsedQuestions === "object" &&
        parsedQuestions !== null &&
        Object.keys(parsedQuestions).length > 0
      ) {
        console.log(`[AI Service] Successfully generated questions for batch.`);
        // The parsedQuestions should already have the correct article _ids as keys
        return parsedQuestions;
      } else {
        console.error(
          `[AI Service] Gemini response parsed as valid JSON but did not contain expected question structure or was empty. Raw AI output: ${text.substring(
            0,
            500
          )}`
        );
        throw new Error("Gemini returned invalid or empty question structure.");
      }
    } catch (error) {
      console.error(
        `[AI Service] Failed to generate questions for batch. Attempt ${
          retryCount + 1
        } of ${MAX_RETRIES}:`,
        error.message
      );
      // Log the original text if a SyntaxError occurred during JSON.parse
      if (error instanceof SyntaxError && text) {
        console.error(
          `[AI Service] SyntaxError: Original text was: \n---\n${text}\n---`
        );
      }

      // Check for quota exceeded and specific retry info
      if (
        error.status === 429 && // Quota exceeded
        error.errorDetails &&
        error.errorDetails.some(
          (detail) =>
            detail["@type"] ===
            "[type.googleapis.com/google.rpc.RetryInfo](https://type.googleapis.com/google.rpc.RetryInfo)" // Corrected type string
        )
      ) {
        const retryInfo = error.errorDetails.find(
          (detail) =>
            detail["@type"] ===
            "[type.googleapis.com/google.rpc.RetryInfo](https://type.googleapis.com/google.rpc.RetryInfo)" // Corrected type string
        );
        // Ensure retryInfo and retryDelay exist before trying to access
        const retryDelaySeconds =
          retryInfo && retryInfo.retryDelay
            ? parseInt(retryInfo.retryDelay.replace("s", ""), 10)
            : null;

        delay =
          retryDelaySeconds && !isNaN(retryDelaySeconds)
            ? retryDelaySeconds * 1000
            : delay * 2; // Use suggested delay or exponential backoff
        console.warn(
          `[AI Service] Quota exceeded (429). Using suggested retry delay of ${
            delay / 1000
          } seconds.`
        );
      } else {
        delay = delay * 2; // Exponential backoff for other errors
        console.warn(
          `[AI Service] Retrying in ${delay / 1000} seconds due to error.`
        );
      }

      retryCount++;
      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[AI Service] Failed to generate questions for batch after ${MAX_RETRIES} retries or due to another error:`,
          error.message
        );
        // Ensure the error is re-thrown so articleProcessor can catch it and mark articles as failed
        throw new Error(`GoogleGenerativeAIFetchError: ${error.message}`);
      }
    }
  }
  return {}; // Should not reach here if retries are exhausted and error is thrown
}

module.exports = { generateQuestionsForBatch };
