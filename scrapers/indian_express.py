# C:\Users\OKKKK\Desktop\G-Press 1\G-Press\Server\scrapers\indian_express.py

import json
import sys
from datetime import datetime
import logging
import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_indian_express_articles():
    sys.stdout.reconfigure(encoding='utf-8') # Ensure stdout is UTF-8

    base_url = "https://indianexpress.com"
    url = f"{base_url}/" # The base URL for Indian Express

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }

    all_articles = []
    processed_links = set() # To store links and avoid duplicates

    try:
        logging.info(f"Fetching page content from {url} for Indian Express...")
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)

        soup = BeautifulSoup(response.text, 'html.parser')

        # Use the combined CSS selectors from the original Selenium script
        article_link_elements = soup.select(
            "div.section-article h2 a, " # For main headlines
            "div.articles div.articles li a, " # For list items (e.g., in latest news sections)
            "div.other-article a" # For other article blocks
        )
        
        logging.info(f"Found {len(article_link_elements)} potential article links.")

        for i, link_elem in enumerate(article_link_elements):
            if len(all_articles) >= 25: # Limit to top 25 articles
                logging.info(f"Reached 25 articles for Indian Express. Stopping.")
                break

            title = None
            href = None
            description = None
            imageUrl = None
            
            # Always use current scraping timestamp for consistency
            published_at = datetime.now().isoformat()

            try:
                title = link_elem.get_text(strip=True)
                href = link_elem.get('href')

                # Skip if title or link is empty, or if link is not http/https, or if already processed
                if not title or not href or not href.startswith('http') or href in processed_links:
                    logging.debug(f"IE Item {i+1}: Skipping invalid or duplicate article. Title: '{title}', Link: '{href}'")
                    continue
                
                # Try to find a description. This might vary greatly by article block.
                # A common pattern could be a sibling <p> tag or a <p> within a parent.
                # For now, let's keep it simple and set description to title for consistency with original.
                description = title 

                # Try to find an image associated with the article.
                # This is highly dependent on the specific HTML structure around each link.
                # A common pattern might be an image within a parent or sibling div.
                # Example: <div class="s-img"><img src="..."></div>
                # Let's try finding an img tag within the parent div of the link or an immediate sibling.
                parent_div = link_elem.find_parent('div')
                if parent_div:
                    # Look for image within the parent or a sibling image container
                    img_elem = parent_div.select_one("img[src]") # Find img with src attribute
                    if img_elem and img_elem.get('src'):
                        imageUrl = img_elem.get('src')
                    else:
                        # Try finding image in a sibling 'div.s-img' or similar
                        sibling_img_div = parent_div.find_previous_sibling("div", class_="s-img")
                        if sibling_img_div:
                            img_elem = sibling_img_div.select_one("img[src]")
                            if img_elem and img_elem.get('src'):
                                imageUrl = img_elem.get('src')
                
                # Add to processed links to avoid duplicates
                processed_links.add(href)

                all_articles.append({
                    "title": title,
                    "link": href,
                    "publishedAt": published_at,
                    "description": description,
                    "source": "indianexpress",
                    "imageUrl": imageUrl, # Will be None if not found in static HTML
                    "content": None, # Full content would require visiting each article link
                    "categories": [], # Not easily available on listing page
                })
                logging.info(f"IE Item {i+1}: Added article: '{title[:50]}...'")

            except Exception as e:
                logging.error(f"IE Item {i+1}: Error processing article: {e}. Skipping to next.")
                continue # Continue to next article even if one fails

    except requests.exceptions.HTTPError as e:
        logging.error(f"Indian Express Scraper: HTTP error occurred: {e} - Status Code: {e.response.status_code}")
        all_articles = [] # Ensure empty list on critical error
    except requests.exceptions.ConnectionError as e:
        logging.error(f"Indian Express Scraper: Connection error occurred: {e}. Check internet connection or URL.")
        all_articles = []
    except requests.exceptions.Timeout as e:
        logging.error(f"Indian Express Scraper: Timeout error occurred: {e}. Server took too long to respond.")
        all_articles = []
    except requests.exceptions.RequestException as e:
        logging.error(f"Indian Express Scraper: An unexpected requests error occurred: {e}")
        all_articles = []
    except Exception as e:
        logging.error(f"Indian Express Scraper: An unexpected error occurred: {e}")
        all_articles = []
    finally:
        # Print the entire list of articles as JSON to stdout.
        json.dump(all_articles, sys.stdout, ensure_ascii=False, indent=2)
        logging.info("Indian Express scraping process finished.")

if __name__ == "__main__":
    get_indian_express_articles()