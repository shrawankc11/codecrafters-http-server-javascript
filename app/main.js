const net = require("net");
const fs = require("fs/promises");
const zlib = require("zlib");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

let fileDirectory = "/";

function setDirectory() {
  const opt = process.argv.indexOf("--directory");

  if (opt === -1) {
    console.error("No directory option provided.");
    // process.exit(1);
  }

  fileDirectory = process.argv[opt + 1];
}

setDirectory();

/**
 * @param {string[]} rawHeaderList
 */
function getHeaders(rawHeaderList) {
  const headerList = {};
  rawHeaderList.map((header) => {
    const keyVal = header.split(":");
    const key = keyVal[0];
    const val = keyVal[1].trim();

    headerList[key] = val;
  });

  return headerList;
}

//current used protocal
const protocol = "HTTP/1.1";

//list of status codes to use from
const statusCodes = {
  200: "200 OK",
  404: "404 Not Found",
  500: "500 Server Error",
  201: "201 Created",
};

/**
 * @param {string} data
 */
function parseRequest(data) {
  try {
    const req = {};
    const [statusLine, ...remainingData] = data
      .toString()
      .split("\r\n")
      .filter((v) => v !== undefined && v !== "");

    const bodyData = data.toString().split("\r\n\r\n")[1];

    let rawHeaderList = remainingData;

    if (bodyData) {
      rawHeaderList = remainingData.slice(0, remainingData.length - 1);
    }

    const [_method, path, _protocol] = statusLine.split(" ");
    req.protocol = _protocol;
    req.path = path;
    req.method = _method;
    req.body = remainingData[remainingData.length - 1] || null;
    req.headers = getHeaders(rawHeaderList);

    return req;
  } catch (error) {
    console.log(error);
    console.log("error parsing request data.");
  }
}

//constructs the response string from the res object
function sendResponse(res) {
  let response = `${protocol} `;
  response += statusCodes[res.statusCode];
  response += "\r\n";

  Object.keys(res.headers).forEach((key) => {
    response += `${key}: ${res.headers[key]}\r\n`;
  });

  if (res.body) {
    if (typeof res.body !== "string" && !Buffer.isBuffer(res.body)) {
      res.body = JSON.stringify(res.body);
    }
    response += `Content-Length: ${res.body.length}\r\n`;
  }

  response += "\r\n";
  return response;
}

// Uncomment this to pass the first stage
const server = net.createServer((socket) => {
  socket.on("data", async (data) => {
    //get request object
    const req = parseRequest(data.toString());

    const path = req.path;

    //build response
    let res = {
      headers: {},
      statusCode: 200,
      setHeader: function (key, val) {
        this.headers[key] = val;
      },
      end: function () {
        socket.write(sendResponse(this));
        if (this.body) socket.write(this.body);
        socket.end();
      },
    };

    if (path === "/") {
      res.setHeader("Content-Type", "text/plain");
      res.end();
    } else if (path.startsWith("/echo")) {
      const echoData = path.split("/")[2];
      if (req.headers["Accept-Encoding"]) {
        if (
          req.headers["Accept-Encoding"]
            .split(",")
            .map((v) => v.trim())
            .indexOf("gzip") !== -1
        ) {
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader("Content-Encoding", "gzip");
          const data = zlib.gzipSync(echoData);
          res.body = data;
          res.end();
          return;
        }
        res.setHeader("Content-Type", "text/plain");
        res.body = echoData;
        res.end();
        return;
      }
      res.setHeader("Content-Type", "text/plain");
      res.body = echoData;
      res.end();
    } else if (path === "/user-agent") {
      res.setHeader("Content-Type", "text/plain");
      res.body = req.headers["User-Agent"];
      res.end();
    } else if (path.startsWith("/file")) {
      const filename = path.split("/")[2];
      if (req.method === "GET") {
        const filePath = `${fileDirectory}/${filename}`;
        await fs
          .readFile(filePath)
          .then((data) => {
            res.setHeader("Content-Type", "application/octet-stream");
            res.body = data;
            res.end();
          })
          .catch(() => {
            res.statusCode = 404;
            res.end();
          });
        return;
      } else if (req.method === "POST") {
        const filename = path.split("/")[2];
        fs.writeFile(`${fileDirectory}/${filename}`, req.body)
          .then(() => {
            res.setHeader("Content-Type", "application/octet-stream");
            res.body = data;
            res.statusCode = 201;
            res.end();
          })
          .catch((_err) => {
            res.statusCode = 404;
            res.end();
          });
        return;
      }
      res.statusCode = 404;
      res.end();
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
});

server.listen(4221, "localhost");
