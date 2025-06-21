# Server/scrapers/content_scraper.py

import sys
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options as ChromeOptions
from bs4 import BeautifulSoup
import logging
import re # IMPORTRANT: Added for regular expressions

# Configure logging for better debugging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_webdriver():
    """Initializes and returns a headless Chrome WebDriver."""
    options = ChromeOptions()
    options.add_argument('--headless')          # Run in headless mode (no UI)
    options.add_argument('--no-sandbox')        # Required for running as root in some environments
    options.add_argument('--disable-dev-shm-usage') # Overcomes limited resource problems
    options.add_argument('--disable-gpu')       # Disables GPU hardware acceleration (often needed for headless)
    options.add_argument('--window-size=1920x1080') # Set a consistent window size
    # User-Agent to mimic a regular browser, helps avoid bot detection
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36')
    options.add_experimental_option('excludeSwitches', ['enable-logging']) # Suppress DevTools warnings

    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except Exception as e:
        logging.error(f"Error initializing WebDriver: {e}")
        raise

def extract_paragraphs(soup, selector):
    """Helper to find a container and extract all paragraphs from it."""
    container = soup.select_one(selector)
    if container:
        paragraphs = container.find_all('p')
        # Join paragraphs with double newline for better AI reading
        return '\n\n'.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
    return None

