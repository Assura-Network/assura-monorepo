const https = require('https');
const fs = require('fs');

// Convert GitHub URL to raw content URL
const githubUrl = 'https://github.com/Assura-Network/assura-monorepo/blob/main/tee/scrapper/addresses.json';
const rawUrl = githubUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
const localFile = './addresses.json';

// Function to fetch with retry logic
function fetchWithRetry(url, maxRetries = 3, delay = 2000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attemptFetch() {
      attempts++;
      console.log(`Attempt ${attempts}/${maxRetries}: Fetching from ${url}`);

      https.get(url, (res) => {
        let data = '';

        if (res.statusCode === 429) {
          const retryAfter = res.headers['retry-after'] || delay / 1000;
          console.log(`Rate limited. Retry after ${retryAfter} seconds...`);
          
          if (attempts < maxRetries) {
            setTimeout(attemptFetch, retryAfter * 1000);
          } else {
            reject(new Error('Max retries reached. GitHub is rate limiting requests.'));
          }
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch. Status code: ${res.statusCode}`));
          return;
        }

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve(data);
        });

      }).on('error', (error) => {
        if (attempts < maxRetries) {
          console.log(`Error: ${error.message}. Retrying in ${delay/1000}s...`);
          setTimeout(attemptFetch, delay);
        } else {
          reject(error);
        }
      });
    }

    attemptFetch();
  });
}

// Main function
async function readGithubJson() {
  try {
    // Try to read from local file first
    if (fs.existsSync(localFile)) {
      console.log('Reading from local cache:', localFile);
      const localData = fs.readFileSync(localFile, 'utf8');
      const jsonData = JSON.parse(localData);
      displayData(jsonData);
      return jsonData;
    }

    // Fetch from GitHub with retry
    console.log('No local cache found. Fetching from GitHub...\n');
    const data = await fetchWithRetry(rawUrl);
    
    const jsonData = JSON.parse(data);
    
    // Save to local file for future use
    fs.writeFileSync(localFile, data, 'utf8');
    console.log(`\n✓ Saved to local cache: ${localFile}`);
    
    displayData(jsonData);
    return jsonData;

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.log('\nAlternative: Download the file manually:');
    console.log(`curl -o addresses.json "${rawUrl}"`);
    process.exit(1);
  }
}

function displayData(jsonData) {
  console.log('\n✓ Successfully parsed JSON file\n');
  console.log('Content:');
  console.log(JSON.stringify(jsonData, null, 2));
  
  console.log('\n--- Data Summary ---');
  console.log('Type:', typeof jsonData);
  if (Array.isArray(jsonData)) {
    console.log('Array length:', jsonData.length);
  } else {
    console.log('Keys:', Object.keys(jsonData));
  }
}

// Run the script
readGithubJson();