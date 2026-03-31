const http = require("node:http");

const FALLBACK_PORT = 3000;
const DEFAULT_PORT = process.env.PORT
  ? Number(process.env.PORT)
  : FALLBACK_PORT;
const HEALTHCHECK_TIMEOUT_MS = 3000;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX_EXCLUSIVE = 400;
const LOCALHOST = "127.0.0.1";

const options = {
  method: "GET",
  timeout: HEALTHCHECK_TIMEOUT_MS,
  hostname: LOCALHOST,
  port: DEFAULT_PORT,
  path: "/",
};

const req = http.request(options, (res) => {
  if (res.statusCode >= HTTP_OK_MIN && res.statusCode < HTTP_OK_MAX_EXCLUSIVE) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on("error", () => {
  process.exit(1);
});

req.on("timeout", () => {
  req.destroy();
  process.exit(1);
});

req.end();
