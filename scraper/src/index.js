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

async function getCachedOrFetch(pageUrl, cacheFileName) {
  const cachePath = path.join(CACHE_DIR, cacheFileName);

  if (fs.existsSync(cachePath)) {
    const cachedHtml = fs.readFileSync(cachePath, 'utf8');
    return { html: cachedHtml, fromCache: true };
  }

  const html = await fetchWithTimeout(pageUrl, TIMEOUT_MS);
  fs.writeFileSync(cachePath, html, 'utf8');
  return { html, fromCache: false };
}

// 1. Discover product links from catalogue pages
function parseCataloguePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const bookUrls = [];

  $('article.product_pod').each((_, element) => {
    const relativeUrl = $(element).find('h3 a').attr('href');
    if (relativeUrl) {
      const fullUrl = new URL(relativeUrl, pageUrl).href;
      bookUrls.push(fullUrl);
    }
  });

  const nextRelUrl = $('li.next a').attr('href');
  const nextPageUrl = nextRelUrl ? new URL(nextRelUrl, pageUrl).href : null;

  return { bookUrls, nextPageUrl };
}

// 2. Extract detailed fields from an individual book detail HTML
function parseBookDetailPage(html, productUrl, sourcePageUrl) {
  const $ = cheerio.load(html);

  const title = $('div.product_main h1').text().trim();
  const rawPrice = $('div.product_main p.price_color').text().trim();
  const rawAvailability = $('div.product_main p.instock.availability').text().trim();

  // Extract Rating
  const ratingClass = $('div.product_main p.star-rating').attr('class') || '';
  const rawRating = ratingClass.replace('star-rating', '').trim();

  // Extract Description (located right after #product_description div header)
  const descriptionText = $('#product_description + p').text().trim();
  const description = descriptionText.length > 0 ? descriptionText : null;

  return {
    title,
    productUrl,
    rawPrice,
    rawAvailability,
    rawRating,
    description,
    sourcePageUrl,
    fetchedAt: new Date().toISOString(),
  };
}

async function run() {
  let currentCatalogueUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pageCount = 0;
  const discoveredBookUrls = [];

  console.log('--- STAGE 3: Discovering Book Links ---');
  while (currentCatalogueUrl && pageCount < MAX_PAGES) {
    pageCount++;
    const cacheFileName = `catalogue-page-${pageCount}.html`;

    const { html, fromCache } = await getCachedOrFetch(currentCatalogueUrl, cacheFileName);
    const { bookUrls, nextPageUrl } = parseCataloguePage(html, currentCatalogueUrl);

    discoveredBookUrls.push(...bookUrls);
    console.log(`Catalogue Page ${pageCount}: Found ${bookUrls.length} links.`);

    currentCatalogueUrl = nextPageUrl;

    if (currentCatalogueUrl && pageCount < MAX_PAGES && !fromCache) {
      await sleep(POLITENESS_DELAY_MS);
    }
  }

  console.log(`\n--- STAGE 4: Scraping ${discoveredBookUrls.length} Detail Pages ---`);
  const detailedBooks = [];

  for (let i = 0; i < discoveredBookUrls.length; i++) {
    const url = discoveredBookUrls[i];

    // Create a safe, unique cache filename from the URL slug
    const urlParts = url.split('/');
    const slug = urlParts[urlParts.length - 2] || `item-${i}`;
    const detailCacheFile = `detail-${slug}.html`;

    const { html, fromCache } = await getCachedOrFetch(url, detailCacheFile);
    const bookData = parseBookDetailPage(html, url, 'catalogue-page-1.html');
    detailedBooks.push(bookData);

    console.log(`[${i + 1}/${discoveredBookUrls.length}] ${fromCache ? 'CACHE' : 'FETCH'} | ${bookData.title}`);

    // Politeness delay between detail page network requests
    if (!fromCache && i < discoveredBookUrls.length - 1) {
      await sleep(POLITENESS_DELAY_MS);
    }
  }

  console.log(`\nSTAGE 4 COMPLETE: Successfully scraped details for ${detailedBooks.length} books.`);
  console.log('Sample Detailed Record:', JSON.stringify(detailedBooks[0], null, 2));
}

run().catch(console.error);