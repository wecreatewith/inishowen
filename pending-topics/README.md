# Pending Topics

This folder contains topics discovered by the daily automation that need to be researched and written up.

## How It Works

1. **Daily at 6am UTC:** GitHub Actions runs topic discovery
2. **Topics saved here:** Each topic becomes a markdown file with source info and instructions
3. **You run `/process-pending`:** Claude Code researches each topic and writes comprehensive articles
4. **Articles published:** Saved to `/src/posts/` or `/src/guides/`, committed, and deployed

## Processing Topics

In Claude Code, run:

```
/process-pending
```

This will:
- Pull latest from GitHub (to get any new topics)
- Read each pending topic file
- Research 3-5+ sources for each topic
- Write comprehensive, original articles
- Save articles and delete processed topic files
- Commit and push everything

## Manual Discovery

You can also trigger discovery manually:
1. Go to GitHub Actions
2. Click "Daily Topic Discovery"
3. Click "Run workflow"

Or locally:
```bash
cd /path/to/site
export APIFY_TOKEN="your-token"
node automation/pipeline.js
```
