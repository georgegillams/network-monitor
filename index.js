const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const { getTimestampString, logsToHtml } = require('./utils');

const MINUTES_1 = 1 * 60 * 1000;
const HOURS_2 = 2 * 60 * 60 * 1000;
const HOURS_4 = 4 * 60 * 60 * 1000;
const TIME_BETWEEN_CHECKS = MINUTES_1;
const TIME_BETWEEN_SPEED_TESTS = HOURS_2;
const TIME_BEFORE_UNCONDITIONAL_LOG = HOURS_4;

const LOG_FILE = '../network_monitor_log.txt';
const ERROR_FILE = '../network_monitor_error.txt';
const IP_ADDRESS_FILE = '../network_monitor_IP_addresses.json';

const STATUS_CONNECTED = 'Connected';
const STATUS_DISCONNECTED = 'Disconnected';
const STATUS_STANDBY = 'Standby';
const STATUS_UNKNOWN = 'Unknown';

let lastNetworkStatus = null;
let lastFttpBroadbandStatus = null;
let lastFttcBroadbandStatus = null;
let lastLteStatus = null;
let lastIpAddress = null;
let lastNetworkStatusLogTimestamp = 0;
let lastFttpBroadbandStatusLogTimestamp = 0;
let lastFttcBroadbandStatusLogTimestamp = 0;
let lastLteStatusLogTimestamp = 0;
let lastIpAddressLogTimestamp = 0;

