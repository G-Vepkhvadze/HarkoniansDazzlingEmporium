/**
 * WebSocket server entry point.
 * This is a separate server that handles WebSocket connections for Foundry integration.
 * 
 * Start this server alongside the Next.js app:
 *   npm run ws:start
 * 
 * The server listens on port 3001 by default and handles WebSocket connections
 * at wss://localhost:3001 (or wss://your-domain.com:3001 in production).
 */

import { initializeWebSocketServer } from './index';

// Port for WebSocket server (should match what Foundry connects to)
const WSS_PORT = Number(process.env.WSS_PORT) || 3001;

console.log(`Starting Harkonians WebSocket server on port ${WSS_PORT}...`);

try {
    const wss = initializeWebSocketServer(WSS_PORT);
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down WebSocket server...');
        wss.close();
        process.exit(0);
    });
    
    process.on('SIGINT', () => {
        console.log('SIGINT received, shutting down WebSocket server...');
        wss.close();
        process.exit(0);
    });
    
    console.log(`WebSocket server is running on port ${WSS_PORT}`);
    console.log(`Foundry modules should connect to: wss://localhost:${WSS_PORT}`);
    
} catch (error) {
    console.error('Failed to start WebSocket server:', error);
    process.exit(1);
}
