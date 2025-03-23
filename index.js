const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const { getTimestampString, logsToHtml } = require('./utils');
const {
  STATUS_CONNECTED,
  STATUS_DISCONNECTED,
  STATUS_STANDBY,
  STATUS_UNKNOWN,
  SERVICE_FTTP_BROADBAND,
  SERVICE_FTTC_BROADBAND,
  SERVICE_MOBILE,
  STATUS_UP,
  STATUS_DOWN,
  SERVICE_NETWORK,
  LOGS_UPLOADED_MESSAGE,
  SERVICE_ISP,
} = require('./constants');

const SECONDS_30 = 30 * 1000;
const MINUTES_1 = 1 * 60 * 1000;
const HOURS_2 = 2 * 60 * MINUTES_1;
const HOURS_4 = 4 * 60 * MINUTES_1;
const TIME_BETWEEN_CHECKS = MINUTES_1;
const TIME_BETWEEN_SPEED_TESTS = HOURS_2;
const TIME_BEFORE_UNCONDITIONAL_LOG = HOURS_4;
const TIME_BETWEEN_LOG_UPLOAD_ATTEMPTS = MINUTES_1;

const LOG_FILE = '../network_monitor_log.txt';
const ERROR_FILE = '../network_monitor_error.txt';
const IP_ADDRESS_FILE = '../network_monitor_IP_addresses.json';

let lastNetworkStatus = null;
let lastConnectionStatus = null;
let lastIpAddress = null;
let lastNetworkStatusLogTimestamp = 0;
let lastConnectionStatusLogTimestamp = 0;
let lastIpAddressLogTimestamp = 0;
let shouldUploadLogsAt = null;

const requestListener = async (req, res) => {
  if (req.url === '/logs-raw') {
    const logs = readFile(LOG_FILE);
    res.writeHead(200);
    res.end(logs);
  } else if (req.url === '/logs') {
    const logs = readFile(LOG_FILE);
    res.writeHead(200);
    res.end(logsToHtml(logs));
  } else if (req.url === '/fttp-connected') {
    res.writeHead(200);
    if (lastConnectionStatus?.startsWith(STATUS_CONNECTED)) {
      res.end('true');
    } else {
      res.end('false');
    }
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

const log = (message, timestampString = getTimestampString(), triggerLogUpload = true) => {
  fs.appendFileSync(LOG_FILE, `${timestampString} ${message}\n`);
  if (triggerLogUpload) {
    shouldUploadLogsAt = Date.now() + SECONDS_30;
  }
};

const addIpAddress = (type, ipAddress) => {
  const ipAddresses = JSON.parse(readFile(IP_ADDRESS_FILE, '{}'));
  if (!ipAddresses[type]) {
    ipAddresses[type] = [];
  }
  ipAddresses[type].push(ipAddress);
  fs.writeFileSync(IP_ADDRESS_FILE, JSON.stringify(ipAddresses, null, 2));
};

const logPublicIpAddress = ipAddress => {
  const ipChanged = lastIpAddress !== ipAddress;
  const logUnconditionally = lastIpAddressLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (ipChanged || logUnconditionally) {
    lastIpAddress = ipAddress;
    lastIpAddressLogTimestamp = Date.now();
    log(`Public IP Address ${ipAddress}`);
  }
};

const logConnectionStatus = newConnectionStatus => {
  const statusChanged = lastConnectionStatus !== newConnectionStatus;
  const logUnconditionally = lastConnectionStatusLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (statusChanged || logUnconditionally) {
    lastConnectionStatus = newConnectionStatus;
    lastConnectionStatusLogTimestamp = Date.now();
    log(newConnectionStatus);
  }
};

const logNetworkStatus = status => {
  const statusChanged = lastNetworkStatus !== status;
  const logUnconditionally = lastNetworkStatusLogTimestamp < Date.now() - TIME_BEFORE_UNCONDITIONAL_LOG;

  if (statusChanged || logUnconditionally) {
    lastNetworkStatus = status;
    lastNetworkStatusLogTimestamp = Date.now();
    log(`${SERVICE_NETWORK} ${status}`);
  }
};

const logNetworkUp = () => {
  logNetworkStatus(STATUS_UP);
};

const logNetworkDown = () => {
  logNetworkStatus(STATUS_DOWN);
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
      logConnectionStatus(`${SERVICE_FTTP_BROADBAND} ${STATUS_CONNECTED}`);
    } else if (fttcBroadbandConnected) {
      logConnectionStatus(`${SERVICE_FTTC_BROADBAND} ${STATUS_CONNECTED}`);
    } else if (mobileConnected) {
      logConnectionStatus(`${SERVICE_MOBILE} ${STATUS_CONNECTED}`);
    } else {
      logConnectionStatus(`${SERVICE_ISP} ${STATUS_UNKNOWN}`);
    }
  } catch (error) {
    fs.appendFileSync(`${ERROR_FILE}`, `${getTimestampString()} Checking LTE status failed\n${error}\n\n`);
  }
};

