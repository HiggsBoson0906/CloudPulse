import app from "./app";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const serviceName = process.env.SERVICE_NAME || "cloudpulse";

function startServer(): void {
  app.listen(port, function () {
    console.log(`[${serviceName}] Server listening on port ${port}`);
  });
}

startServer();
