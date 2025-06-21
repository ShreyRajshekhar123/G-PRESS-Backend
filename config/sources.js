// Server/config/sources.js

const Hindu = require("../models/TheHindu");
const HindustanTimes = require("../models/HindustanTimes");
const TOI = require("../models/TimesOfIndia");
const IE = require("../models/IndianExpress");
const DNA = require("../models/DNA");

// Define your source configuration here
const sourceConfig = {
  hindu: {
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1\\G-Press\\Server\\scrapers\\hindu_scraper.py",
    model: Hindu,
    modelName: "TheHindu",
    sourceName: "The Hindu", // <--- ADD THIS LINE
    collectionName: "hindus",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  "hindustan-times": {
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1\\G-Press\\Server\\scrapers\\hindustan_scraper.py",
    model: HindustanTimes,
    modelName: "HindustanTimes",
    sourceName: "Hindustan Times", // <--- ADD THIS LINE
    collectionName: "hindustantimes",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  toi: {
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1\\G-Press\\Server\\scrapers\\times_of_india_scraper.py",
    model: TOI,
    modelName: "TimesOfIndia",
    sourceName: "Times of India", // <--- ADD THIS LINE
    collectionName: "tois",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  ie: {
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1\\G-Press\\Server\\scrapers\\indian_express.py",
    model: IE,
    modelName: "IndianExpress",
    sourceName: "Indian Express", // <--- ADD THIS LINE
    collectionName: "ies",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  dna: {
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1\\G-Press\\Server\\scrapers\\dna_scraper.py",
    model: DNA,
    modelName: "DNA",
    sourceName: "DNA", // <--- ADD THIS LINE
    collectionName: "dnas",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
};

module.exports = {
  sourceConfig,
};
