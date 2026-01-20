/**
 * Facebook Page Discovery Script
 * Monitors local Facebook pages for community news and events
 *
 * Pages monitored:
 * - Fahan, Inch & Burt Parish (community page)
 * - Inch Hall (community centre)
 *
 * This script finds potential topics from Facebook but does NOT generate articles.
 * Topics are saved to /pending-topics/ for Claude Code to research and write.
 *
 * Uses the official Apify Facebook Posts Scraper (apify/facebook-posts-scraper)
 * which is more reliable than alternatives.
 */

// Facebook pages to monitor (using URLs for the official Apify scraper)
const FACEBOOK_PAGES = [
  {
    name: 'Fahan, Inch & Burt Parish',
    url: 'https://www.facebook.com/fahaninchburt/'
  },
  {
    name: 'Inch Hall',
    url: 'https://www.facebook.com/profile.php?id=100064494500939'
  }
];

/**
 * Scrape recent posts from a Facebook page using official Apify scraper
 */
async function scrapeFacebookPage(pageUrl, apiToken, maxResults = 10) {
  const APIFY_API_URL = 'https://api.apify.com/v2/acts/apify~facebook-posts-scraper/runs';

  const response = await fetch(APIFY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      startUrls: [{ url: pageUrl }],
      resultsLimit: maxResults,
      onlyPostsNewerThan: '30 days'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apify API error: ${response.status} - ${errorText}`);
  }

  const runData = await response.json();
  const runId = runData.data.id;

  // Wait for run to complete
  let status = 'RUNNING';
  let attempts = 0;
  const maxAttempts = 60; // Facebook scraping can take longer

  while ((status === 'RUNNING' || status === 'READY') && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 3000));

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

  // Get results from dataset (using actor-runs endpoint, not acts endpoint)
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
    { headers: { 'Authorization': `Bearer ${apiToken}` } }
  );

  const data = await datasetResponse.json();

  // Debug: log what we actually got
  console.log('  Dataset response status:', datasetResponse.status);
  console.log('  Dataset response type:', typeof data);
  if (typeof data === 'object' && !Array.isArray(data)) {
    console.log('  Dataset response keys:', Object.keys(data));
    // Check if data is wrapped in a container
    if (data.items && Array.isArray(data.items)) {
      console.log('  Found items array in response');
      return data.items;
    }
    if (data.data && Array.isArray(data.data)) {
      console.log('  Found data array in response');
      return data.data;
    }
  }

  // Ensure we return an array
  if (!Array.isArray(data)) {
    console.log('Warning: Facebook response is not an array:', typeof data);
    console.log('  Response preview:', JSON.stringify(data).slice(0, 500));
    return [];
  }

  return data;
}

/**
 * Parse Facebook posts into topics
 * Handles response format from apify/facebook-posts-scraper
 */
function parseFacebookPosts(posts, pageName, pageUrl) {
  const topics = [];

  // Ensure posts is iterable
  if (!Array.isArray(posts)) {
    console.log('Warning: posts is not an array in parseFacebookPosts');
    return topics;
  }

  for (const post of posts) {
    // Extract content - check main post text first, then shared post text
    let content = post.text || post.postText || post.message || '';

    // For shared posts, also include the shared content if main text is short
    if (post.sharedPost && post.sharedPost.text) {
      if (content.length < 50) {
        // Short intro + shared content
        content = content + '\n\n[Shared post]:\n' + post.sharedPost.text;
      }
    }

    // Skip posts without meaningful content
    if (!content || content.length < 20) continue;

    // Create a title from the first line or first 80 chars
    const firstLine = content.split('\n')[0];
    const title = firstLine.length > 80
      ? firstLine.slice(0, 77) + '...'
      : firstLine;

    // Extract URL - try multiple possible field names
    const postUrl = post.url || post.postUrl || post.postLink || pageUrl;

    // Extract date - prefer ISO time, fall back to timestamp
    const postDate = post.time || post.date ||
      (post.timestamp ? new Date(post.timestamp * 1000).toISOString() : null);

    topics.push({
      title: title,
      url: postUrl,
      snippet: content.slice(0, 500), // Increased from 300 for shared posts
      source: `Facebook: ${pageName}`,
      sourceType: 'facebook',
      discoveredAt: new Date().toISOString(),
      postDate: postDate
    });
  }

  return topics;
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
 * Create a content fingerprint for deduplication
 * This catches reshares of the same content with different URLs
 */
function createContentFingerprint(text) {
  if (!text) return null;
  // Normalize: lowercase, remove extra whitespace, take first 150 chars
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  // Create a simple hash-like string
  return `content:${normalized}`;
}

/**
 * Load previously processed URLs/posts to avoid duplicates
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
 * Save a Facebook topic as a pending markdown file
 */
async function saveTopicFile(topic, pendingDir) {
  const fs = await import('fs/promises');
  const path = await import('path');

  const date = new Date().toISOString().split('T')[0];
  const slug = slugify(topic.title);
  const filename = `${date}-fb-${slug}.md`;
  const filepath = path.join(pendingDir, filename);

  const content = `---
title: "${topic.title.replace(/"/g, '\\"')}"
url: "${topic.url}"
source: "${topic.source}"
sourceType: facebook
discovered: "${topic.discoveredAt}"
postDate: "${topic.postDate || 'unknown'}"
status: pending
---

