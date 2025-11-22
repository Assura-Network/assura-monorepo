const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 3000;

app.use(express.json());

// Scrape README from GitHub repository
app.get('/scrape-readme', async (req, res) => {
  try {
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Missing required parameters',
        usage: '/scrape-readme?owner=username&repo=repository'
      });
    }

    // GitHub repository URL
    const url = `https://github.com/${owner}/${repo}`;

    // Fetch the HTML page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Load HTML into cheerio
    const $ = cheerio.load(response.data);

    // Find the README content - GitHub uses article tag with specific data attribute
    const readmeContent = $('article[itemprop="text"]').html();

    if (!readmeContent) {
      return res.status(404).json({
        error: 'README not found',
        message: 'The repository may not have a README file or it may be private'
      });
    }

    // Extract addresses from the README
    const addresses = [];
    $('article[itemprop="text"] code').each((i, el) => {
      const text = $(el).text().trim();
      // Check if it's an Ethereum address (0x followed by 40 hex characters)
      if (/^0x[a-fA-F0-9]{40}$/.test(text)) {
        // Find the entity name (text after the em dash)
        const parent = $(el).parent();
        const fullText = parent.text();
        const parts = fullText.split('—');
        const entity = parts.length > 1 ? parts[1].trim() : 'Unknown';
        
        addresses.push({
          address: text,
          entity: entity
        });
      }
    });

    res.json({
      success: true,
      repository: `${owner}/${repo}`,
      url: url,
      totalAddresses: addresses.length,
      addresses: addresses
    });

  } catch (error) {
    console.error('Scraping error:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Repository not found',
        message: 'The repository does not exist or is private'
      });
    }

    res.status(500).json({
      error: 'Failed to scrape README',
      message: error.message
    });
  }
});

// Alternative endpoint using direct path
app.get('/scrape-readme-direct', async (req, res) => {
  try {
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Missing required parameters',
        usage: '/scrape-readme-direct?owner=username&repo=repository'
      });
    }

    // Try common README filenames
    const readmeFiles = ['README.md', 'readme.md', 'README', 'Readme.md'];
    let content = null;

    for (const filename of readmeFiles) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filename}`;
        const response = await axios.get(rawUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        content = response.data;
        break;
      } catch (err) {
        // Try master branch if main fails
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${filename}`;
          const response = await axios.get(rawUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          content = response.data;
          break;
        } catch (err2) {
          continue;
        }
      }
    }

    if (!content) {
      return res.status(404).json({
        error: 'README not found',
        message: 'Could not find README file in main or master branch'
      });
    }

    res.json({
      success: true,
      repository: `${owner}/${repo}`,
      readme: content
    });

  } catch (error) {
    console.error('Scraping error:', error.message);
    res.status(500).json({
      error: 'Failed to scrape README',
      message: error.message
    });
  }
});

// Scrape specific repository with URL
app.get('/scrape-url', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: 'Missing URL parameter',
        usage: '/scrape-url?url=https://github.com/owner/repo'
      });
    }

    // Extract owner and repo from URL
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return res.status(400).json({
        error: 'Invalid GitHub URL',
        message: 'URL must be in format: https://github.com/owner/repo'
      });
    }

    const [, owner, repo] = match;

    // Fetch the HTML page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Load HTML into cheerio
    const $ = cheerio.load(response.data);

    // Find the README content
    const readmeContent = $('article[itemprop="text"]').html();

    if (!readmeContent) {
      return res.status(404).json({
        error: 'README not found',
        message: 'The repository may not have a README file or it may be private'
      });
    }

    const readmeText = $('article[itemprop="text"]').text().trim();

    // Extract addresses from the README
    const addresses = [];
    $('article[itemprop="text"] code').each((i, el) => {
      const text = $(el).text().trim();
      // Check if it's an Ethereum address (0x followed by 40 hex characters)
      if (/^0x[a-fA-F0-9]{40}$/.test(text)) {
        // Find the entity name (text after the em dash)
        const parent = $(el).parent();
        const fullText = parent.text();
        const parts = fullText.split('—');
        const entity = parts.length > 1 ? parts[1].trim() : 'Unknown';
        
        addresses.push({
          address: text,
          entity: entity
        });
      }
    });

    res.json({
      success: true,
      repository: `${owner}/${repo}`,
      url: url,
      totalAddresses: addresses.length,
      addresses: addresses,
      readme: {
        html: readmeContent,
        text: readmeText
      }
    });

  } catch (error) {
    console.error('Scraping error:', error.message);
    res.status(500).json({
      error: 'Failed to scrape README',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'GitHub README Scraper API',
    endpoints: {
      '/scrape-readme': 'Scrape README from GitHub page (HTML)',
      '/scrape-readme-direct': 'Scrape README directly from raw GitHub (Markdown)',
      '/scrape-url': 'Scrape README by providing full GitHub URL'
    },
    usage: {
      example1: '/scrape-readme?owner=expressjs&repo=express',
      example2: '/scrape-readme-direct?owner=expressjs&repo=express',
      example3: '/scrape-url?url=https://github.com/ultrasoundmoney/ofac-ethereum-addresses'
    }
  });
});

app.listen(PORT, () => {
  console.log(`GitHub README Scraper running on http://localhost:${PORT}`);
  console.log(`\nExample usage:`);
  console.log(`  http://localhost:${PORT}/scrape-readme?owner=expressjs&repo=express`);
  console.log(`  http://localhost:${PORT}/scrape-readme-direct?owner=facebook&repo=react`);
  console.log(`  http://localhost:${PORT}/scrape-url?url=https://github.com/ultrasoundmoney/ofac-ethereum-addresses`);
});