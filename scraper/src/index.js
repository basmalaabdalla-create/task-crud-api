import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import * as cheerio from 'cheerio';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../cache');
const OUTPUT_DIR = path.join(__dirname, '../output');

const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/your-username/repo)';
const TIMEOUT_MS = 5000;
const POLITENESS_DELAY_MS = 500;
const MAX_PAGES = 3;

// Ensure output and cache directories exist
[CACHE_DIR, OUTPUT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Zod Schema Guard
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

// Telemetry counters for run report
const metrics = {
  cataloguePagesCrawled: 0,
  detailPagesScraped: 0,
  cacheHits: 0,
  networkFetches: 0,
};

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
    metrics.cacheHits++;
    const cachedHtml = fs.readFileSync(cachePath, 'utf8');
    return { html: cachedHtml, fromCache: true };
  }

  metrics.networkFetches++;
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

function parseRating(ratingString) {
  const map = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };
  return map[ratingString] || 0;
}

function parseBookDetailPage(html, productUrl, sourcePageUrl) {
  const $ = cheerio.load(html);

  const title = $('div.product_main h1').text().trim();
  const rawPrice = $('div.product_main p.price_color').text().trim();
  const rawAvailability = $('div.product_main p.instock.availability').text().trim();
  const ratingClass = $('div.product_main p.star-rating').attr('class') || '';
  const rawRating = ratingClass.replace('star-rating', '').trim();
  const descriptionText = $('#product_description + p').text().trim();

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
  const startTime = performance.now();
  const runTimestamp = new Date().toISOString();

  let currentCatalogueUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pageCount = 0;
  const discoveredBookUrls = [];

  console.log('--- STARTING SCRAPER ENGINE ---');

  // Step 1: Link Discovery
  while (currentCatalogueUrl && pageCount < MAX_PAGES) {
    pageCount++;
    metrics.cataloguePagesCrawled++;
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

  // Step 2: Detail Scraping & Parsing
  for (let i = 0; i < discoveredBookUrls.length; i++) {
    const url = discoveredBookUrls[i];
    metrics.detailPagesScraped++;

    const urlParts = url.split('/');
    const slug = urlParts[urlParts.length - 2] || `item-${i}`;
    const detailCacheFile = `detail-${slug}.html`;

    const { html, fromCache } = await getCachedOrFetch(url, detailCacheFile);
    const rawRecord = parseBookDetailPage(html, url, 'https://books.toscrape.com/catalogue/page-1.html');

    // Step 3: Schema Validation
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

  const endTime = performance.now();
  const durationMs = Math.round(endTime - startTime);

  // Step 4: Write Output Files
  const booksPath = path.join(OUTPUT_DIR, 'books.json');
  fs.writeFileSync(booksPath, JSON.stringify(validBooks, null, 2), 'utf8');

  if (invalidRecords.length > 0) {
    const errorsPath = path.join(OUTPUT_DIR, 'errors.json');
    fs.writeFileSync(errorsPath, JSON.stringify(invalidRecords, null, 2), 'utf8');
  }

  const runReport = {
    runAt: runTimestamp,
    durationMs,
    metrics: {
      cataloguePagesCrawled: metrics.cataloguePagesCrawled,
      detailPagesScraped: metrics.detailPagesScraped,
      totalDiscoveredLinks: discoveredBookUrls.length,
      cacheHits: metrics.cacheHits,
      networkFetches: metrics.networkFetches,
    },
    quality: {
      totalProcessed: discoveredBookUrls.length,
      validRecords: validBooks.length,
      invalidRecords: invalidRecords.length,
      successRate: `${((validBooks.length / discoveredBookUrls.length) * 100).toFixed(1)}%`,
    },
    outputFiles: {
      books: 'output/books.json',
      report: 'output/run-report.json',
      errors: invalidRecords.length > 0 ? 'output/errors.json' : null,
    },
  };

  const reportPath = path.join(OUTPUT_DIR, 'run-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(runReport, null, 2), 'utf8');

  console.log(`\n========================================`);
  console.log(` SCRAPER COMPLETED SUCCESSFULLY`);
  console.log(`========================================`);
  console.log(`- Duration: ${durationMs} ms`);
  console.log(`- Books Saved: ${validBooks.length} items -> output/books.json`);
  console.log(`- Execution Report: output/run-report.json`);
  console.log(`========================================\n`);
}

run().catch(console.error);