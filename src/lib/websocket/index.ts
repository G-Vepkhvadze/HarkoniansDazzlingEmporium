/**
 * WebSocket server and broadcast management for Foundry integration.
 * 
 * This module provides real-time communication between Harkonians and Foundry VTT.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { prisma } from '../prisma';
import { getWorldBySecret } from '../foundry/worldSecret';
import { createAuditLog, createAuditContextFromRequest } from '../audit';

// Type for connected WebSocket clients
interface WebSocketClient {
    ws: WebSocket;
    worldId: string;
    token: string;
    connectedAt: Date;
}

// Map of worldId to connected clients
const connectedClients: Map<string, Set<WebSocketClient>> = new Map();

// The WebSocket server instance
let wss: WebSocketServer | null = null;

/**
 * Initialize the WebSocket server.
 * This should be called when the application starts.
 */
export function initializeWebSocketServer(port: number = 3001): WebSocketServer {
    wss = new WebSocketServer({ port });
    
    console.log(`Harkonians WebSocket server listening on port ${port}`);
    
    wss.on('connection', (ws, req) => {
        handleConnection(ws, req);
    });
    
    wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
    });
    
    return wss;
}

/**
 * Handle a new WebSocket connection.
 */
function handleConnection(ws: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
        console.warn('WebSocket connection without token, closing');
        ws.close(1008, 'Authentication token required');
        return;
    }
    
    // Create client entry (we'll associate with world after handshake)
    const client: WebSocketClient = {
        ws,
        worldId: '',
        token,
        connectedAt: new Date()
    };
    
    console.log('WebSocket client connected:', token.substring(0, 8) + '...');
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleMessage(client, message);
        } catch (error) {
            console.error('WebSocket message parse error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });
    
    ws.on('close', () => {
        cleanupClient(client);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        cleanupClient(client);
    });
}

/**
 * Handle a WebSocket message from a client.
 */
async function handleMessage(client: WebSocketClient, message: any) {
    switch (message.type) {
        case 'handshake':
            await handleHandshake(client, message);
            break;
        case 'pong':
            // Heartbeat response, no action needed
            break;
        case 'ping':
            // Respond to ping
            client.ws.send(JSON.stringify({ type: 'pong' }));
            break;
        default:
            console.debug('Unknown WebSocket message type:', message.type);
    }
}

/**
 * Handle the handshake message from Foundry.
 * This associates the client with a specific world.
 */
async function handleHandshake(client: WebSocketClient, message: any) {
    const { worldId } = message;
    
    if (!worldId) {
        client.ws.send(JSON.stringify({ type: 'error', message: 'worldId required for handshake' }));
        client.ws.close(1008, 'Invalid handshake');
        return;
    }
    
    // Validate the token and associate with world
    try {
        // For now, we just associate the client with the world
        // In a full implementation, we'd validate the token against the character API tokens
        client.worldId = worldId;
        
        // Add client to world's client set
        if (!connectedClients.has(worldId)) {
            connectedClients.set(worldId, new Set());
        }
        connectedClients.get(worldId)?.add(client);
        
        console.log(`WebSocket handshake: client associated with world ${worldId}`);
        
        // Send acknowledgment
        client.ws.send(JSON.stringify({ 
            type: 'handshake_ack',
            worldId,
            message: 'Handshake successful'
        }));
    } catch (error) {
        console.error('Handshake error:', error);
        client.ws.send(JSON.stringify({ type: 'error', message: 'Handshake failed' }));
        client.ws.close(1008, 'Handshake failed');
    }
}

/**
 * Clean up a disconnected client.
 */
function cleanupClient(client: WebSocketClient) {
    if (client.worldId && connectedClients.has(client.worldId)) {
        connectedClients.get(client.worldId)?.delete(client);
        console.log(`WebSocket client disconnected from world ${client.worldId}`);
    }
}

/**
 * Broadcast a message to all clients connected to a specific world.
 */
export function broadcastToWorld(worldId: string, message: any): number {
    const clients = connectedClients.get(worldId);
    if (!clients || clients.size === 0) {
        console.debug(`No WebSocket clients connected to world ${worldId}`);
        return 0;
    }
    
    const messageString = JSON.stringify(message);
    let sentCount = 0;
    
    for (const client of clients) {
        if (client.ws.readyState === 1) { // 1 = OPEN
            try {
                client.ws.send(messageString);
                sentCount++;
            } catch (error) {
                console.error('Error sending to WebSocket client:', error);
                cleanupClient(client);
            }
        }
    }
    
    console.debug(`Broadcast to world ${worldId}: ${sentCount} clients received message`);
    return sentCount;
}

/**
 * Broadcast a message to a specific client (by token).
 */
export function broadcastToClient(token: string, message: any): boolean {
    for (const [worldId, clients] of connectedClients) {
        for (const client of clients) {
            if (client.token === token && client.ws.readyState === 1) {
                client.ws.send(JSON.stringify(message));
                return true;
            }
        }
    }
    return false;
}

/**
 * Broadcast a purchase completion to Foundry clients.
 * This is called when a purchase is completed in the store.
 */
export function broadcastPurchaseCompletion(purchase: {
    id: string;
    characterId: string;
    foundryWorldId: string;
    foundryActorId: string;
    itemId: string;
    itemName: string;
    itemType: string;
    itemDescription: string;
    itemRarity: string;
    itemPrice: number;
    itemImage: string;
    foundryItemData: any;
    stock: number;
}): void {
    if (!purchase.foundryWorldId) return;
    
    const message = {
        type: 'purchase_complete',
        purchase: {
            purchaseId: purchase.id,
            actorId: purchase.foundryActorId,
            item: {
                id: purchase.itemId,
                name: purchase.itemName,
                type: purchase.itemType,
                description: purchase.itemDescription,
                rarity: purchase.itemRarity,
                price: purchase.itemPrice,
                img: purchase.itemImage,
                stock: purchase.stock,
                foundryItemData: purchase.foundryItemData
            }
        }
    };
    
    broadcastToWorld(purchase.foundryWorldId, message);
}

/**
 * Broadcast a gold update to Foundry clients.
 * This is called when gold is updated in the database.
 */
export function broadcastGoldUpdate(worldId: string, actorId: string, gold: number): void {
    const message = {
        type: 'gold_update',
        actorId,
        gold
    };
    
    broadcastToWorld(worldId, message);
}

/**
 * Broadcast a stock update to Foundry clients.
 * This is called when item stock is updated in the database.
 */
export function broadcastStockUpdate(worldId: string, itemId: string, stock: number): void {
    const message = {
        type: 'stock_update',
        itemId,
        stock
    };
    
    broadcastToWorld(worldId, message);
}

/**
 * Get the WebSocket server instance.
 */
export function getWebSocketServer(): WebSocketServer | null {
    return wss;
}

/**
 * Close the WebSocket server.
 */
export function closeWebSocketServer(): void {
    if (wss) {
        wss.close();
        wss = null;
        connectedClients.clear();
        console.log('WebSocket server closed');
    }
}

/**
 * Get the number of connected clients.
 */
export function getConnectedClientCount(): number {
    let count = 0;
    for (const clients of connectedClients.values()) {
        count += clients.size;
    }
    return count;
}
