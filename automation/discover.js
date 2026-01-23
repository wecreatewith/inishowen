/**
 * Topic Discovery Script
 * Searches for news about Inishowen Peninsula and saves topics for manual processing
 *
 * This script finds potential topics but does NOT generate articles.
 * Topics are saved to /pending-topics/ for Claude Code to research and write.
 */

const SEARCH_QUERIES = [
  'Inishowen Peninsula news',
  'Inishowen Donegal',
  'Malin Head news',
  'Buncrana news Donegal',
  'Carndonagh news Donegal',
  'Moville news Donegal',
  'Ballyliffin Clonmany news',
  'Greencastle Donegal news',
  '"Wild Atlantic Way" Inishowen'
];

// Sources we recognise
const NEWS_SOURCES = [
  { name: 'Donegal Daily', domain: 'donegaldaily.com' },
  { name: 'Donegal Democrat', domain: 'donegaldemocrat.ie' },
  { name: 'Inishowen Independent', domain: 'inishowennews.com' },
  { name: 'Highland Radio', domain: 'highlandradio.com' },
  { name: 'Donegal County Council', domain: 'donegalcoco.ie' },
  { name: 'Donegal News', domain: 'donegalnews.com' },
  { name: 'RTE', domain: 'rte.ie' },
  { name: 'Irish Times', domain: 'irishtimes.com' },
  { name: 'Go Visit Inishowen', domain: 'govisitinishowen.com' },
  { name: 'Irish Independent', domain: 'independent.ie' }
];

/**
 * Search Google for Inishowen mentions using Apify
 */
async function searchGoogleNews(query, apiToken) {
  const APIFY_API_URL = 'https://api.apify.com/v2/acts/apify~rag-web-browser/runs';

  const response = await fetch(APIFY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      query: query,
      maxResults: 5,
      outputFormats: ['markdown']
    })
  });

  if (!response.ok) {
    throw new Error(`Apify API error: ${response.status}`);
  }

  const runData = await response.json();
  const runId = runData.data.id;

  // Wait for run to complete
  let status = 'RUNNING';
  let attempts = 0;
  const maxAttempts = 30;

  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );
    const statusData = await statusResponse.json();
    status = statusData.data.status;
    attempts++;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run failed with status: ${status}`);
  }

  // Get results from dataset (using actor-runs endpoint)
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
    { headers: { 'Authorization': `Bearer ${apiToken}` } }
  );

  const data = await datasetResponse.json();
  console.log(`Got ${Array.isArray(data) ? data.length : 0} results from Apify`);
  return data;
}

/**
 * Parse search results into structured topics
 */
function parseResults(results) {
  const topics = [];

  // Handle cases where results isn't an array
  if (!Array.isArray(results)) {
    console.log('Warning: results is not an array:', typeof results);
    return topics;
  }

  for (const result of results) {
    if (result.searchResult) {
      topics.push({
        title: result.searchResult.title || 'Untitled',
        url: result.searchResult.url,
        snippet: result.searchResult.description || '',
        source: extractSource(result.searchResult.url),
        discoveredAt: new Date().toISOString()
      });
    }
  }

  return topics;
}

/**
 * Extract source name from URL
 */
function extractSource(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const source = NEWS_SOURCES.find(s => hostname.includes(s.domain));
    return source ? source.name : hostname;
  } catch {
    return 'Unknown';
  }
}

/**
 * Check if URL is a tag/archive/category page (not a specific article)
 * These pages show old aggregated content and should be skipped
 */
function isTagOrArchivePage(url) {
  const skipPatterns = [
    /\/tag\//i,
    /\/tags\//i,
    /\/archive\//i,
    /\/archives\//i,
    /\/category\//i,
    /\/categories\//i,
    /\/topic\//i,
    /\/topics\//i,
    /\/search\?/i,
    /\/search\//i,
    /[?&]tag=/i,
    /[?&]category=/i,
    // Generic travel/listing sites (not news)
    /expedia\.com/i,
    /tripadvisor\.com/i,
    /booking\.com/i,
    /airbnb\.com/i,
    // Wikipedia (reference, not news)
    /wikipedia\.org/i,
    // Generic accommodation listings
    /accommodation.*listing/i,
    // Our own site (don't discover ourselves)
    /inishowenpeninsula\.com/i,
  ];

  return skipPatterns.some(pattern => pattern.test(url));
}

/**
 * Create a slug from a title
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Load previously processed URLs to avoid duplicates
 */
async function loadProcessedUrls(filePath) {
  const fs = await import('fs/promises');
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return new Set(JSON.parse(data));
  } catch {
    return new Set();
  }
}

/**
 * Save processed URLs
 */
async function saveProcessedUrls(filePath, urls) {
  const fs = await import('fs/promises');
  await fs.writeFile(filePath, JSON.stringify([...urls], null, 2));
}

/**
 * Save a topic as a pending markdown file
 */
async function saveTopicFile(topic, pendingDir) {
  const fs = await import('fs/promises');
  const path = await import('path');

  const date = new Date().toISOString().split('T')[0];
  const slug = slugify(topic.title);
  const filename = `${date}-${slug}.md`;
  const filepath = path.join(pendingDir, filename);

  const content = `---