def scrape_article_content(url, source_name):
    """
    Scrapes the full article content from the given URL based on the source.
    Implements source-specific logic for content extraction.
    """
    driver = None # Initialize driver to None
    full_content = None # Initialize full_content to None

    try:
        if source_name == 'hindu':
            driver = get_webdriver()
            driver.get(url)
            logging.info(f"Successfully loaded URL for Hindu: {url}")
            driver.implicitly_wait(5)
            soup = BeautifulSoup(driver.page_source, 'html.parser')

            selectors = [
                'div.articlebodycontent',
                'div.story-element',
                'div[id^="content-body-"] .story-element',
                'div.content-wrapper .story-element',
                'div[itemprop="articleBody"]',
                'article[itemprop="articleBody"]',
                'div.article-content',
                'div#content-body',
                'div.article-text',
                'section.article-details .body'
            ]
            for selector in selectors:
                logging.info(f"Trying selector for Hindu: {selector}")
                full_content = extract_paragraphs(soup, selector)
                if full_content and len(full_content) > 100:
                    logging.info(f"Content found with selector: {selector}")
                    break
            
            if not full_content or len(full_content) < 50:
                logging.warning("No specific Hindu selector worked, trying more general approaches.")
                body_content = soup.find('article') or soup.find('div', class_='article-content') or soup.find('div', id='main-content') or soup.find('div', class_=re.compile(r'body|content', re.IGNORECASE))
                if body_content:
                    paragraphs = body_content.find_all('p')
                    full_content = '\n\n'.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
                    if full_content and len(full_content) > 50:
                        logging.info(f"Content found with general fallback for Hindu. Length: {len(full_content)}")
                    else:
                        full_content = None
            
            if not full_content:
                logging.error(f"Could not extract meaningful content for URL: {url} from source: Hindu (All selectors failed)")

        elif source_name == 'hindustan-times':
            logging.warning(f"Hindustan Times is marked as 'not free to scrap'. Attempting to extract title from URL slug for URL: {url}")
            
            try:
                path_segments = url.split('/')
                slug = ""
                for segment in reversed(path_segments):
                    if segment and (".html" in segment or re.match(r'^[a-zA-Z0-9_-]+$', segment)):
                        slug = segment.replace('.html', '')
                        break
                
                if slug:
                    slug = re.sub(r'-\d+$', '', slug)
                    title_from_slug = ' '.join([word.capitalize() for word in slug.split('-') if word])
                    
                    if title_from_slug.strip():
                        full_content = f"Article Title: {title_from_slug}"
                        logging.info(f"Successfully extracted title from URL for Hindustan Times: '{title_from_slug}'. This will be used as content.")
                    else:
                        full_content = None
                else:
                    full_content = None
                    
            except Exception as e:
                logging.error(f"Error extracting title from URL for Hindustan Times: {e}", exc_info=True)
                full_content = None
            
            if not full_content:
                logging.warning(f"Could not extract a meaningful title from URL for Hindustan Times: {url}. Returning no content.")

        elif source_name == 'toi':
            driver = get_webdriver()
            driver.get(url)
            logging.info(f"Successfully loaded URL for TOI: {url}")
            driver.implicitly_wait(5)
            soup = BeautifulSoup(driver.page_source, 'html.parser')

            article_text_parts = []
            full_content = None

            main_content_div = soup.select_one('div._s30J.clearfix')
            
            if main_content_div:
                logging.info("Found div._s30J.clearfix. Extracting content.")
                direct_text = main_content_div.get_text(separator='\n\n', strip=True)
                if direct_text and len(direct_text) > 50:
                    article_text_parts.append(direct_text)
                
                paragraphs = main_content_div.find_all('p')
                for p in paragraphs:
                    text = p.get_text(strip=True)
                    if text and "read full story" not in text.lower() and "continue reading" not in text.lower():
                        article_text_parts.append(text)

                if article_text_parts:
                    full_content = "\n\n".join(list(dict.fromkeys(article_text_parts)))
                    logging.info(f"Content extracted from div._s30J.clearfix. Length: {len(full_content)}")
            
            if not full_content or len(full_content) < 100:
                logging.warning("Primary TOI selector (div._s30J.clearfix) yielded insufficient content, trying fallbacks.")
                fallback_selectors = [
                    'div._3Mkg- article',
                    'div.Normal',
                    'div.body_content_container',
                    'div.arttext',
                    'div.article_content',
                    'div[data-articlebody]',
                    'div.article-full-content',
                    'div[itemprop="articleBody"]',
                    'section[role="main"]'
                ]
                for selector in fallback_selectors:
                    logging.info(f"Trying fallback selector for Times of India: {selector}")
                    content_from_fallback = extract_paragraphs(soup, selector)
                    if content_from_fallback and len(content_from_fallback) > 100:
                        full_content = content_from_fallback
                        logging.info(f"Content found with fallback selector: {selector}")
                        break
            
            if not full_content or not full_content.strip() or len(full_content) < 50:
                logging.error(f"Could not extract meaningful content for URL: {url} from source: toi (All selectors failed or too short)")
                full_content = None
        
        elif source_name == 'ie': # This is the block for Indian Express
            driver = get_webdriver()
            driver.get(url)
            logging.info(f"Applying Indian Express specific scraping logic for URL: {url}")
            driver.implicitly_wait(5)
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            
            article_text_parts = []
            full_content = None
            
            main_content_div = soup.select_one('div.full-details') or soup.select_one('div.ie-main-content') or soup.select_one('div.story-text')
            
            if main_content_div:
                logging.info("Found primary IE content div. Extracting content.")
                paragraphs = main_content_div.find_all('p')
                for p in paragraphs:
                    text = p.get_text(separator=' ', strip=True) 
                    excluded_phrases = [
                        "Also Read", "Latest News", "More From", "Join our Telegram channel",
                        "Click here to join our WhatsApp channel", "indian express", "express premium",
                        "for all the latest", "download the indian express app", "sign up for our",
                        "follow express"
                    ]
                    if text and not any(phrase.lower() in text.lower() for phrase in excluded_phrases):
                        article_text_parts.append(text)
                
                if article_text_parts:
                    full_content = "\n\n".join(article_text_parts)
                    logging.info(f"Content extracted from IE primary selector. Length: {len(full_content)}")
            
            if not full_content or len(full_content) < 100:
                logging.warning("Indian Express specific selector yielded insufficient content, trying broader fallbacks.")
                fallback_selectors = [
                    'div.article-content',
                    'div[itemprop="articleBody"]',
                    'article',
                    'div.story-content'
                ]
                for selector in fallback_selectors:
                    content_from_fallback = extract_paragraphs(soup, selector)
                    if content_from_fallback and len(content_from_fallback) > 100:
                        full_content = content_from_fallback
                        logging.info(f"Content found with IE fallback selector: {selector}. Length: {len(full_content)}")
                        break

            if not full_content or not full_content.strip() or len(full_content) < 50:
                logging.error(f"Could not extract meaningful content for URL: {url} from source: ie (All selectors failed or too short)")
                full_content = None
        
        elif source_name == 'dna': # This is the block for DNA India
            driver = get_webdriver()
            driver.get(url)
            logging.info(f"Applying DNA India specific scraping logic for URL: {url}")
            driver.implicitly_wait(5)
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            
            article_text_parts = []
            full_content = None

            main_content_div = soup.select_one('div.article-description') or soup.select_one('div.article-content-wrapper') or soup.select_one('div#article-details')
            
            if main_content_div:
                logging.info("Found primary DNA content div. Extracting content.")
                paragraphs = main_content_div.find_all('p')
                for p in paragraphs:
                    text = p.get_text(separator=' ', strip=True) 
                    excluded_phrases = [
                        "Also Read", "More From", "DNA Web Team", "Disclaimer",
                        "for more such content", "follow us on", "read the full story",
                        "download the app", "share on whatsapp"
                    ]
                    if text and not any(phrase.lower() in text.lower() for phrase in excluded_phrases):
                        article_text_parts.append(text)
                
                if article_text_parts:
                    full_content = "\n\n".join(article_text_parts)
                    logging.info(f"Content extracted from DNA primary selector. Length: {len(full_content)}")
            
            if not full_content or len(full_content) < 100:
                logging.warning("DNA India specific selector yielded insufficient content, trying broader fallbacks.")
                fallback_selectors = [
                    'div.story_content_area',
                    'div.article-detail-inner',
                    'div.article-body-container',
                    'div[itemprop="articleBody"]',
                    'article'
                ]
                for selector in fallback_selectors:
                    content_from_fallback = extract_paragraphs(soup, selector)
                    if content_from_fallback and len(content_from_fallback) > 100:
                        full_content = content_from_fallback
                        logging.info(f"Content found with DNA fallback selector: {selector}. Length: {len(full_content)}")
                        break

            if not full_content or not full_content.strip() or len(full_content) < 50:
                logging.error(f"Could not extract meaningful content for URL: {url} from source: dna (All selectors failed or too short)")
                full_content = None
            
        # Final check for full_content after all source-specific logic
        if not full_content or not full_content.strip():
            logging.error(f"Failed to extract any content for URL: {url} from source: {source_name}. Content was empty or extraction strategy yielded nothing.")
            return None # Explicitly return None if no content found
        
        return full_content

    except Exception as e:
        logging.error(f"An error occurred during scraping for {url}: {e}", exc_info=True)
        return None
    finally:
        if driver: # Ensure driver is quit only if it was initialized
            driver.quit()

if __name__ == '__main__':
    # This block runs when the script is executed directly (e.g., by Node.js child_process)
    if len(sys.argv) < 3:
        sys.stderr.write(json.dumps({'error': 'Usage: python content_scraper.py <url> <source_name>'}))
        sys.exit(1)
    
    article_url = sys.argv[1]
    article_source = sys.argv[2]
    
    try:
        content = scrape_article_content(article_url, article_source)
        sys.stdout.reconfigure(encoding='utf-8') 
        if content:
            sys.stdout.write(json.dumps({'content': content}))
        else:
            sys.stderr.write(json.dumps({'error': 'Failed to scrape article content or content was empty.'}))
            sys.exit(1)
    except Exception as e:
        sys.stderr.write(json.dumps({'error': str(e)}))
        sys.exit(1)