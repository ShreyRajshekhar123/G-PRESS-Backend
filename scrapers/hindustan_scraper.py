# C:\Users\OKKKK\Desktop\G-Press 1\G-Press\Server\scrapers\hindustan_scraper.py

import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from datetime import datetime
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_hindustan_times_articles():
    sys.stdout.reconfigure(encoding='utf-8') # Ensure stdout is UTF-8

    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--log-level=3")
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36')
    options.page_load_strategy = 'eager'

    driver = None
    articles = []

    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

        url = "https://www.hindustantimes.com/latest-news"
        logging.info(f"Navigating to {url}")
        driver.get(url)
        driver.implicitly_wait(5) # Implicit wait for general page load

        logging.info("Scraping Hindustan Times articles...")
        
        # Use a more specific and stable CSS selector if available.
        # "div.cartHolder.listView" seems to be a good starting point.
        article_divs = driver.find_elements(By.CSS_SELECTOR, "div.cartHolder.listView")
        
        if not article_divs:
            logging.warning("No 'div.cartHolder.listView' elements found. Check selector or page structure.")
            return []

        for i, div in enumerate(article_divs):
            if len(articles) >= 25: # Limit to top 25 articles
                logging.info(f"Reached 25 articles for Hindustan Times. Stopping.")
                break

            title = None
            link = None
            
            # Use current scraping timestamp for consistency as per Option B
            current_scrape_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            try:
                title = div.get_attribute("data-vars-story-title")
                relative_url = div.get_attribute("data-vars-story-url")
                link = "https://www.hindustantimes.com" + relative_url if relative_url else None
                
                # HT seems to include "<span>" within titles; remove if present
                if title:
                    title = title.replace("<span class='webrupee'>₹</span>", "₹").strip()


                if title and link and len(title) > 5 and link.startswith('http'):
                    articles.append({
                        "title": title.strip(),
                        "link": link,
                        "date": current_scrape_time, # Always use current scrape time
                        "summary": title.strip(),   # Summary is same as title
                        "source": "hindustantimes"
                    })
                    logging.info(f"HT Item {i+1}: Added article: '{title[:50]}...' Date: {current_scrape_time}")
                else:
                    logging.warning(f"HT Item {i+1}: Skipping due to missing valid title or link. Title: '{title}', Link: '{link}'")

            except Exception as e:
                logging.error(f"HT Item {i+1}: Error processing article: {e}")
                continue # Continue to next article even if one fails

    except Exception as e:
        logging.error(f"Hindustan Times Scraper failed entirely: {e}")
        articles = [] # Ensure empty list on main failure
    finally:
        if driver:
            driver.quit()
            logging.info("Hindustan Times WebDriver closed.")
            
    return articles

if __name__ == "__main__":
    # The main block simply calls the function and prints its result
    articles_data = get_hindustan_times_articles()
    print(json.dumps(articles_data, ensure_ascii=False, indent=2))