title: "${topic.title.replace(/"/g, '\\"')}"
url: "${topic.url}"
source: "${topic.source}"
discovered: "${topic.discoveredAt}"
status: pending
---

## Source

- **Title:** ${topic.title}
- **URL:** ${topic.url}
- **Source:** ${topic.source}

## Snippet

${topic.snippet}

## Instructions for Claude Code

When processing this topic:

1. Research this topic using multiple searches (not just this one URL)
2. Find 3-5 additional sources covering the same story/topic
3. Synthesize information from ALL sources
4. Write a comprehensive, original article
5. Include relevant local context for Inishowen Peninsula
6. Add outbound links to authoritative sources
7. Structure with proper headings (H2, H3) and possibly FAQs
8. Save to /src/posts/ or /src/guides/ as appropriate

Do NOT just rewrite this single source. Research thoroughly first.
`;

  await fs.writeFile(filepath, content);
  console.log(`Saved topic: ${filename}`);

  return filepath;
}

/**
 * Main discovery function
 */
async function discover() {
  const fs = await import('fs/promises');
  const path = await import('path');

  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN environment variable required');
  }

  // Setup directories
  const dataDir = path.join(process.cwd(), 'automation', 'data');
  const pendingDir = path.join(process.cwd(), 'pending-topics');

  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(pendingDir, { recursive: true });

  const processedFile = path.join(dataDir, 'processed-urls.json');
  const processedUrls = await loadProcessedUrls(processedFile);

  console.log(`Loaded ${processedUrls.size} previously processed URLs`);

  const allTopics = [];

  for (const query of SEARCH_QUERIES) {
    console.log(`Searching: ${query}`);
    try {
      const results = await searchGoogleNews(query, APIFY_TOKEN);
      const parsed = parseResults(results);

      // Filter out already processed AND tag/archive pages
      const newTopics = parsed.filter(topic => {
        if (processedUrls.has(topic.url)) return false;
        if (isTagOrArchivePage(topic.url)) {
          console.log(`  Skipping tag/archive page: ${topic.url}`);
          return false;
        }
        return true;
      });
      allTopics.push(...newTopics);

      console.log(`Found ${parsed.length} results, ${newTopics.length} new (after filtering)`);
    } catch (error) {
      console.error(`Error searching "${query}":`, error.message);
    }
  }

  // Deduplicate by URL
  const uniqueTopics = [...new Map(allTopics.map(t => [t.url, t])).values()];

  // Save each topic as a pending file
  const savedTopics = [];
  for (const topic of uniqueTopics) {
    try {
      const filepath = await saveTopicFile(topic, pendingDir);
      savedTopics.push({ ...topic, filepath });

      // Mark URL as processed so we don't discover it again
      processedUrls.add(topic.url);
    } catch (error) {
      console.error(`Failed to save topic "${topic.title}":`, error.message);
    }
  }

  // Update processed URLs
  await saveProcessedUrls(processedFile, processedUrls);

  console.log(`\nDiscovered ${savedTopics.length} new topics`);
  console.log(`Saved to: ${pendingDir}`);

  return savedTopics;
}

// Run if called directly
if (process.argv[1].endsWith('discover.js')) {
  discover()
    .then(topics => {
      console.log('\nDiscovery complete!');
      if (topics.length > 0) {
        console.log('\nPending topics ready for processing with Claude Code.');
        console.log('Run /process-pending in Claude Code to research and write articles.');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Discovery failed:', error);
      process.exit(1);
    });
}

export { discover, searchGoogleNews, parseResults };
