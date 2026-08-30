import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../cache');
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/your-username/repo)';
const TIMEOUT_MS = 5000;
const POLITENESS_DELAY_MS = 500;
const MAX_PAGES = 3;

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Helper: Sleep function for polite rate-limiting
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    return { html: cachedHtml, fromCache: true };
  }

  const html = await fetchWithTimeout(pageUrl, TIMEOUT_MS);
  fs.writeFileSync(cachePath, html, 'utf8');
  console.log(`FETCH | File: ${cacheFileName}`);
  return { html, fromCache: false };
}

function parseCataloguePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const books = [];

  $('article.product_pod').each((_, element) => {
    const $el = $(element);
    const $link = $el.find('h3 a');
    const title = $link.attr('title') || $link.text().trim();
    const relativeUrl = $link.attr('href');
    const productUrl = new URL(relativeUrl, pageUrl).href;

    const rawPrice = $el.find('.price_color').text().trim();
    const rawAvailability = $el.find('.instock.availability').text().trim();
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

  // Extract "Next" pagination link if present
  const nextRelUrl = $('li.next a').attr('href');
  const nextPageUrl = nextRelUrl ? new URL(nextRelUrl, pageUrl).href : null;

  return { books, nextPageUrl };
}

async function run() {
  let currentUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pageCount = 0;
  const allDiscoveredBooks = [];

  while (currentUrl && pageCount < MAX_PAGES) {
    pageCount++;
    const cacheFileName = `catalogue-page-${pageCount}.html`;

    const { html, fromCache } = await getCataloguePage(currentUrl, cacheFileName);
    const { books, nextPageUrl } = parseCataloguePage(html, currentUrl);

    allDiscoveredBooks.push(...books);
    console.log(`Page ${pageCount}: Found ${books.length} books.`);

    currentUrl = nextPageUrl;

    // Apply politeness delay only if making a live network request for the next page
    if (currentUrl && pageCount < MAX_PAGES && !fromCache) {
      console.log(`Pausing ${POLITENESS_DELAY_MS}ms for politeness...`);
      await sleep(POLITENESS_DELAY_MS);
    }
  }

  console.log(`\nCRAWL COMPLETE: Discovered ${allDiscoveredBooks.length} total book listings across ${pageCount} pages.`);
}

run().catch(console.error);