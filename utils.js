const puppeteer = require('puppeteer');
const {
  STATUS_CONNECTED,
  STATUS_UNKNOWN,
  STATUS_DISCONNECTED,
  STATUS_STANDBY,
  SERVICE_FTTP_BROADBAND,
  SERVICE_FTTC_BROADBAND,
  SERVICE_MOBILE,
  SERVICE_NETWORK,
  STATUS_UP,
  STATUS_DOWN,
} = require('./constants');

let browser = null;
let page = null;

const createBrowser = async executablePathArg => {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      ...(executablePathArg ? { executablePath: executablePathArg } : {}),
    });
  }

  return browser;
};

const simpleFetch = async (url, executablePathArg = null) => {
  try {
    // Launch the browser and open a new blank page
    await createBrowser(executablePathArg);
    page = await browser.newPage();

    // Navigate the page to a URL
    await page.goto(url);

    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 });

    // wait for page to finish loading
    await page.waitForSelector('#lte_title_text');

    // get full HTML string
    const pageContent = await page.content();

    // close browser
    await page.close();

    return pageContent;
  } catch (error) {
    console.error(`something went wrong fetching ${url}`, error);
    await page?.close?.();
    throw error;
  }
};

const getTimestampString = () => {
  return new Date().toISOString();
};

const getCliArg = argFlag => {
  if (process.argv.includes(`--${argFlag}`)) {
    return process.argv[process.argv.indexOf(`--${argFlag}`) + 1];
  }
  return null;
};

const getClassForLog = log => {
  if (log.includes(STATUS_DISCONNECTED)) {
    return 'error';
  }

  if (log.includes(STATUS_UNKNOWN)) {
    return 'error';
  }

  if (log.includes(`${SERVICE_NETWORK} ${STATUS_UP}`)) {
    return 'ok';
  }

  if (log.includes(`${SERVICE_NETWORK} ${STATUS_DOWN}`)) {
    return 'error';
  }

  if (log.includes(`${SERVICE_FTTP_BROADBAND} ${STATUS_CONNECTED}`)) {
    return 'ok';
  }

  if (log.includes(`${SERVICE_FTTC_BROADBAND} ${STATUS_STANDBY}`)) {
    return 'ok';
  }

  if (log.includes(`${SERVICE_MOBILE} ${STATUS_STANDBY}`)) {
    return 'ok';
  }

  if (log.includes(`${SERVICE_FTTC_BROADBAND} ${STATUS_CONNECTED}`)) {
    return 'warn';
  }

  if (log.includes(`${SERVICE_MOBILE} ${STATUS_CONNECTED}`)) {
    return 'warn';
  }

  return '';
};

const logsToHtml = logs => {
  return `<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family: monospace;
        background: white;
        color: #1e1e1e;
        line-height: 1.4;
        font-size: 1.2rem;
      }

      a {
        color: #9932cc
      }

      .error {
        color: #BA2020
      }

      .warn {
        color: orange
      }

      .ok {
        color: green
      }

      @media (prefers-color-scheme: dark) {
        body {
          background: #1e1e1e;
          color: white;
        }
  
        a {
          color: #da70d6
        }

        .error {
          color: #CA2020
        }

        .ok {
          color: #00a698
        }
      }
    </style>
  </head>
  <body>
    <div>${logs
      .split('\n')
      .map(log => `<span class="${getClassForLog(log)}">${log}</span>`)
      .join('<br/>')}</div>
    <div>
      <a href="/logs">Logs</a>
      <br/>
      <a href="/errors">Errors</a>
    <br/>
    <script type="text/javascript">
      window.scrollTo(0, document.body.scrollHeight);
    </script>
  </body>
</html>`;
};

module.exports = { simpleFetch, getTimestampString, getCliArg, logsToHtml };
