import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../cache');
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/your-username/repo)';
const TIMEOUT_MS = 5000;

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.status !== 200) {
      throw new Error(`Failed to fetch ${url}. Status: ${response.status}`);
    }

    return await response.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function getCataloguePage(pageUrl, cacheFileName) {
  const cachePath = path.join(CACHE_DIR, cacheFileName);

  if (fs.existsSync(cachePath)) {
    const cachedHtml = fs.readFileSync(cachePath, 'utf8');
    console.log(`CACHE HIT | File: ${cacheFileName}`);
    return cachedHtml;
  }

  const html = await fetchWithTimeout(pageUrl, TIMEOUT_MS);
  fs.writeFileSync(cachePath, html, 'utf8');
  console.log(`FETCH | File: ${cacheFileName}`);
  return html;
}

// Extract raw book cards from a single catalogue HTML string
function parseCataloguePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const books = [];

  $('article.product_pod').each((_, element) => {
    const $el = $(element);

    // Extract Title & Link
    const $link = $el.find('h3 a');
    const title = $link.attr('title') || $link.text().trim();
    const relativeUrl = $link.attr('href');
    const productUrl = new URL(relativeUrl, pageUrl).href;

    // Extract Price & Availability
    const rawPrice = $el.find('.price_color').text().trim();
    const rawAvailability = $el.find('.instock.availability').text().trim();

    // Extract Star Rating from CSS class (e.g. "star-rating Three" -> "Three")
    const ratingClass = $el.find('.star-rating').attr('class') || '';
    const rawRating = ratingClass.replace('star-rating', '').trim();

    books.push({
      title,
      productUrl,
      rawPrice,
      rawAvailability,
      rawRating,
      sourcePageUrl: pageUrl,
      fetchedAt: new Date().toISOString(),
    });
  });

  return books;
}

async function run() {
  const targetUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  const html = await getCataloguePage(targetUrl, 'catalogue-page-1.html');
  
  const extractedBooks = parseCataloguePage(html, targetUrl);
  
  console.log(`\nSuccessfully extracted ${extractedBooks.length} books from Page 1!`);
  console.log('Sample Book Record:', JSON.stringify(extractedBooks[0], null, 2));
}

run().catch(console.error);