const requestListener = async (req, res) => {
  if (req.url === '/logs-raw') {
    const logs = readFile(LOG_FILE);
    res.writeHead(200);
    res.end(logs);
  } else if (req.url === '/logs') {
    const logs = readFile(LOG_FILE);
    res.writeHead(200);
    res.end(logsToHtml(logs));
  } else if (req.url === '/errors') {
    const logs = readFile(ERROR_FILE);
    res.writeHead(200);
    res.end(logsToHtml(logs));
  } else if (req.url === '/ips') {
    const ips = readFile(IP_ADDRESS_FILE);
    res.writeHead(200);
    res.end(ips);
  } else if (`${req.url}`.startsWith('/add-fttp-ip')) {
    const ipAddress = `${req.url}`.split('?')[1];
    addIpAddress('fttpBroadbandIpAddresses', ipAddress);
    res.writeHead(200);
    res.end('success');
  } else if (`${req.url}`.startsWith('/add-fttc-ip')) {
    const ipAddress = `${req.url}`.split('?')[1];
    addIpAddress('fttcBroadbandIpAddresses', ipAddress);
    res.writeHead(200);
    res.end('success');
  } else if (`${req.url}`.startsWith('/add-lte-ip')) {
    const ipAddress = `${req.url}`.split('?')[1];
    addIpAddress('mobileIpAddresses', ipAddress);
    res.writeHead(200);
    res.end('success');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
};

const readFile = (fileName, defaultValue = '') => {
  if (!fs.existsSync(fileName)) {
    fs.writeFileSync(fileName, defaultValue);
  }

  return fs.readFileSync(fileName, { encoding: 'utf-8' });
};

const addIpAddress = (type, ipAddress) => {
  const ipAddresses = JSON.parse(readFile(IP_ADDRESS_FILE, '{}'));
  if (!ipAddresses[type]) {
    ipAddresses[type] = [];
  }
  ipAddresses[type].push(ipAddress);
  fs.writeFileSync(IP_ADDRESS_FILE, JSON.stringify(ipAddresses, null, 2));
};

const logFttpBroadbandStatus = status => {
  const statusChanged = lastFttpBroadbandStatus !== status;
  const logUnconditionally = lastFttpBroadbandStatusLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (statusChanged || logUnconditionally) {
    lastFttpBroadbandStatus = status;
    lastFttpBroadbandStatusLogTimestamp = Date.now();
    fs.appendFileSync(LOG_FILE, `${getTimestampString()} FTTP Broadband ${status}\n`);
  }
};

const logLteStatus = status => {
  const statusChanged = lastLteStatus !== status;
  const logUnconditionally = lastLteStatusLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (statusChanged || logUnconditionally) {
    lastLteStatus = status;
    lastLteStatusLogTimestamp = Date.now();
    fs.appendFileSync(LOG_FILE, `${getTimestampString()} LTE ${status}\n`);
  }
};

const logPublicIpAddress = ipAddress => {
  const ipChanged = lastIpAddress !== ipAddress;
  const logUnconditionally = lastIpAddressLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (ipChanged || logUnconditionally) {
    lastIpAddress = ipAddress;
    lastIpAddressLogTimestamp = Date.now();
    fs.appendFileSync(LOG_FILE, `${getTimestampString()} Public IP Address ${ipAddress}\n`);
  }
};

const logFttcBroadbandStatus = status => {
  const statusChanged = lastFttcBroadbandStatus !== status;
  const logUnconditionally = lastFttcBroadbandStatusLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (statusChanged || logUnconditionally) {
    lastFttcBroadbandStatus = status;
    lastFttcBroadbandStatusLogTimestamp = Date.now();
    fs.appendFileSync(LOG_FILE, `${getTimestampString()} FTTC Broadband ${status}\n`);
  }
};

const logNetworkStatus = status => {
  const statusChanged = lastNetworkStatus !== status;
  const logUnconditionally = lastNetworkStatusLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (statusChanged || logUnconditionally) {
    lastNetworkStatus = status;
    lastNetworkStatusLogTimestamp = Date.now();
    fs.appendFileSync(LOG_FILE, `${getTimestampString()} NETWORK ${status}\n`);
  }
};

const logNetworkUp = () => {
  logNetworkStatus('UP');
};

const logNetworkDown = () => {
  logNetworkStatus('DOWN');
};

const isNetworkUp = () => {
  try {
    execSync('ping -c 1 google.com');
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
        JSON.stringify({ fttpBroadbandIpAddresses: [], fttcBroadbandIpAddresses: [], mobileIpAddresses: [] })
      );
    }

    const ipAddressesText = readFile(IP_ADDRESS_FILE);
    const { fttpBroadbandIpAddresses, fttcBroadbandIpAddresses, mobileIpAddresses } = JSON.parse(ipAddressesText);

    const publicIPAddress = execSync('curl -s https://checkip.amazonaws.com').toString().replaceAll('\n', '');

    const fttpBroadbandConnected = fttpBroadbandIpAddresses.some(address => publicIPAddress.includes(address));
    const fttcBroadbandConnected = fttcBroadbandIpAddresses.some(address => publicIPAddress.includes(address));
    const mobileConnected = mobileIpAddresses.some(address => publicIPAddress.includes(address));
    logPublicIpAddress(publicIPAddress);
    if (fttpBroadbandConnected) {
      logFttpBroadbandStatus(STATUS_CONNECTED);
      logFttcBroadbandStatus(STATUS_STANDBY);
      logLteStatus(STATUS_STANDBY);
    } else if (fttcBroadbandConnected) {
      logFttpBroadbandStatus(STATUS_DISCONNECTED);
      logFttcBroadbandStatus(STATUS_CONNECTED);
      logLteStatus(STATUS_STANDBY);
    } else if (mobileConnected) {
      logFttpBroadbandStatus(STATUS_DISCONNECTED);
      logFttcBroadbandStatus(STATUS_DISCONNECTED);
      logLteStatus(STATUS_CONNECTED);
    } else {
      logFttpBroadbandStatus(STATUS_UNKNOWN);
      logFttcBroadbandStatus(STATUS_UNKNOWN);
      logLteStatus(STATUS_UNKNOWN);
    }
  } catch (error) {
    fs.appendFileSync(`${ERROR_FILE}`, `${getTimestampString()} Checking LTE status failed\n${error}\n\n`);
  }
};

const runSpeedTest = () => {
  try {
    const speedTestResults = execSync('speedtest-cli --secure --simple').toString();
    const resultsString = speedTestResults.split('\n').join(' ');
    fs.appendFileSync(`${LOG_FILE}`, `${getTimestampString()} ${resultsString}\n`);
  } catch (error) {
    fs.appendFileSync(`${ERROR_FILE}`, `${getTimestampString()} Speed test failed\n${error}\n\n`);
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
server.on('request', requestListener);

server.listen(process.env.PORT || 8080);

fs.appendFileSync(LOG_FILE, `${getTimestampString()} SERVER RUNNING\n`);
