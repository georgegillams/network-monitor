const { execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const {
  simpleFetch,
  getTimestampString,
  getCliArg,
  logsToHtml,
} = require("./utils");

const MINUTES_1 = 1 * 60 * 1000;
const HOURS_2 = 2 * 60 * 60 * 1000;
const HOURS_4 = 4 * 60 * 60 * 1000;
const TIME_BETWEEN_CHECKS = MINUTES_1;
const TIME_BETWEEN_SPEED_TESTS = HOURS_2;
const TIME_BEFORE_UNCONDITIONAL_LOG = HOURS_4;

const LOG_FILE = "../network_monitor_log.txt";
const ERROR_FILE = "../network_monitor_error.txt";

const HUB_IP_ADDRESS = "192.168.1.254";
const HUB_SETTINGS_URL = `http://${HUB_IP_ADDRESS}`;

const STATUS_UNKNOWN = "Unknown";

const LTE_STATUS_PREFIX = `<span id="lte_status">`;
const LTE_STATUS_SUFFIX = "</span>";

const BROADBAND_STATUS_PREFIX = `<span id="status_connectionStatus" style="font-family:'BTReg';">`;
const BROADBAND_STATUS_SUFFIX = "</span>";

let lastNetworkStatus = null;
let lastLteStatus = null;
let lastBroadbandStatus = null;
let lastNetworkStatusLogTimestamp = 0;
let lastLteStatusLogTimestamp = 0;
let lastBroadbandStatusLogTimestamp = 0;

const executablePathArg = getCliArg("executable-path");

const waitFor = async (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const requestListener = async (req, res) => {
  if (req.url === "/logs-raw") {
    const logs = fs.readFileSync(LOG_FILE, { encoding: "utf-8" });
    res.writeHead(200);
    res.end(logs);
  } else if (req.url === "/logs") {
    const logs = fs.readFileSync(LOG_FILE, { encoding: "utf-8" });
    res.writeHead(200);
    res.end(logsToHtml(logs));
  } else if (req.url === "/errors") {
    const logs = fs.readFileSync(ERROR_FILE, { encoding: "utf-8" });
    res.writeHead(200);
    res.end(logsToHtml(logs));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
};

const logLteStatus = (status) => {
  const statusChanged = lastLteStatus !== status;
  const logUnconditionally =
    lastLteStatusLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (statusChanged || logUnconditionally) {
    lastLteStatus = status;
    lastLteStatusLogTimestamp = Date.now();
    fs.appendFileSync(LOG_FILE, `${getTimestampString()} LTE ${status}\n`);
  }
};

const logBroadbandStatus = (status) => {
  const statusChanged = lastBroadbandStatus !== status;
  const logUnconditionally =
    lastBroadbandStatusLogTimestamp <
    Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (statusChanged || logUnconditionally) {
    lastBroadbandStatus = status;
    lastBroadbandStatusLogTimestamp = Date.now();
    fs.appendFileSync(
      LOG_FILE,
      `${getTimestampString()} Broadband ${status}\n`
    );
  }
};

const logNetworkStatus = (status) => {
  const statusChanged = lastNetworkStatus !== status;
  const logUnconditionally =
    lastNetworkStatusLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (statusChanged || logUnconditionally) {
    lastNetworkStatus = status;
    lastNetworkStatusLogTimestamp = Date.now();
    fs.appendFileSync(LOG_FILE, `${getTimestampString()} NETWORK ${status}\n`);
  }
};

const logNetworkUp = () => {
  logNetworkStatus("UP");
};

const logNetworkDown = () => {
  logNetworkStatus("DOWN");
};

const checkNetwork = async () => {
  try {
    execSync("ping -c 1 google.com");
    logNetworkUp();
  } catch (error) {
    logNetworkDown();
    fs.appendFileSync(
      `${ERROR_FILE}`,
      `${getTimestampString()} Ping failed\n${error}\n\n`
    );
  }
};

const checkLTEStatus = async () => {
  try {
    const hubSettingsHtml = await simpleFetch(
      HUB_SETTINGS_URL,
      executablePathArg
    );
    if (hubSettingsHtml.includes(LTE_STATUS_PREFIX)) {
      const lteStatus = hubSettingsHtml
        .split(LTE_STATUS_PREFIX)[1]
        .split(LTE_STATUS_SUFFIX)[0];
      logLteStatus(lteStatus);
    } else {
      logLteStatus(STATUS_UNKNOWN);
    }
    if (hubSettingsHtml.includes(BROADBAND_STATUS_PREFIX)) {
      const broadbandStatus = hubSettingsHtml
        .split(BROADBAND_STATUS_PREFIX)[1]
        .split(BROADBAND_STATUS_SUFFIX)[0];
      logBroadbandStatus(broadbandStatus);
    } else {
      logBroadbandStatus(STATUS_UNKNOWN);
    }
  } catch (error) {
    fs.appendFileSync(
      `${LOG_FILE}`,
      `${getTimestampString()} Checking LTE status failed\n`
    );
    fs.appendFileSync(
      `${ERROR_FILE}`,
      `${getTimestampString()} Checking LTE status failed\n${error}\n\n`
    );
  }
};

const runSpeedTest = () => {
  try {
    const speedTestResults = execSync(
      "speedtest-cli --secure --simple"
    ).toString();
    const resultsString = speedTestResults.split("\n").join(" ");
    fs.appendFileSync(
      `${LOG_FILE}`,
      `${getTimestampString()} ${resultsString}\n`
    );
  } catch (error) {
    fs.appendFileSync(
      `${LOG_FILE}`,
      `${getTimestampString()} Speed test failed\n`
    );
    fs.appendFileSync(
      `${ERROR_FILE}`,
      `${getTimestampString()} Speed test failed\n${error}\n\n`
    );
  }
};

setInterval(() => {
  runSpeedTest();
}, TIME_BETWEEN_SPEED_TESTS);

setInterval(() => {
  checkNetwork();
  checkLTEStatus();
}, TIME_BETWEEN_CHECKS);

const server = http.createServer();
server.on("request", requestListener);

server.listen(process.env.PORT || 8080);

fs.appendFileSync(LOG_FILE, `${getTimestampString()} SERVER RUNNING\n`);
