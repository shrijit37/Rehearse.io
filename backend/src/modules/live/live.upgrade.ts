import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { env } from "../../config/env";
import { LIVE_WS_PATH } from "./live.config";
import { relayLiveSession } from "./live.relay";
import { liveDeps, type LiveDeps } from "./live.persistence";
import { consumeLiveTicket, liveConfigured, verifyLiveTicket } from "./live.service";

/**
 * The ticket arrives as a WebSocket subprotocol rather than a query parameter:
 * a browser cannot set an Authorization header on `new WebSocket`, and a URL
 * lands in access logs. Valid subprotocol tokens are exactly the characters a
 * JWT uses, so `["bearer", ticket]` travels intact.
 */
function ticketFromRequest(headers: IncomingMessage["headers"]): string {
    const header = headers["sec-websocket-protocol"];
    if (typeof header !== "string") return "";
    const [scheme, token] = header.split(",").map((part) => part.trim());
    return scheme === "bearer" && token ? token : "";
}

function refuse(socket: Duplex, status: number, message: string): void {
    // A silent refusal here is the hardest kind of production bug to find: the
    // browser only ever reports an abnormal close.
    console.warn(`[live] refused upgrade: ${status} ${message}`);
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
}

/**
 * Attaches the Live socket to the existing HTTP server. Nothing else in the app
 * upgrades, so every other upgrade request is destroyed rather than left
 * hanging.
 */
export function attachLiveUpgrade(server: Server, deps: LiveDeps = liveDeps): void {
    const wss = new WebSocketServer({
        noServer: true,
        // Client frames are small JSON control messages and 100 ms audio
        // chunks; anything past this is a broken or hostile client, and `ws`
        // closes it instead of buffering it into relay memory.
        maxPayload: 256 * 1024,
        // The browser fails the connection unless the server echoes one of the
        // protocols it offered, so "bearer" must be selected explicitly.
        handleProtocols: (protocols) => (protocols.has("bearer") ? "bearer" : false),
    });

    server.on("upgrade", (req, socket, head) => {
        const path = (req.url ?? "").split("?")[0];
        if (path !== LIVE_WS_PATH) {
            socket.destroy();
            return;
        }

        // A missing secret is a misconfiguration, not a bad ticket: it gets its
        // own refusal so the two never look alike in a report.
        if (!liveConfigured()) {
            refuse(socket, 500, "Live sessions are not configured");
            return;
        }
        const claims = verifyLiveTicket(ticketFromRequest(req.headers));
        if (!claims) {
            refuse(socket, 401, "Invalid or expired live ticket");
            return;
        }
        if (!consumeLiveTicket(claims.jti)) {
            refuse(socket, 401, "This live ticket has already been used");
            return;
        }

        wss.handleUpgrade(req, socket, head, (client) => {
            relayLiveSession({ client, claims, apiKey: env.GEMINI_API_KEY!, deps });
        });
    });
}
