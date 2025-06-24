// Server/config/sources.js

const Hindu = require("../models/TheHindu");
const HindustanTimes = require("../models/HindustanTimes");
const TOI = require("../models/TimesOfIndia");
const IE = require("../models/IndianExpress");
const DNA = require("../models/DNA");

// Define your source configuration here
const sourceConfig = {
  hindu: {
    // UPDATED PATH HERE
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1 Backend\\G-PRESS-Backend\\scrapers\\hindu_scraper.py",
    model: Hindu,
    modelName: "TheHindu",
    sourceName: "The Hindu",
    collectionName: "hindus",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  "hindustan-times": {
    // UPDATED PATH HERE
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1 Backend\\G-PRESS-Backend\\scrapers\\hindustan_scraper.py",
    model: HindustanTimes,
    modelName: "HindustanTimes",
    sourceName: "Hindustan Times",
    collectionName: "hindustantimes",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  toi: {
    // UPDATED PATH HERE
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1 Backend\\G-PRESS-Backend\\scrapers\\times_of_india_scraper.py",
    model: TOI,
    modelName: "TimesOfIndia",
    sourceName: "Times of India",
    collectionName: "tois",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  ie: {
    // UPDATED PATH HERE
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1 Backend\\G-PRESS-Backend\\scrapers\\indian_express.py",
    model: IE,
    modelName: "IndianExpress",
    sourceName: "Indian Express",
    collectionName: "ies",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  dna: {
    // UPDATED PATH HERE
    scraperPath:
      "C:\\Users\\OKKKK\\Desktop\\G-Press 1 Backend\\G-PRESS-Backend\\scrapers\\dna_scraper.py",
    model: DNA,
    modelName: "DNA",
    sourceName: "DNA",
    collectionName: "dnas",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
};

module.exports = {
  sourceConfig,
};
