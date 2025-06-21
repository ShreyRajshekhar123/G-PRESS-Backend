import sys
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException, StaleElementReferenceException
from datetime import datetime
import logging

# Configure logging for consistent output
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_hindu_articles():
    # Reconfigure stdout for UTF-8 encoding
    sys.stdout.reconfigure(encoding='utf-8')

    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument('--disable-gpu') # Often helps in headless mode
    options.add_argument('--start-maximized') # Maximizes window for consistent element visibility
    options.add_argument('--window-size=1920,1080') # Explicit window size
    options.add_argument("--log-level=3") # Suppress verbose ChromeDriver logs
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36') # Use a stable user agent
    options.page_load_strategy = 'eager' # Set page load strategy

    service = Service(ChromeDriverManager().install())
    driver = None
    articles = []

    try:
        driver = webdriver.Chrome(service=service, options=options)
        driver.get("https://www.thehindu.com/latest-news/")
        logging.info("Navigating to The Hindu latest news page.")

        # Give the page a moment to load, using an implicit wait from the original
        driver.implicitly_wait(5)

        # Get the current system date and time once for all articles
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            # Wait for some list items to be present before attempting to find all
            WebDriverWait(driver, 15).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "ul.timeline-with-img > li"))
            )
            logging.info("Initial article list items found.")
        except TimeoutException:
            logging.error("Hindu Scraper: Timeout waiting for initial article list elements (ul.timeline-with-img > li). Page might not have loaded correctly or selectors are wrong.")
            return [] # Return empty list if initial elements are not found

        items = driver.find_elements(By.CSS_SELECTOR, "ul.timeline-with-img > li")
        logging.info(f"Found {len(items)} potential article list items.")

        for i, item in enumerate(items):
            if len(articles) >= 25: # Limit to top 25 articles (consistent with TOI)
                logging.info(f"Reached 25 articles for The Hindu. Stopping.")
                break
            try:
                # Original logic extracts title from img alt/title, which often results in image descriptions.
                # If you want actual headlines, you might need to find a text element within the 'item'.
                # For now, keeping your original logic for consistency with previous successful runs.
                anchor = item.find_element(By.CSS_SELECTOR, "div.element > a")
                link = anchor.get_attribute("href")

                # The problem noted in previous runs: title often from image alt/title
                img = anchor.find_element(By.TAG_NAME, "img")
                title = img.get_attribute("title") or img.get_attribute("alt")

                if title and link and link.startswith('http'):
                    articles.append({
                        "title": title.strip(),
                        "link": link,
                        "summary": title.strip(), # Summary set to title for consistency
                        "source": "hindu",
                        "date": current_time
                    })
                    logging.info(f"Hindu Item {i+1}: Added article: '{title.strip()[:50]}...' Date: {current_time}")
                else:
                    logging.warning(f"Hindu Item {i+1}: Skipping invalid article (empty title/link or non-http link). Title: '{title}', Link: '{link}'")

            except NoSuchElementException:
                logging.warning(f"Hindu Item {i+1}: Could not find expected anchor or image within list item. Skipping.")
                continue # Skip to the next item if elements are not found
            except StaleElementReferenceException:
                logging.warning(f"Hindu Item {i+1}: Stale element reference, re-trying or skipping.")
                continue # Can occur if the DOM changes during iteration

    except WebDriverException as e:
        logging.error(f"Hindu Scraper: WebDriver error occurred: {e}")
        articles = [] # Ensure articles is empty on critical error
    except Exception as e:
        logging.error(f"Hindu Scraper: An unexpected error occurred: {e}")
        articles = []
    finally:
        if driver:
            driver.quit()
            logging.info("Hindu WebDriver closed.")

    return articles

if __name__ == "__main__":
    articles_data = get_hindu_articles()
    # Print JSON for consumption by other parts of the application
    print(json.dumps(articles_data, ensure_ascii=False, indent=2))