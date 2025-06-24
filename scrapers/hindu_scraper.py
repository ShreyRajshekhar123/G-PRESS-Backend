import requests
from bs4 import BeautifulSoup
import json
import re
import logging
import datetime
import sys

sys.stdout.reconfigure(encoding='utf-8')
# Configure logging to write to stderr
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)

def get_hindu_articles():
    """
    Scrapes articles from The Hindu's National News section.
    Extracts title, link, image URL, and publication time.
    The description is derived from the link's slug.
    """
    base_url = "https://www.thehindu.com"
    target_url = "https://www.thehindu.com/news/national/" # Targeting the National News page
    articles = []

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }

    logging.info(f"Navigating to {target_url} for The Hindu National News.")
    try:
        response = requests.get(target_url, headers=headers, timeout=15)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx or 5xx)
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching {target_url}: {e}")
        return []

    soup = BeautifulSoup(response.content, 'html.parser')

    article_blocks = soup.find_all("div", class_="element row-element")

    logging.info(f"Found {len(article_blocks)} potential article elements from National News page.")

    count = 0
    for i, block in enumerate(article_blocks):
        if count >= 25: # Cap at 25 articles
            logging.info("Reached 25 valid articles for The Hindu National News. Stopping.")
            break

        title = ''
        link = ''
        description = '' # Will be populated from the link
        image_url = ''
        published_date = datetime.datetime.now(datetime.timezone.utc).isoformat() # Default to current UTC time if not found

        # --- Extract Title and Link ---
        title_h3 = block.find('h3', class_='title big')

        if title_h3:
            main_link_tag = title_h3.find('a', href=True)
            if main_link_tag:
                title = main_link_tag.get_text(strip=True)
                link = main_link_tag['href']

                if not link.startswith('http'):
                    link = base_url + link
            else:
                logging.warning(f"Hindu National News Item {i+1}: No main link tag found inside h3.title. Skipping.")
                continue
        else:
            logging.warning(f"Hindu National News Item {i+1}: No h3 with class 'title big' found. Skipping element.")
            continue

        # --- Extract Image URL ---
        picture_div = block.find('div', class_='picture')
        if picture_div:
            img_tag = picture_div.find('img', src=True)
            if img_tag:
                image_url = img_tag['src']
                if not image_url or 'data:image' in image_url:
                    image_url = img_tag.get('data-src', '').strip()
                    if not image_url and img_tag.get('srcset'):
                        srcset_parts = img_tag['srcset'].split(',')
                        if srcset_parts:
                            image_url = srcset_parts[0].strip().split(' ')[0]

                if image_url and not image_url.startswith('http'):
                    if image_url.startswith('//'):
                        image_url = 'https:' + image_url
                    elif image_url.startswith('/'):
                        image_url = base_url + image_url

        # --- Extract Publication Date/Time (Time Logs) ---
        by_line_div = block.find('div', class_='by-line')
        if by_line_div:
            dateline_span = by_line_div.find('span', class_='dateline-timestamp')
            if dateline_span:
                time_tag = dateline_span.find('time', attrs={'datetime': True})
                if time_tag:
                    published_date = time_tag['datetime']

        # --- Validate the extracted data ---
        if not title or not link or not link.startswith('http') or \
           re.match(r'^\d+$', title.strip()) or \
           re.search(r'(page|next|previous)=', link.lower()):
            logging.warning(f"Hindu National News Item {i+1}: Skipping invalid article (missing title/link, invalid link format, or generic title). Title: '{title}', Link: '{link}'")
            continue

        # --- NEW: Extract description from the link slug ---
        # Example: https://www.thehindu.com/news/national/kanishka-bombing-1985-stresses-need-for-zero-tolerance-to-terrorism-eam-jaishankar/article69729197.ece
        # We want: kanishka-bombing-1985-stresses-need-for-zero-tolerance-to-terrorism-eam-jaishankar
        match = re.search(r'/(?P<slug>[^/]+)/article\d+\.ece$', link)
        if match:
            description = match.group('slug').replace('-', ' ').strip()
        else:
            # Fallback if the specific pattern isn't found, maybe use the title or a simpler part of the path
            logging.warning(f"Hindu National News Item {i+1}: Could not extract slug from link: {link}. Falling back to title for description.")
            description = title


        articles.append({
            'title': title,
            'link': link,
            'description': description, # Now populated from the link slug
            'image_url': image_url,
            'source': 'The Hindu',
            'publishedAt': published_date
        })
        logging.info(f"Hindu National News Item {count+1}: Added article: '{title}' Link: {link} Published At: {published_date}")
        count += 1

    return articles

if __name__ == '__main__':
    logging.info("Starting Hindu scraper...")
    scraped_articles = get_hindu_articles()
    logging.info(f"Scraped {len(scraped_articles)} articles from The Hindu National News.")

    # Print the scraped articles as JSON to standard output
    json.dump(scraped_articles, sys.stdout, indent=4, ensure_ascii=False)
    sys.stdout.flush()