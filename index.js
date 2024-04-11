const { execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const { getTimestampString, getCliArg, logsToHtml } = require("./utils");

const MINUTES_1 = 1 * 60 * 1000;
const HOURS_2 = 2 * 60 * 60 * 1000;
const HOURS_4 = 4 * 60 * 60 * 1000;
const TIME_BETWEEN_CHECKS = MINUTES_1;
const TIME_BETWEEN_SPEED_TESTS = HOURS_2;
const TIME_BEFORE_UNCONDITIONAL_LOG = HOURS_4;

const LOG_FILE = "../network_monitor_log.txt";
const ERROR_FILE = "../network_monitor_error.txt";
const IP_ADDRESS_FILE = "../network_monitor_IP_addresses.json";

const STATUS_CONNECTED = "Connected";
const STATUS_DISCONNECTED = "Disconnected";
const STATUS_STANDBY = "Standby";
const STATUS_UNKNOWN = "Unknown";

let lastNetworkStatus = null;
let lastLteStatus = null;
let lastBroadbandStatus = null;
let lastIpAddress = null;
let lastNetworkStatusLogTimestamp = 0;
let lastLteStatusLogTimestamp = 0;
let lastBroadbandStatusLogTimestamp = 0;
let lastIpAddressLogTimestamp = 0;

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
  } else if (req.url === "/ips") {
    const ips = fs.readFileSync(IP_ADDRESS_FILE, { encoding: "utf-8" });
    res.writeHead(200);
    res.end(ips);
  } else if (`${req.url}`.startsWith("/add-bb-ip")) {
    const ipAddress = `${req.url}`.split("?")[1];
    addIpAddress("broadbandIpAddresses", ipAddress);
    res.writeHead(200);
    res.end("success");
  } else if (`${req.url}`.startsWith("/add-lte-ip")) {
    const ipAddress = `${req.url}`.split("?")[1];
    addIpAddress("mobileIpAddresses", ipAddress);
    res.writeHead(200);
    res.end("success");
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
};

const addIpAddress = (type, ipAddress) => {
  const ipAddresses = JSON.parse(fs.readFileSync(IP_ADDRESS_FILE, "utf8"));
  if (!ipAddresses[type]) {
    ipAddresses[type] = [];
  }
  ipAddresses[type].push(ipAddress);
  fs.writeFileSync(IP_ADDRESS_FILE, JSON.stringify(ipAddresses, null, 2));
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

const logPublicIpAddress = (ipAddress) => {
  const ipChanged = lastIpAddress !== ipAddress;
  const logUnconditionally =
    lastIpAddressLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (ipChanged || logUnconditionally) {
    lastIpAddress = ipAddress;
    lastIpAddressLogTimestamp = Date.now();
    fs.appendFileSync(
      LOG_FILE,
      `${getTimestampString()} Public IP Address ${ipAddress}\n`
    );
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

const isNetworkUp = () => {
  try {
    execSync("ping -c 1 google.com");
    return true;
  } catch (error) {
    return false;
  }
};

const checkNetwork = async (numberOfRetries = 3) => {
  let networkUp = false;
  for (let i = 0; i < numberOfRetries; i += 1) {
    if (isNetworkUp()) {
      networkUp = true;
      break;
    }
  }
  if (networkUp) {
    logNetworkUp();
  } else {
    logNetworkDown();
  }
};

const checkConnectionStatus = async () => {
  try {
    if (!fs.existsSync(IP_ADDRESS_FILE)) {
      fs.writeFileSync(
        IP_ADDRESS_FILE,
        JSON.stringify({ broadbandIpAddresses: [], mobileIpAddresses: [] })
      );
    }

    const ipAddressesText = fs.readFileSync(IP_ADDRESS_FILE, {
      encoding: "utf-8",
    });
    const { broadbandIpAddresses, mobileIpAddresses } =
      JSON.parse(ipAddressesText);

    const publicIPAddress = execSync("curl -s https://checkip.amazonaws.com")
      .toString()
      .replaceAll("\n", "");

    const broadbandConnected = broadbandIpAddresses.some((address) =>
      publicIPAddress.includes(address)
    );
    const mobileConnected = mobileIpAddresses.some((address) =>
      publicIPAddress.includes(address)
    );
    logPublicIpAddress(publicIPAddress);
    if (broadbandConnected) {
      logBroadbandStatus(STATUS_CONNECTED);
      logLteStatus(STATUS_STANDBY);
    } else if (mobileConnected) {
      logBroadbandStatus(STATUS_DISCONNECTED);
      logLteStatus(STATUS_CONNECTED);
    } else {
      logBroadbandStatus(STATUS_UNKNOWN);
      logLteStatus(STATUS_UNKNOWN);
    }
  } catch (error) {
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
  checkConnectionStatus();
}, TIME_BETWEEN_CHECKS);

const server = http.createServer();
server.on("request", requestListener);

server.listen(process.env.PORT || 8080);

fs.appendFileSync(LOG_FILE, `${getTimestampString()} SERVER RUNNING\n`);
