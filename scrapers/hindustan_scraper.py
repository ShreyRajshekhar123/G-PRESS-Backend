import json
import sys
from datetime import datetime, timezone # Import timezone
import logging
import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_hindustan_times_articles():
    sys.stdout.reconfigure(encoding='utf-8') # Ensure stdout is UTF-8

    base_url = "https://www.hindustantimes.com"
    url = f"{base_url}/latest-news"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }

    all_articles = []

    try:
        logging.info(f"Fetching page content from {url} for Hindustan Times...")
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)

        soup = BeautifulSoup(response.text, 'html.parser')

        # Use the same CSS selector for article containers as in the Selenium script
        article_divs = soup.select("div.cartHolder.listView")
        
        logging.info(f"Found {len(article_divs)} potential article containers.")

        if not article_divs:
            logging.warning("No 'div.cartHolder.listView' elements found. Check selector or page structure.")
            return [] # Return empty list if no main containers are found

        for i, div in enumerate(article_divs):
            if len(all_articles) >= 25: # Limit to top 25 articles
                logging.info(f"Reached 25 articles for Hindustan Times. Stopping.")
                break

            title = None
            link = None
            description = None
            imageUrl = None
            
            # Use UTC time and include timezone information
            published_at = datetime.now(timezone.utc).isoformat() 

            try:
                # Extract title and URL from data attributes as in the original Selenium script
                title = div.get('data-vars-story-title')
                relative_url = div.get('data-vars-story-url')
                
                if relative_url:
                    link = base_url + relative_url
                else:
                    logging.warning(f"HT Item {i+1}: Missing 'data-vars-story-url'. Skipping.")
                    continue

                # Clean title if it contains specific span tags (as per original script)
                if title:
                    title = title.replace("<span class='webrupee'>₹</span>", "₹").strip()
                else:
                    logging.warning(f"HT Item {i+1}: Missing 'data-vars-story-title'. Skipping.")
                    continue
                
                description_elem = div.select_one("div.detail p.para-txt")
                if description_elem:
                    description = description_elem.get_text(strip=True)
                else:
                    description = title # Fallback to title if no specific description found

                # Extract Image URL
                # Look for an img tag within div.img-sec or similar structure
                img_elem = div.select_one("div.img-sec img")
                if img_elem and img_elem.get('src'):
                    imageUrl = img_elem.get('src')
                # imageUrl remains None if not found, consistent with DNA scraper

                if title and link and len(title) > 5 and link.startswith('http'):
                    all_articles.append({
                        "title": title,
                        "link": link,
                        "publishedAt": published_at,
                        "description": description,
                        "source": "hindustantimes",
                        "imageUrl": imageUrl,
                        "content": None, # Full content would require visiting each article link
                        "categories": [], # Not easily available on listing page
                    })
                    logging.info(f"HT Item {i+1}: Added article: '{title[:50]}...'")
                else:
                    logging.warning(f"HT Item {i+1}: Skipping due to missing valid title or link, or short title. Title: '{title}', Link: '{link}'")

            except Exception as e:
                logging.error(f"HT Item {i+1}: Error processing article: {e}. Skipping to next.")
                continue # Continue to next article even if one fails

    except requests.exceptions.HTTPError as e:
        logging.error(f"Hindustan Times Scraper: HTTP error occurred: {e} - Status Code: {e.response.status_code}")
        all_articles = [] # Ensure empty list on critical error
    except requests.exceptions.ConnectionError as e:
        logging.error(f"Hindustan Times Scraper: Connection error occurred: {e}. Check internet connection or URL.")
        all_articles = []
    except requests.exceptions.Timeout as e:
        logging.error(f"Hindustan Times Scraper: Timeout error occurred: {e}. Server took too long to respond.")
        all_articles = []
    except requests.exceptions.RequestException as e:
        logging.error(f"Hindustan Times Scraper: An unexpected requests error occurred: {e}")
        all_articles = []
    except Exception as e:
        logging.error(f"Hindustan Times Scraper: An unexpected error occurred: {e}")
        all_articles = []
    finally:
        # Print the entire list of articles as JSON to stdout.
        json.dump(all_articles, sys.stdout, ensure_ascii=False, indent=2)
        logging.info("Hindustan Times scraping process finished.")

if __name__ == "__main__":
    get_hindustan_times_articles()