const fs = require('fs');
const readline = require('readline');
const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const seedsFile = 'seeds.txt';
const visitedFile = 'visited.txt';
const maxDepth = 10; // Limit recursion depth
const maxConcurrentPages = 5; // Number of parallel pages

puppeteerExtra.use(StealthPlugin());

// Load visited URLs into a Set
async function loadVisited(filePath) {
    const visited = new Set();
    if (fs.existsSync(filePath)) {
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
        for await (const line of rl) {
            if (line.trim()) visited.add(line.trim());
        }
    }
    return visited;
}

// Batch write to file for performance
async function saveVisited(urls) {
    fs.appendFile(visitedFile, urls.join("\n") + "\n", err => {
        if (err) console.error(`Error writing URLs:`, err);
    });
}

// Extract all links from a page (same domain only)
async function getLinks(page, baseUrl) {
    return await page.$$eval('a', (anchors, base) => {
        return anchors
            .map(a => a.href)
            .filter(link => link.startsWith(base)); // Only keep links within the same domain
    }, baseUrl);
}

// Crawling function with parallelization
async function crawl(urls, visitedSet, browser, depth = 0) {
    if (depth > maxDepth || urls.length === 0) return;

    console.log(`Crawling ${urls.length} pages at depth ${depth}...`);

    // Process URLs in parallel using "maxConcurrentPages"
    const tasks = urls.slice(0, maxConcurrentPages).map(async (url) => {
        if (visitedSet.has(url)) return;

        visitedSet.add(url);
        console.log(`Crawling: ${url}`);

        const page = await browser.newPage();
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Extract links within the same domain
            const baseUrl = new URL(url).origin;
            const links = await getLinks(page, baseUrl);

            await page.close();
            return links;
        } catch (err) {
            console.error(`Error on ${url}:`, err.message);
            await page.close();
            return [];
        }
    });

    // Collect new links
    const newLinks = (await Promise.all(tasks)).flat();
    await saveVisited(urls); // Batch save visited URLs

    // Continue crawling recursively
    await crawl(newLinks.filter(link => !visitedSet.has(link)), visitedSet, browser, depth + 1);
}

// Start the crawler
(async () => {
    const visitedSet = await loadVisited(visitedFile);

    // Read seed URLs from file
    const seeds = fs.existsSync(seedsFile) ? fs.readFileSync(seedsFile, 'utf-8').split('\n').map(url => url.trim()).filter(Boolean) : [];
    console.log(`Starting with ${seeds.length} seed URLs`);

    //const browser = await puppeteer.launch({ headless: true });
    const browser = await puppeteerExtra.launch({ headless: true });

    await crawl(seeds, visitedSet, browser);

    await browser.close();
})();