## Facebook Post

- **Source:** ${topic.source}
- **URL:** ${topic.url}
- **Posted:** ${topic.postDate || 'Unknown date'}

## Content

${topic.snippet}

## Instructions for Claude Code

This topic was discovered from a local Facebook page. When processing:

1. This is a TIP, not a source to copy - use it to discover what's happening locally
2. Research the topic using additional sources (Google, official sites, etc.)
3. If it's an event, find official event details
4. If it's news, find 2-3 additional sources covering the story
5. Write original content that adds value beyond the Facebook post
6. Link back to the Facebook page as one source among several
7. Save to /src/posts/ for news or /src/guides/ for evergreen content

IMPORTANT: Do NOT just rewrite the Facebook post. Use it as a starting point for proper research.

## Suggested approach

- "The [Page Name] Facebook page shared news about [topic]. Here's what we found..."
- Link to the Facebook post as one source
- Add context, background, and additional information from research
`;

  await fs.writeFile(filepath, content);
  console.log(`Saved Facebook topic: ${filename}`);

  return filepath;
}

/**
 * Main Facebook discovery function
 */
async function discoverFromFacebook() {
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

  const processedFile = path.join(dataDir, 'processed-facebook.json');
  const processedUrls = await loadProcessedUrls(processedFile);

  console.log(`Loaded ${processedUrls.size} previously processed Facebook posts`);

  const allTopics = [];

  for (const page of FACEBOOK_PAGES) {
    console.log(`Checking Facebook page: ${page.name}`);
    console.log(`  URL: ${page.url}`);
    try {
      const posts = await scrapeFacebookPage(page.url, APIFY_TOKEN, 10);
      console.log(`  Received ${posts.length} posts from scraper`);

      const parsed = parseFacebookPosts(posts, page.name, page.url);
      console.log(`  Parsed ${parsed.length} posts with content`);

      // Filter out already processed (by URL AND content fingerprint)
      const newTopics = parsed.filter(topic => {
        // Check URL
        if (topic.url && processedUrls.has(topic.url)) {
          return false;
        }
        // Check content fingerprint (catches reshares with different URLs)
        const fingerprint = createContentFingerprint(topic.snippet);
        if (fingerprint && processedUrls.has(fingerprint)) {
          console.log(`  Skipping duplicate content (reshare): ${topic.title.slice(0, 50)}...`);
          return false;
        }
        return true;
      });

      allTopics.push(...newTopics);
      console.log(`  New topics: ${newTopics.length}`);

      // Mark as processed (both URL and content fingerprint)
      for (const topic of parsed) {
        if (topic.url) {
          processedUrls.add(topic.url);
        }
        const fingerprint = createContentFingerprint(topic.snippet);
        if (fingerprint) {
          processedUrls.add(fingerprint);
        }
      }
    } catch (error) {
      console.error(`Error checking "${page.name}":`, error.message);
    }
  }

  // Save each topic as a pending file
  const savedTopics = [];
  for (const topic of allTopics) {
    try {
      const filepath = await saveTopicFile(topic, pendingDir);
      savedTopics.push({ ...topic, filepath });
    } catch (error) {
      console.error(`Failed to save topic "${topic.title}":`, error.message);
    }
  }

  // Update processed URLs
  await saveProcessedUrls(processedFile, processedUrls);

  console.log(`\nDiscovered ${savedTopics.length} new Facebook topics`);

  return savedTopics;
}

// Run if called directly
if (process.argv[1].endsWith('discover-facebook.js')) {
  discoverFromFacebook()
    .then(topics => {
      console.log('\nFacebook discovery complete!');
      if (topics.length > 0) {
        console.log('\nPending topics ready for processing with Claude Code.');
        console.log('Run /process-pending in Claude Code to research and write articles.');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Facebook discovery failed:', error);
      process.exit(1);
    });
}

export { discoverFromFacebook, FACEBOOK_PAGES };
