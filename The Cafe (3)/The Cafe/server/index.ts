import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { networkInterfaces } from "os";
import { initializeDatabase, createAdminAccount, seedDeductionRates, seedPhilippineHolidays } from "./init-db";
import { promptDatabaseChoice, deleteDatabaseFile, displayDatabaseStats, loadSampleData } from "./db-manager";
import { recreateConnection } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  let loadSample = false;

  // Check if FRESH_DB environment variable is set
  if (process.env.FRESH_DB === 'true') {
    console.log('\n🔄 FRESH_DB flag detected. Deleting existing database...\n');
    deleteDatabaseFile();
    // Recreate the database connection after deletion
    recreateConnection();
  }

  // Check if SAMPLE_DATA environment variable is set
  if (process.env.SAMPLE_DATA === 'true') {
    console.log('\n📦 SAMPLE_DATA flag detected. Loading sample data...\n');
    deleteDatabaseFile();
    recreateConnection();
    loadSample = true;
  }

  // Check if this is an interactive terminal (not running in CI/CD or background)
  const isInteractive = process.stdin.isTTY && !process.env.CI && !process.env.NON_INTERACTIVE;

  // Prompt for database choice only in interactive mode and if not already handled by FRESH_DB
  if (isInteractive && process.env.FRESH_DB !== 'true') {
    const choice = await promptDatabaseChoice();

    if (choice === 'fresh') {
      deleteDatabaseFile();
      // Recreate the database connection after deletion
      recreateConnection();
      console.log('🔄 Starting with a fresh database...\n');
    } else if (choice === 'sample') {
      deleteDatabaseFile();
      // Recreate the database connection after deletion
      recreateConnection();
      console.log('🔄 Starting with a fresh database...\n');
      loadSample = true;
    } else {
      displayDatabaseStats();
    }
  }

  // Initialize database (creates tables if they don't exist)
  await initializeDatabase();

  // Load sample data if requested
  if (loadSample) {
    await loadSampleData();
  }

  // Create admin account if it doesn't exist
  await createAdminAccount();

  // Seed default deduction rates if table is empty
  await seedDeductionRates();

  // Seed Philippine holidays if table is empty
  await seedPhilippineHolidays();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Helper function to get local network IP
  const getLocalNetworkIP = () => {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      const netInfo = nets[name];
      if (!netInfo) continue;
      
      for (const net of netInfo) {
        // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
        const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
        if (net.family === familyV4Value && !net.internal) {
          return net.address;
        }
      }
    }
    return null;
  };

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);

  // Check if this is the mobile server instance
  const isMobileServer = process.env.MOBILE_SERVER === 'true';

  server.listen({
    port,
    host: "localhost",  // Changed from localhost to allow network access
    //reusePort: true,
  }, () => {
    const localIP = getLocalNetworkIP();

    console.log('\n' + '='.repeat(70));
    if (isMobileServer) {
      console.log('📱 Mobile Employee Dashboard Server');
    } else {
      console.log('🖥️ Desktop Manager Dashboard Server');
    }
    console.log('='.repeat(70));
    console.log('\n📍 Server URLs:');
    console.log(`  ➜ Local:    http://localhost:${port}`);
    if (localIP) {
      console.log(`  ➜ Network:  http://${localIP}:${port}`);
    }

    if (isMobileServer) {
      console.log('\n👥 Employee Access:');
      console.log(`  ➜ Mobile Dashboard: http://localhost:${port}`);
      if (localIP) {
        console.log(`  ➜ Network Mobile:  http://${localIP}:${port}`);
        console.log('\n💡 Share the Network URL with employees on the same WiFi');
      }
    } else {
      console.log('\n👔 Manager Access:');
      console.log(`  ➜ Desktop Dashboard: http://localhost:${port}`);
      console.log(`  ➜ Mobile Server:     http://localhost:5001`);
      if (localIP) {
        console.log(`  ➜ Network Desktop:  http://${localIP}:${port}`);
        console.log('\n💡 Desktop access for managers and administrators');
      }
    }
    console.log('\n' + '='.repeat(70) + '\n');

    log(`Server ready on port ${port} (${isMobileServer ? 'Mobile' : 'Desktop'})`);
  });
})();
