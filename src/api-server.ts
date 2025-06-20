import express from "express";
import { readFile } from "fs/promises";
import { main as generateReceiptMain } from "./scripts/generate-receipt";
import { logger } from "./utils";

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(express.json());

// curl -X POST localhost:3000/api/generate-receipt
app.post("/api/generate-receipt", async (req: any, res: any) => {
  try {
    const BASE_ATTESTOR_URL =
      "wss://attestor-core-production.up.railway.app/ws";
    const attestor = req.body?.attestor || BASE_ATTESTOR_URL;
    console.log("Request received:", { attestor });

    // Read tossbank.json file
    let fileContents = await readFile("example/tossbank.json", "utf8");
    console.log("File read successfully");

    // Replace environment variables in file contents
    for (const variable in process.env) {
      fileContents = fileContents.replace(
        `{{${variable}}}`,
        process.env[variable]!
      );
    }

    const receiptParams = JSON.parse(fileContents);
    console.log("Receipt params prepared:", receiptParams.name);

    // Set attestor URL
    process.env.ATTESTOR_URL = attestor;
    console.log("Using attestor:", attestor);

    console.log("Starting receipt generation...");
    const result = await generateReceiptMain(receiptParams);
    console.log("Receipt generated successfully");

    res.json({
      success: true,
      data: {
        provider: result.provider,
        receipt: result.receipt,
        extractedParameters: result.extractedParameters,
        transcript: result.transcript,
      },
    });
  } catch (error) {
    console.error("Detailed error:", error);
    logger.error("Error generating receipt:", error);

    res.status(500).json({
      success: false,
      error: "Failed to generate receipt",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
  });

  // Keep the process alive and handle graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  return server;
}

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
}