const runSpeedTest = () => {
  try {
    const speedTestResults = execSync('speedtest-cli --secure --simple').toString();
    const resultsString = speedTestResults.split('\n').join(' ');
    log(resultsString);
  } catch (error) {
    fs.appendFileSync(`${ERROR_FILE}`, `${getTimestampString()} Speed test failed\n${error}\n\n`);
  }
};

const sliceLogsSinceLastUpload = logs => {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    if (logs[i].includes(LOGS_UPLOADED_MESSAGE)) {
      return logs.slice(i);
    }
  }

  return logs;
};

const uploadLogs = () => {
  if (!shouldUploadLogsAt) {
    return false;
  }

  if (shouldUploadLogsAt > Date.now()) {
    return false;
  }

  if (!process.env.WEBHOOK_ENDPOINT || !process.env.WEBHOOK_ACCESS_KEY) {
    console.log('No webhook endpoint or access key provided');
    return;
  }
  const last200LinesOfLogs = execSync(`tail -n 200 ${LOG_FILE}`)
    .toString()
    .split('\n')
    .filter(log => log !== '');
  const recentLogsSinceLastUpload = sliceLogsSinceLastUpload(last200LinesOfLogs).join('\n');

  try {
    fetch(process.env.WEBHOOK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-key': process.env.WEBHOOK_ACCESS_KEY,
      },
      body: JSON.stringify({ logs: recentLogsSinceLastUpload, htmlLogs: logsToHtml(recentLogsSinceLastUpload, false) }),
    });

    log(LOGS_UPLOADED_MESSAGE, undefined, false);
    shouldUploadLogsAt = null;
  } catch (error) {
    log('Logs could not be uploaded', undefined, false);
    fs.appendFileSync(`${ERROR_FILE}`, `${getTimestampString()} Error uploading logs\n${error}\n\n`);
  }
};

const millisToMinutes = millis => millis / 1000 / 60;
const millisToHours = millis => millis / 1000 / 60 / 60;
const millisToSecondsOrHours = millis =>
  millisToHours(millis) < 1 ? `${millisToMinutes(millis)} minutes` : `${millisToHours(millis)} hours`;

setInterval(() => {
  runSpeedTest();
}, TIME_BETWEEN_SPEED_TESTS);

setInterval(() => {
  checkNetwork();
  checkConnectionStatus();
}, TIME_BETWEEN_CHECKS);

setInterval(async () => {
  uploadLogs();
}, TIME_BETWEEN_LOG_UPLOAD_ATTEMPTS);

const server = http.createServer();
server.on('request', requestListener);

server.listen(process.env.PORT || 8080);

const serverStartTimestamp = getTimestampString();

log('SERVER RUNNING', serverStartTimestamp);
log(`Checking network every ${millisToSecondsOrHours(TIME_BETWEEN_CHECKS)}`, serverStartTimestamp);
log(`Checking speed every ${millisToSecondsOrHours(TIME_BETWEEN_SPEED_TESTS)}`, serverStartTimestamp);
log(`Uploading logs every ${millisToSecondsOrHours(TIME_BETWEEN_LOG_UPLOAD_ATTEMPTS)}`, serverStartTimestamp);
