// Server/config/sources.js

const path = require("path"); // IMPORTANT: Add this line!

const Hindu = require("../models/TheHindu");
const HindustanTimes = require("../models/HindustanTimes");
const TOI = require("../models/TimesOfIndia");
const IE = require("../models/IndianExpress");
const DNA = require("../models/DNA");

// Define a base path for your scrapers relative to the project root.
// __dirname here is 'Server/config'
// '..' takes it to 'Server'
// '..' again takes it to the root ('G-PRESS-Backend')
// 'scrapers' then enters your scrapers folder.
// This is the correct, cross-platform way to define the path.
const PROJECT_ROOT_DIR = path.join(__dirname, "..", ".."); // Navigates from /Server/config to the project root
const SCRAPERS_DIR = path.join(PROJECT_ROOT_DIR, "scrapers");

// If your 'Server' directory is the root of your Git repo on Render,
// then __dirname is '/opt/render/project/src/Server/config'
// '..' -> '/opt/render/project/src/Server'
// '..' -> '/opt/render/project/src/' (this is your repo root on Render)
// So, path.join(__dirname, '..', '..', 'scrapers') should be correct.

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
