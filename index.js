const { execSync } = require("child_process");
const fs = require("fs");
const http = require("http");

const LOG_FILE = "../network_monitor_log.txt";
const MINUTES_2 = 2 * 60 * 1000;
const TIME_BETWEEN_CHECKS = MINUTES_2;
const HOURS_4 = 4 * 60 * 60 * 1000;
const TIME_BETWEEN_SPEED_TESTS = HOURS_4;

let lastStatus = null;

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

const logNetworkStatus = (status) => {
  if (lastStatus !== status) {
    lastStatus = status;

    fs.appendFileSync(
      LOG_FILE,
      `${new Date().toISOString()} NETWORK ${status}\n`
    );
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
    execSync("ping -c 3 google.com");
    logNetworkUp();
  } catch (error) {
    logNetworkDown();
  }
};

const runSpeedTest = () => {
  try {
    const speedTestResults = execSync("speedtest-cli --simple").toString();
    const resultsString = speedTestResults.split("\n").join(" ");
    fs.appendFileSync(
      `${LOG_FILE}`,
      `${new Date().toISOString()} ${resultsString}\n`
    );
  } catch (error) {
    fs.appendFileSync(
      `${LOG_FILE}`,
      `${new Date().toISOString()} Speed test failed\n`
    );
  }
};

setInterval(() => {
  runSpeedTest();
}, TIME_BETWEEN_SPEED_TESTS);

setInterval(() => {
  checkNetwork();
}, TIME_BETWEEN_CHECKS);

const server = http.createServer();
server.on("request", requestListener);

server.listen(process.env.PORT || 8080);

fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} SERVER RUNNING\n`);
