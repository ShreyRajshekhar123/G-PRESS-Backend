import sys
import json
import logging
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

sys.stdout.reconfigure(encoding='utf-8')
# Configure logging for consistent output. Logs go to stderr by default.
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)

def get_times_of_india_articles():
    # Ensure stdout is UTF-8 encoded for proper JSON output
    sys.stdout.reconfigure(encoding='utf-8')

    base_url = "https://timesofindia.indiatimes.com"
    url = f"{base_url}/news"

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
        logging.info(f"Fetching page content from {url} for Times of India...")
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)

        soup = BeautifulSoup(response.text, 'html.parser')

        # Combined selectors for main article links based on common TOI patterns
        article_link_elements = soup.select("a.VeCXM, a.nA5sP, a[href*='.cms']")

        logging.info(f"Found {len(article_link_elements)} potential article links.")

        for i, link_elem in enumerate(article_link_elements):
            if len(all_articles) >= 25: # Limit to top 25 articles
                logging.info(f"Reached 25 articles for TOI. Stopping.")
                break

            # Initialize with None; these will be set from the link slug
            title = None
            href = None
            description = None
            imageUrl = None

            # Use current scraping timestamp as the default 'publishedAt'
            published_at = datetime.now().isoformat()

            try:
                raw_href = link_elem.get('href')

                if raw_href:
                    # Construct full URL if it's a relative path
                    if raw_href.startswith('/'):
                        href = base_url + raw_href
                    elif raw_href.startswith('http://') or raw_href.startswith('https://'):
                        href = raw_href
                    else:
                        logging.warning(f"TOI Item {i+1}: Link '{raw_href}' is neither absolute nor relative path. Skipping link.")
                        continue
                else:
                    logging.warning(f"TOI Item {i+1}: Anchor tag found but href attribute is missing. Skipping link.")
                    continue

                # --- NEW LOGIC: Extract slug for Title and Description ---
                # Example: https://timesofindia.indiatimes.com/india/kanishka-bombing-1985-stresses-need-for-zero-tolerance-to-terrorism-eam-jaishankar/articleshow/69729197.cms
                # We want: kanishka-bombing-1985-stresses-need-for-zero-tolerance-to-terrorism-eam-jaishankar
                # This regex targets the segment before '/articleshow/' and after the last '/'
                slug_match = re.search(r'/(?P<slug>[^/]+)/articleshow/\d+\.cms$', href)
                
                if slug_match:
                    extracted_slug = slug_match.group('slug').replace('-', ' ').strip()
                    title = extracted_slug
                    description = extracted_slug
                else:
                    # Fallback if the specific TOI slug pattern isn't found
                    # Can extract the last part of the URL path before query parameters or #fragments
                    path_parts = href.split('/')
                    if path_parts[-1].endswith('.cms'):
                        # Take the part before '.cms' and remove potential article ID
                        fallback_slug = path_parts[-1].split('.cms')[0]
                        fallback_slug = re.sub(r'^\d+', '', fallback_slug) # Remove leading numbers if present
                        fallback_slug = fallback_slug.replace('-', ' ').strip()
                        if fallback_slug:
                             title = fallback_slug
                             description = fallback_slug
                        else:
                            title = "No Title Extracted"
                            description = "No Description Extracted"
                    else:
                        # As a last resort, just use the last meaningful part of the path
                        title = path_parts[-2].replace('-', ' ').strip() if len(path_parts) > 1 else "No Title Extracted"
                        description = title

                    logging.warning(f"TOI Item {i+1}: Specific slug pattern not found for '{href}'. Falling back to simpler extraction: '{title}'")


                # Filter out invalid or duplicate articles AFTER slug extraction
                # - No title (meaning slug extraction failed completely) or link already processed
                # - Titles that are too short (less than 5 chars for meaningfulness)
                if not title or len(title) < 5 or href in processed_links:
                    logging.debug(f"TOI Item {i+1}: Skipping invalid or duplicate article. Title: '{title}', Link: '{href}'")
                    continue

                # Image URL: Image elements are often siblings or within a specific container near the link.
                parent_article_container = link_elem.find_parent(class_=['J_XyX', '_3eP_t', 'c_H85', 'w_Phg'])
                if parent_article_container:
                    img_elem = parent_article_container.select_one("img[src], img[data-src]")
                    if img_elem:
                        imageUrl = img_elem.get('data-src', img_elem.get('src', '')).strip()
                        if imageUrl and not imageUrl.startswith('http'):
                            if imageUrl.startswith('//'):
                                imageUrl = 'https:' + imageUrl
                            elif imageUrl.startswith('/'):
                                imageUrl = base_url + imageUrl
                        if imageUrl and ('.gif' in imageUrl or 'spacer.gif' in imageUrl or 'placeholder' in imageUrl):
                            imageUrl = None

                # Add to set of processed links to avoid duplicates
                processed_links.add(href)

                all_articles.append({
                    "title": title,
                    "link": href,
                    "publishedAt": published_at,
                    "description": description,
                    "source": "timesofindia",
                    "imageUrl": imageUrl,
                    "content": None,
                    "categories": [],
                })
                logging.info(f"TOI Item {i+1}: Added article: '{title[:50]}...' Link: {href}")

            except Exception as e:
                logging.error(f"TOI Item {i+1}: Error processing article: {e}. Skipping to next.")
                continue
    except requests.exceptions.RequestException as e:
        logging.error(f"Times of India Scraper: Network or HTTP error occurred: {e}")
        all_articles = []
    except Exception as e:
        logging.error(f"Times of India Scraper failed unexpectedly: {e}")
        all_articles = []

    return all_articles

if __name__ == "__main__":
    # Call the scraper function to get the data
    articles_data = get_times_of_india_articles()

    # Print the JSON data to stdout ONCE for Node.js to consume
    json.dump(articles_data, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.flush()

    # This final log message goes to stderr, not stdout, so it doesn't break JSON parsing.
    logging.info("Times of India scraping process finished.")