export default function(eleventyConfig) {
  // Copy assets to output
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  // Date formatting filter
  eleventyConfig.addFilter("dateFormat", (dateObj) => {
    // Handle "now" keyword for current date
    const date = dateObj === "now" ? new Date() : new Date(dateObj);
    return date.toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  // Short date format
  eleventyConfig.addFilter("dateShort", (dateObj) => {
    const date = dateObj === "now" ? new Date() : new Date(dateObj);
    return date.toLocaleDateString('en-IE', {
      month: 'short',
      day: 'numeric'
    });
  });

  // ISO date format (for sitemaps, schema.org)
  eleventyConfig.addFilter("dateISO", (dateObj) => {
    const date = dateObj === "now" ? new Date() : new Date(dateObj);
    return date.toISOString().split('T')[0];
  });

  // Collection: All posts sorted by date (newest first)
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md").sort((a, b) => {
      return new Date(b.data.date) - new Date(a.data.date);
    });
  });

  // Collection: Latest 5 posts for homepage
  eleventyConfig.addCollection("latestPosts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md")
      .sort((a, b) => new Date(b.data.date) - new Date(a.data.date))
      .slice(0, 5);
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
}
