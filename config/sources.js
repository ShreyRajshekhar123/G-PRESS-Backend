// config/sources.js (NOT Server/config/sources.js, based on your screenshot)

const path = require("path");

const Hindu = require("../models/TheHindu");
const HindustanTimes = require("../models/HindustanTimes");
const TOI = require("../models/TimesOfIndia");
const IE = require("../models/IndianExpress");
const DNA = require("../models/DNA");

// CORRECTED LOGIC FOR YOUR FILE STRUCTURE:
// __dirname here will be '/opt/render/project/src/config'
// '..' takes it to '/opt/render/project/src/' (which is the root of your G-PRESS-Backend repo on Render)
const PROJECT_ROOT_ON_RENDER = path.join(__dirname, "..");
const SCRAPERS_DIR = path.join(PROJECT_ROOT_ON_RENDER, "scrapers"); // Now append 'scrapers'

// Define your source configuration here
const sourceConfig = {
  hindu: {
    scraperPath: path.join(SCRAPERS_DIR, "hindu_scraper.py"),
    model: Hindu,
    modelName: "TheHindu",
    sourceName: "The Hindu",
    collectionName: "hindus",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  "hindustan-times": {
    scraperPath: path.join(SCRAPERS_DIR, "hindustan_scraper.py"),
    model: HindustanTimes,
    modelName: "HindustanTimes",
    sourceName: "Hindustan Times",
    collectionName: "hindustantimes",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  toi: {
    scraperPath: path.join(SCRAPERS_DIR, "times_of_india_scraper.py"),
    model: TOI,
    modelName: "TimesOfIndia",
    sourceName: "Times of India",
    collectionName: "tois",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  ie: {
    scraperPath: path.join(SCRAPERS_DIR, "indian_express.py"),
    model: IE,
    modelName: "IndianExpress",
    sourceName: "Indian Express",
    collectionName: "ies",
    updateInterval: 30 * 60 * 1000, // 30 minutes
    lastScraped: null,
  },
  dna: {
    scraperPath: path.join(SCRAPERS_DIR, "dna_scraper.py"),
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
