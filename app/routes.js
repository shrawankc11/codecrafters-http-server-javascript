class RouteHandler {
  constructor() {
    this._routes = [];
  }

  get(path, handler) {
    this._routes.push({ path, handler, method: "get" });
  }

  post(path, handler) {
    this._routes.push({ path, handler, method: "post" });
  }

  handleRequest(path, method, req, res) {
    for (let route of this._routes) {
      if (route.path === path && route.method === method.toLowerCase()) {
        route.handler(req, res);
        return;
      }
    }

    //not found if no route match
    res.statusCode = 404;
    res.end();
  }
}

const route = new RouteHandler();

route.get("/", (_req, res) => {
  res.end();
});

route.get("/user-agent", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.body = req.headers["User-Agent"];
  res.end();
});

route.get("/files/:filename", async (req, res) => {
  const filename = req.path.split("/")[2];
  if (fs.existsSync(fileDirectory)) {
    const filePath = `${fileDirectory}/${filename}`;
    if (fs.existsSync(filePath)) {
      await readFile(filePath)
        .then((data) => {
          res.setHeader("Content-Type", "application/octet-stream");
          res.body = data;
          res.end();
        })
        .catch(() => {
          res.statusCode = 404;
          res.end();
        });
    }
  }
});

export default RouteHandler;
