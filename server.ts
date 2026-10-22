import http from "http";
import path from "path";
import express from "express";
import dotenv from "dotenv";
import app from "./src/apiApp.ts";

dotenv.config();

const httpServer = http.createServer(app);

// Vite middleware for development (only when running dev server outside Vercel)
async function startServer() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf("--port");
  const cliPort = portIndex !== -1 && args[portIndex + 1] ? Number(args[portIndex + 1]) : null;
  const PORT = cliPort || (process.env.NODE_ENV === "production" ? (Number(process.env.PORT) || 3000) : 3000);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // WebSocket Setup - strictly isolate to /ws path to prevent collision with Vite HMR runner
  const { WebSocketServer, WebSocket } = await import("ws");
  const wss = new WebSocketServer({ noServer: true });
  let onlineCount = 0;

  wss.on("error", (err) => {
    console.error("WebSocket server error:", err);
  });

  const broadcast = (data: any) => {
    try {
      const message = JSON.stringify(data);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(message);
          } catch (err) {
            console.error("Error sending WebSocket message:", err);
          }
        }
      });
    } catch (err) {
      console.error("Error in broadcast:", err);
    }
  };

  wss.on("connection", (ws) => {
    onlineCount++;
    broadcast({ type: "presence", count: onlineCount });

    ws.on("error", (err) => {
      console.error("WebSocket client connection error:", err);
    });

    ws.on("close", () => {
      onlineCount = Math.max(0, onlineCount - 1);
      broadcast({ type: "presence", count: onlineCount });
    });
  });

  httpServer.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      if (url.pathname === "/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    } catch {
      // Ignore URL parsing or connection errors
    }
  });

  app.set("wss_broadcast", broadcast);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`[Banco de Dados] Supabase PostgreSQL + Cache em Memória Ativos`);
  });
}

// Inicia servidor HTTP apenas fora do ambiente serverless do Vercel
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
