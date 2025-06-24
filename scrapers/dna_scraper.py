# C:\Users\OKKKK\Desktop\G-Press 1\G-Press\Server\scrapers\dna_scraper.py
import json
import sys
from datetime import datetime
import logging
import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')
# Configure logging to write to stderr so it doesn't interfere with JSON output to stdout
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)

def get_dna_articles():
    # It's good practice to ensure stdout encoding is utf-8, especially for direct output
    sys.stdout.reconfigure(encoding='utf-8')

    base_url = "https://www.dnaindia.com"
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
        logging.info(f"Fetching page content from {url} for DNA India...")
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        articles_containers = soup.select("div.list-news")

        logging.info(f"Found {len(articles_containers)} potential article containers.")

        for i, article_container_elem in enumerate(articles_containers[:25]):
            title = None
            href = None
            imageUrl = None # Initialize imageUrl

            # Per user's request, always use system's current date and time for publishedAt
            published_at = datetime.now().isoformat()

            try:
                # --- Extract Link and Title from 'explainer-subtext' ---
                explainer_subtext_elem = article_container_elem.find("div", class_="explainer-subtext")
                if explainer_subtext_elem:
                    link_elem = explainer_subtext_elem.find("a")
                    if link_elem:
                        title = link_elem.get_text(strip=True)
                        raw_href = link_elem.get('href')

                        if raw_href:
                            if raw_href.startswith('/'):
                                href = base_url + raw_href
                            elif raw_href.startswith('http://') or raw_href.startswith('https://'):
                                href = raw_href
                            else:
                                logging.warning(f"DNA Item {i}: Link '{raw_href}' is neither absolute nor relative path. Skipping link.")
                                continue
                        else:
                            logging.warning(f"DNA Item {i}: 'a' tag found but href attribute is missing. Skipping link.")
                            continue
                else:
                    logging.warning(f"DNA Item {i}: Could not find 'explainer-subtext' div. Skipping.")
                    continue

                # --- Attempt to Extract Image URL from 'lazy-img' ---
                # (Note: This will likely still be None due to dynamic loading, as discussed)
                img_div = article_container_elem.find("div", class_="lazy-img")
                if img_div:
                    actual_img_tag = img_div.find("img")
                    if actual_img_tag and actual_img_tag.get('src'):
                        imageUrl = actual_img_tag.get('src')
                    elif actual_img_tag and actual_img_tag.get('data-src'): # Check data-src as a fallback
                        imageUrl = actual_img_tag.get('data-src')

            except Exception as e:
                logging.warning(f"DNA Item {i}: An error occurred during element extraction. Skipping. Error: {e}")
                continue

            # Final validation check before adding the article
            if title and href and len(title) > 5 and (href.startswith('http://') or href.startswith('https://')):
                article_data = {
                    "title": title,
                    "link": href,
                    "publishedAt": published_at, # Always system's current date/time
                    "description": title,
                    "source": "dna",
                    "imageUrl": imageUrl, # Will likely be None
                    "content": None,
                    "categories": [],
                }
                all_articles.append(article_data)
            else:
                logging.warning(f"DNA Item {i}: Skipping due to final validation failure (e.g., missing title/link or invalid absolute URL). Title: '{title}', Link: '{href}'")

    except requests.exceptions.HTTPError as e:
        logging.error(f"HTTP error occurred while fetching DNA India: {e} - Status Code: {e.response.status_code}")
    except requests.exceptions.ConnectionError as e:
        logging.error(f"Connection error occurred while fetching DNA India: {e}. Check internet connection or URL.")
    except requests.exceptions.Timeout as e:
        logging.error(f"Timeout error occurred while fetching DNA India: {e}. Server took too long to respond.")
    except requests.exceptions.RequestException as e:
        logging.error(f"An unexpected requests error occurred while fetching DNA India: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred during DNA scraping: {e}")
    finally:
        # This is the key change: dump the entire list of articles as JSON to stdout
        json.dump(all_articles, sys.stdout, indent=4, ensure_ascii=False)
        logging.info("DNA scraping process finished.")

if __name__ == "__main__":
    get_dna_articles()