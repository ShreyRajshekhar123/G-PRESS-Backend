# C:\Users\OKKKK\Desktop\G-Press 1\G-Press\Server\scrapers\indian_express.py

import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.common.exceptions import StaleElementReferenceException
from datetime import datetime
import sys
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_indian_express_articles():
    sys.stdout.reconfigure(encoding='utf-8') # Ensure stdout is UTF-8

    # Configure headless Chrome
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
    data = []

    try:
        driver = webdriver.Chrome(service=service, options=options)
        driver.get("https://indianexpress.com/")
        logging.info("Waiting for initial page content to load for Indian Express...")
        time.sleep(5) # Let the page load

        logging.info("Scraping Indian Express articles...")
        
        # Selectors for main headlines and list items
        article_links = driver.find_elements(By.CSS_SELECTOR, 
            "div.section-article h2 a, " # For main headlines
            "div.articles div.articles li a, " # For list items
            "div.other-article a" # For other article blocks
        )

        processed_links = set() # To store links and avoid duplicates

        for i, link_elem in enumerate(article_links):
            if len(data) >= 25:
                logging.info(f"Reached 25 articles for Indian Express. Stopping.")
                break

            title = None
            href = None
            
            # Use current scraping timestamp for consistency across all scrapers
            current_scrape_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            try:
                title = link_elem.text.strip()
                href = link_elem.get_attribute("href")

                # Avoid empty titles or non-http links or duplicates
                if not title or not href or not href.startswith('http') or href in processed_links:
                    logging.debug(f"IE Item {i+1}: Skipping invalid or duplicate article. Title: '{title}', Link: '{href}'")
                    continue
                
                data.append({
                    "title": title,
                    "link": href,
                    "date": current_scrape_time, # Always use current scrape time
                    "summary": title,            # Summary is same as title
                    "source": "indianexpress"
                })
                processed_links.add(href) # Add to set of processed links
                logging.info(f"IE Item {i+1}: Added article: '{title[:50]}...' Date: {current_scrape_time}")

            except StaleElementReferenceException:
                logging.warning(f"IE Item {i+1}: Stale element encountered for link. Skipping this item.")
                continue # Skip to the next item if stale
            except Exception as e:
                logging.error(f"IE Item {i+1}: Error processing article: {e}")
                continue

    except Exception as e:
        logging.error(f"Indian Express Scraper failed entirely: {e}")
        data = []
    finally:
        if driver:
            driver.quit()
            logging.info("Indian Express WebDriver closed.")
            
    return data # Return the data instead of printing it directly from the function

if __name__ == "__main__":
    articles_data = get_indian_express_articles()
    print(json.dumps(articles_data, ensure_ascii=False, indent=2))