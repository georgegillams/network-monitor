const { execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const { simpleFetch, getTimestampString } = require("./utils");

const MINUTES_3 = 3 * 60 * 1000;
const TIME_BETWEEN_CHECKS = MINUTES_3;
const HOURS_4 = 4 * 60 * 60 * 1000;
const TIME_BETWEEN_SPEED_TESTS = HOURS_4;

const LOG_FILE = "../network_monitor_log.txt";

const HUB_IP_ADDRESS = "192.168.1.254";
const HUB_SETTINGS_URL = `http://${HUB_IP_ADDRESS}`;

const LTE_STATUS_UNKNOWN = "Unknown";
const LTE_STATUS_PREFIX = `<span id="lte_status">`;
const LTE_STATUS_SUFFIX = "</span>";

let lastNetworkStatus = null;
let lastLteStatus = null;

const waitFor = async (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const requestListener = async (req, res) => {
  if (req.url === "/logs") {
    const logs = fs.readFileSync(LOG_FILE, { encoding: "utf-8" });
    res.writeHead(200);
    res.end(logs);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
};

const logLteStatus = (status) => {
  if (lastLteStatus !== status) {
    lastLteStatus = status;

    fs.appendFileSync(LOG_FILE, `${getTimestampString()} LTE ${status}\n`);
  }
};

const logNetworkStatus = (status) => {
  if (lastNetworkStatus !== status) {
    lastNetworkStatus = status;

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
  }
};

const checkLTEStatus = async () => {
  try {
    const hubSettingsHtml = await simpleFetch(HUB_SETTINGS_URL);
    if (hubSettingsHtml.includes(LTE_STATUS_PREFIX)) {
      const lteStatus = hubSettingsHtml
        .split(LTE_STATUS_PREFIX)[1]
        .split(LTE_STATUS_SUFFIX)[0];
      logLteStatus(lteStatus);
    } else {
      logLteStatus(LTE_STATUS_UNKNOWN);
    }
  } catch (error) {}
};

const runSpeedTest = () => {
  try {
    const speedTestResults = execSync("speedtest-cli --simple").toString();
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
