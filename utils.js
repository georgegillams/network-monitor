const puppeteer = require("puppeteer");

const simpleFetch = async (url, executablePathArg = null) => {
  try {
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({
      headless: "new",
      ...(executablePathArg ? { executablePath: executablePathArg } : {}),
    });
    const page = await browser.newPage();

    // Navigate the page to a URL
    await page.goto(url);

    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 });

    // wait for page to finish loading
    await page.waitForSelector("#lte_title_text");

    // get full HTML string
    const pageContent = await page.content();

    // close browser
    await browser.close();

    return pageContent;
  } catch (error) {
    console.error(`something went wrong fetching ${url}`, error);
    throw error;
  }
};

const getTimestampString = () => {
  return new Date().toISOString();
};

const getCliArg = (argFlag) => {
  if (process.argv.includes(`--${argFlag}`)) {
    return process.argv[process.argv.indexOf(`--${argFlag}`) + 1];
  }
  return null;
};

module.exports = { simpleFetch, getTimestampString, getCliArg };
