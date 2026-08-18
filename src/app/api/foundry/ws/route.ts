import { NextApiRequest, NextApiResponse } from "next/server";
import { WebSocketServer } from "ws";
import { getWorldBySecret } from "@/lib/foundry/worldSecret";
import { prisma } from "@/lib/prisma";

// Store connected WebSocket clients by world ID
const connectedClients = new Map<string, Set<WebSocket>>();

// Helper to broadcast to all clients in a world
function broadcastToWorld(worldId: string, message: any) {
  const clients = connectedClients.get(worldId);
  if (clients) {
    const messageString = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === 1) { // 1 = OPEN
        client.send(messageString);
      }
    });
  }
}

// Helper to broadcast to all clients
function broadcastToAll(message: any) {
  const messageString = JSON.stringify(message);
  connectedClients.forEach((clients) => {
    clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(messageString);
      }
    });
  });
}

export const runtime = 'nodejs';

// Configure WebSocket server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket, req: NextApiRequest) => {
  console.log('WebSocket connection established');

  let worldId: string | null = null;
  let authenticated = false;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'handshake':
          // Authenticate the connection
          const { worldId: handshakeWorldId, token } = message;
          
          if (!handshakeWorldId) {
            ws.send(JSON.stringify({ type: 'error', message: 'worldId is required' }));
            ws.close();
            return;
          }

          // For now, we'll use the world secret as the token
          // In production, use proper character API tokens
          const world = await getWorldBySecret(token);
          
          if (!world || world.foundryWorldId !== handshakeWorldId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid authentication' }));
            ws.close();
            return;
          }

          worldId = handshakeWorldId;
          authenticated = true;

          // Add to connected clients
          if (!connectedClients.has(worldId)) {
            connectedClients.set(worldId, new Set());
          }
          connectedClients.get(worldId)?.add(ws);

          ws.send(JSON.stringify({ 
            type: 'handshake_success',
            worldId,
            message: 'Connected to Harkonians WebSocket' 
          }));

          console.log(`WebSocket client connected for world: ${worldId}`);
          break;

        case 'pong':
          // Heartbeat response
          break;

        case 'gold_update':
          // Broadcast gold update to all clients in this world
          if (authenticated && worldId) {
            broadcastToWorld(worldId, message);
          }
          break;

        case 'stock_update':
          // Broadcast stock update to all clients in this world
          if (authenticated && worldId) {
            broadcastToWorld(worldId, message);
          }
          break;

        case 'purchase':
          // Broadcast purchase notification to all clients in this world
          if (authenticated && worldId) {
            broadcastToWorld(worldId, message);
          }
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (worldId && authenticated) {
      const clients = connectedClients.get(worldId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          connectedClients.delete(worldId);
        }
      }
      console.log(`WebSocket client disconnected from world: ${worldId}`);
    } else {
      console.log('WebSocket client disconnected (not authenticated)');
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Configure the Next.js API route to handle WebSocket upgrade
export const config = {
  api: {
    bodyParser: false,
  },
};

let serverReady = false;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!serverReady) {
    // This is a bit of a hack, but we need to handle the WebSocket upgrade
    // In a real deployment, you'd want to handle this differently
    res.status(404).json({ error: 'WebSocket endpoint not ready' });
    return;
  }

  // This is a placeholder - actual WebSocket handling is done by the WebSocketServer
  // In Next.js, we need to use a different approach for WebSocket support
  res.status(404).json({ error: 'WebSocket upgrade required' });
}

// For proper WebSocket support in Next.js, we should use a separate server
// or use the experimental WebSocket support in newer Next.js versions
// For now, this is a placeholder structure

export function GET(request: Request) {
  // This won't actually work for WebSocket upgrade in Next.js without additional configuration
  // For production, consider using a separate WebSocket server or Next.js WebSocket support
  return new Response('WebSocket endpoint', { status: 426 }); // 426 Upgrade Required
}
