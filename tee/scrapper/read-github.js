async function readFromGitHubAPI() {
  const url =
    "https://api.github.com/repos/Assura-Network/assura-monorepo/contents/tee/scrapper/addresses.json";

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3.raw",
        "User-Agent": "Node.js Script",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data from GitHub API:", data);
    return data;
  } catch (error) {
    console.error("Error fetching from GitHub API:", error);
  }
}

readFromGitHubAPI();