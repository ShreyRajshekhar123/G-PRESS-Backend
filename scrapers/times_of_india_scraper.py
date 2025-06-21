# C:\Users\OKKKK\Desktop\G-Press\G-Press\Server\scrapers\times_of_india_scraper.py

import sys
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service # Import Service for ChromeDriverManager
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException, WebDriverException
import time
from datetime import datetime # Import datetime for timestamp
import logging # Import logging for better output control

# Configure logging for consistent output
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_times_of_india_articles():
    # Reconfigure stdout for UTF-8 encoding
    sys.stdout.reconfigure(encoding='utf-8')

    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu') # Often helps in headless mode
    options.add_argument('--start-maximized') # Maximizes window for consistent element visibility
    options.add_argument('--window-size=1920,1080') # Explicit window size
    options.add_argument("--log-level=3") # Suppress verbose ChromeDriver logs
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36') # Use a stable user agent
    options.page_load_strategy = 'eager'

    service = Service(ChromeDriverManager().install())
    driver = None
    headlines = []

    try:
        driver = webdriver.Chrome(service=service, options=options) # Correctly use service and options
        driver.get("https://timesofindia.indiatimes.com/news")
        logging.info("Navigating to Times of India news page.")

        try:
            # Wait for main article links to be present
            # Based on previous successful run, 'a.VeCXM' appears to be a valid selector for *some* articles
            WebDriverWait(driver, 20).until( # Increased wait time for robustness
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "a.VeCXM"))
            )
            logging.info("Initial article elements ('a.VeCXM') found for Times of India.")
        except TimeoutException:
            logging.error("TOI Scraper: Timeout waiting for initial elements ('a.VeCXM'). Page might not have loaded correctly or selectors are wrong.")
            # Re-raise to fall into the main exception block, ensuring driver.quit()
            raise

        # Scroll down to load more articles (common for TOI's dynamic loading)
        last_height = driver.execute_script("return document.body.scrollHeight")
        scroll_attempts = 0
        max_scroll_attempts = 3 # Increased for more articles

        while scroll_attempts < max_scroll_attempts:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2) # Give time for content to load after scroll
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                logging.info("No new content loaded after scroll. Stopping scrolling.")
                break
            last_height = new_height
            scroll_attempts += 1
        logging.info(f"Finished scrolling. Scrolled {scroll_attempts} times.")

        # Re-find all relevant article elements after scrolling
        # This will include newly loaded content.
        # Still using 'a.VeCXM' as it proved successful in the last output.
        # If this proves unreliable again, more complex selectors or a broader search (e.g., a[href*=".cms"]) might be needed.
        anchors = driver.find_elements(By.CSS_SELECTOR, "a.VeCXM")
        logging.info(f"Found {len(anchors)} potential article links after scrolling.")

        # Build headlines list
        for i, a in enumerate(anchors[:25]): # Limit to top 25 articles
            if len(headlines) >= 25:
                logging.info(f"Reached 25 articles for TOI. Stopping.")
                break

            title = a.text.strip()
            link = a.get_attribute("href")
            
            # --- Add current timestamp for date field ---
            # Consistent with other scrapers, using YYYY-MM-DD HH:MM:SS format
            current_scrape_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            if title and link and link.startswith('http'):
                headlines.append({
                    "title": title,
                    "link": link,
                    "date": current_scrape_time, # Added date field
                    "summary": title, # Added summary field for consistency
                    "source": "timesofindia"
                })
                logging.info(f"TOI Item {i+1}: Added article: '{title[:50]}...' Date: {current_scrape_time}")
            else:
                logging.warning(f"TOI Item {i+1}: Skipping invalid article (empty title/link or non-http link). Title: '{title}', Link: '{link}'")

    except TimeoutException as e:
        logging.error(f"TOI Scraper: Timeout error: {e}. Check network connection or website structure.")
        headlines = []
    except WebDriverException as e:
        logging.error(f"TOI Scraper: WebDriver error: {e}. Ensure Chromedriver is compatible with your Chrome browser.")
        headlines = []
    except Exception as e:
        logging.error(f"TOI Scraper failed unexpectedly: {e}")
        headlines = []
    finally:
        if driver:
            driver.quit()
            logging.info("Times of India WebDriver closed.")
            
    return headlines # Return the list for external printing

if __name__ == "__main__":
    articles_data = get_times_of_india_articles()
    # Print JSON for consumption by other parts of the application
    print(json.dumps(articles_data, ensure_ascii=False, indent=2))