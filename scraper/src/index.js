import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { z } from 'zod';

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

// Zod Schema Guard for Clean Book Record
const BookSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  productUrl: z.string().url('Invalid product URL'),
  price: z.number().positive('Price must be greater than 0'),
  available: z.boolean(),
  rating: z.number().min(1).max(5),
  description: z.string().nullable(),
  sourcePageUrl: z.string().url('Invalid source page URL'),
  fetchedAt: z.string().datetime('Must be valid ISO timestamp'),
});

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

// Map rating words to numeric numbers
function parseRating(ratingString) {
  const map = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };
  return map[ratingString] || 0;
}

// Normalize raw extracted fields into typed variables
function parseBookDetailPage(html, productUrl, sourcePageUrl) {
  const $ = cheerio.load(html);

  const title = $('div.product_main h1').text().trim();
  const rawPrice = $('div.product_main p.price_color').text().trim();
  const rawAvailability = $('div.product_main p.instock.availability').text().trim();
  const ratingClass = $('div.product_main p.star-rating').attr('class') || '';
  const rawRating = ratingClass.replace('star-rating', '').trim();
  const descriptionText = $('#product_description + p').text().trim();

  // Data Normalization
  const cleanedPriceStr = rawPrice.replace(/[^0-9.]/g, '');
  const price = parseFloat(cleanedPriceStr);
  const available = rawAvailability.toLowerCase().includes('in stock');
  const rating = parseRating(rawRating);
  const description = descriptionText.length > 0 ? descriptionText : null;

  return {
    title,
    productUrl,
    price,
    available,
    rating,
    description,
    sourcePageUrl,
    fetchedAt: new Date().toISOString(),
  };
}

async function run() {
  let currentCatalogueUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pageCount = 0;
  const discoveredBookUrls = [];

  while (currentCatalogueUrl && pageCount < MAX_PAGES) {
    pageCount++;
    const cacheFileName = `catalogue-page-${pageCount}.html`;

    const { html, fromCache } = await getCachedOrFetch(currentCatalogueUrl, cacheFileName);
    const { bookUrls, nextPageUrl } = parseCataloguePage(html, currentCatalogueUrl);

    discoveredBookUrls.push(...bookUrls);
    currentCatalogueUrl = nextPageUrl;

    if (currentCatalogueUrl && pageCount < MAX_PAGES && !fromCache) {
      await sleep(POLITENESS_DELAY_MS);
    }
  }

  const validBooks = [];
  const invalidRecords = [];

  for (let i = 0; i < discoveredBookUrls.length; i++) {
    const url = discoveredBookUrls[i];
    const urlParts = url.split('/');
    const slug = urlParts[urlParts.length - 2] || `item-${i}`;
    const detailCacheFile = `detail-${slug}.html`;

    const { html, fromCache } = await getCachedOrFetch(url, detailCacheFile);
    const rawRecord = parseBookDetailPage(html, url, 'https://books.toscrape.com/catalogue/page-1.html');

    // Perform Schema Validation
    const validationResult = BookSchema.safeParse(rawRecord);

    if (validationResult.success) {
      validBooks.push(validationResult.data);
    } else {
      invalidRecords.push({
        record: rawRecord,
        error: validationResult.error.format(),
      });
    }

    if (!fromCache && i < discoveredBookUrls.length - 1) {
      await sleep(POLITENESS_DELAY_MS);
    }
  }

  console.log(`\nSTAGE 5 COMPLETE: Validation Summary`);
  console.log(`- Total Scraped: ${discoveredBookUrls.length}`);
  console.log(`- Valid Records: ${validBooks.length}`);
  console.log(`- Invalid Records: ${invalidRecords.length}`);

  if (validBooks.length > 0) {
    console.log('\nSample Normalized & Validated Record:');
    console.log(JSON.stringify(validBooks[0], null, 2));
  }
}

run().catch(console.error);