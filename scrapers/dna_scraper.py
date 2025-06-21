# C:\Users\OKKKK\Desktop\G-Press 1\G-Press\Server\scrapers\dna_scraper.py
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, StaleElementReferenceException
from datetime import datetime
import sys
import time
import logging
# import requests # REMOVED: No longer needed for direct HTTP POST

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- REMOVED: NODE_BACKEND_INGESTION_URL is no longer needed ---
# NODE_BACKEND_INGESTION_URL = 'http://localhost:5000/api/news/ingest-scraped-article'
# ---------------------------------------------------------------

def get_dna_articles():
    sys.stdout.reconfigure(encoding='utf-8')

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument("--log-level=3")
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36')
    options.page_load_strategy = 'eager'

    service = Service(ChromeDriverManager().install())
    driver = None

    # --- NEW: Initialize an empty list to store all scraped articles ---
    all_articles = []
    # ------------------------------------------------------------------

    try:
        driver = webdriver.Chrome(service=service, options=options)
        driver.get("https://www.dnaindia.com/latest-news")

        logging.info("Waiting for initial page content to load for DNA India...")
        time.sleep(5)

        for i in range(25): # Loop through articles
            try:
                articles_containers = driver.find_elements(By.CSS_SELECTOR, "div.explainer-subtext")

                if i >= len(articles_containers):
                    logging.info(f"Fewer than 25 articles found. Breaking loop at article {i}.")
                    break

                article_elem = articles_containers[i]

                link_elem = None
                title = None
                href = None
                
                try:
                    link_elem = article_elem.find_element(By.TAG_NAME, "a")
                    title = link_elem.text.strip()
                    href = link_elem.get_attribute("href")
                except NoSuchElementException:
                    logging.warning(f"DNA Item {i}: Could not find 'a' tag or title/href. Skipping.")
                    continue

                # Use current timestamp as publishedAt if not found on listing page
                published_at = datetime.now().isoformat()
                logging.info(f"DNA Item {i}: Actual article date not found on listing page. Using current timestamp.")

                if title and href and len(title) > 5 and href.startswith('http'):
                    article_data = {
                        "title": title,
                        "link": href,
                        "publishedAt": published_at,
                        "description": title, # Using title as description if no summary available
                        "source": "dna",
                        "imageUrl": None, # DNA scraper doesn't get image directly here
                        "content": None, # Full content will be scraped by Node.js later, if needed
                        "categories": [], # Initialize categories as an empty list. Populate this if DNA provides categories!
                    }

                    # --- MODIFIED: Append article to list instead of sending HTTP POST ---
                    all_articles.append(article_data)
                    # logging.info(f"DNA Item {i}: Added to list for later output.") # Optional: for debugging Python script directly
                    # ------------------------------------------------------------------
                else:
                    logging.warning(f"DNA Item {i}: Skipping due to missing title/link or invalid format. Title: '{title}', Link: '{href}'")

            except StaleElementReferenceException:
                logging.warning(f"DNA Item {i}: Stale element encountered. Skipping this item.")
                continue
            except NoSuchElementException as e:
                logging.warning(f"DNA Item {i}: Element not found: {e}. Skipping this item.")
                continue
            except Exception as e:
                logging.error(f"DNA Item {i}: An unexpected error occurred: {e}")
                continue

    except Exception as e:
        logging.error(f"DNA Scraper failed: {e}")
    finally:
        if driver:
            driver.quit()
            logging.info("DNA WebDriver closed.")
        
        # --- NEW: Print the entire list of articles as JSON to stdout ---
        # This is what your Node.js backend expects to parse
        json.dump(all_articles, sys.stdout)
        # -----------------------------------------------------------------

if __name__ == "__main__":
    get_dna_articles()