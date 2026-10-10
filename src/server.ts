import app from "./app";
import { config } from "./config";
import { closePool } from "./db/pool";
import { closeRedis } from "./redis/client";
import { closeProducer } from "./kafka/producer";
import { logger } from "./utils/logger";

function startServer(): void {
  const port = config.port;
  const serviceName = config.serviceName;

  const server = app.listen(port, function (): void {
    logger.info("Server", `[${serviceName}] HTTP API listening on port ${port} (env: ${config.nodeEnv})`);
  });

  async function handleGracefulShutdown(signal: string): Promise<void> {
    logger.info("Server", `Received ${signal}. Shutting down HTTP server gracefully...`);

    server.close(async function (): Promise<void> {
      logger.info("Server", "Closed HTTP connections. Closing downstream resources...");
      try {
        await closeProducer();
        await closeRedis();
        await closePool();
        logger.info("Server", "Graceful shutdown complete.");
        process.exit(0);
      } catch (err: unknown) {
        logger.error("Server", "Error during resource shutdown:", err);
        process.exit(1);
      }
    });

    // Hard timeout if shutdown hangs
    setTimeout(function (): void {
      logger.error("Server", "Forced shutdown timeout reached (10s). Exiting.");
      process.exit(1);
    }, 10000).unref();
  }

  process.on("SIGTERM", function (): void {
    handleGracefulShutdown("SIGTERM");
  });

  process.on("SIGINT", function (): void {
    handleGracefulShutdown("SIGINT");
  });
}

startServer();
