/**
 * Inishowen Peninsula Topic Discovery Pipeline
 *
 * Finds news topics and saves them for Claude Code to process.
 * Does NOT generate articles - that's done by the /process-pending skill.
 *
 * Sources:
 * - Google search for Inishowen news (default)
 * - Facebook pages (optional, use --facebook flag)
 */

import { discover } from './discover.js';

/**
 * Run the discovery pipeline
 */
async function runPipeline() {
  const includeFacebook = process.argv.includes('--facebook');

  console.log('='.repeat(50));
  console.log('INISHOWEN PENINSULA TOPIC DISCOVERY');
  console.log('='.repeat(50));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Sources: Google${includeFacebook ? ' + Facebook' : ''}\n`);

  let googleTopics = [];
  let facebookTopics = [];

  // Google discovery (always runs)
  console.log('Searching Google for Inishowen news...');
  console.log('-'.repeat(50));

  try {
    googleTopics = await discover();
  } catch (error) {
    console.error('Google discovery failed:', error.message);
  }

  // Facebook discovery (optional)
  if (includeFacebook) {
    console.log('\nChecking Facebook pages...');
    console.log('-'.repeat(50));

    try {
      const { discoverFromFacebook } = await import('./discover-facebook.js');
      facebookTopics = await discoverFromFacebook();
    } catch (error) {
      console.error('Facebook discovery failed:', error.message);
    }
  }

  const totalTopics = googleTopics.length + facebookTopics.length;

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('DISCOVERY COMPLETE');
  console.log('='.repeat(50));
  console.log(`Google: ${googleTopics.length} new topics`);
  if (includeFacebook) {
    console.log(`Facebook: ${facebookTopics.length} new topics`);
  }
  console.log(`Total: ${totalTopics} new topics`);
  console.log(`Completed at: ${new Date().toISOString()}`);

  if (totalTopics > 0) {
    console.log('\n📝 Topics saved to /pending-topics/');
    console.log('Run /process-pending in Claude Code to research and write articles.');
  } else {
    console.log('\nNo new topics found today.');
  }

  return {
    discovered: totalTopics,
    google: googleTopics.length,
    facebook: facebookTopics.length,
    topics: [...googleTopics, ...facebookTopics]
  };
}

// Run if called directly
runPipeline()
  .then(result => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Pipeline error:', error);
    process.exit(1);
  });
