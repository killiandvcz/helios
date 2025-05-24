# 🌟 Helios

> A powerful WebSocket server framework for real-time applications, built on Bun

Helios is a next-generation WebSocket server that makes building real-time applications a breeze. With built-in method routing, peer-to-peer proxying, and bulletproof message reliability, it's perfect for gaming, collaboration tools, IoT dashboards, and microservices.

## ✨ Features

- 🚀 **Lightning Fast** - Built on Bun for maximum performance
- 🔌 **Method Routing** - Define API-like methods over WebSocket
- 🔄 **Peer-to-Peer Proxy** - Route messages between clients seamlessly
- 📨 **Reliable Messaging** - Built-in acknowledgments and retry logic
- 🎯 **Type Safe** - Full TypeScript support with JSDoc
- 🔧 **Simple API** - Intuitive, developer-friendly interface
- 🏗️ **Modular Architecture** - Clean, extensible codebase

## 🚀 Quick Start

### Installation

```bash
bun add @killiandvcz/helios
```

### Basic Server

```javascript
import { Helios } from "@killiandvcz/helios";

const helios = new Helios();

// Define a method (like an API endpoint)
helios.method("user:create", async (context) => {
  const user = await createUser(context.request.payload);
  return context.success(user);
});

// Handle new connections
helios.onconnection((starling) => {
  console.log(`New client connected: ${starling.id}`);
});

// Start the server
helios.serve(3000);
console.log("🌟 Helios server running on port 3000");
```

## 📚 Core Concepts

### Methods
Define RPC-like methods that clients can call:

```javascript
// Simple method
helios.method("ping", async (context) => {
  return context.success({ message: "pong", timestamp: Date.now() });
});

// Method with data processing
helios.method("chat:send", async (context) => {
  const { message, room } = context.request.payload;
  
  // Broadcast to all clients in room
  broadcastToRoom(room, message);
  
  return context.success({ sent: true });
});

// Error handling
helios.method("user:delete", async (context) => {
  const { id } = context.request.payload;
  
  if (!id) {
    return context.error("User ID is required", { status: 400 });
  }
  
  // Delete user logic...
  return context.success({ deleted: true });
});
```

### Proxy System
Enable peer-to-peer communication through the server:

```javascript
helios.useProxy(async (context) => {
  const { message } = context;
  
  // Route to specific client
  if (message.peer?.name) {
    const targetClient = findClientByName(message.peer.name);
    
    if (targetClient) {
      const response = await context.forward(targetClient);
      return context.reply(response.data);
    } else {
      return context.deny("Client not found", 404);
    }
  }
  
  // Default handling
  return context.reply({ status: "received" });
});
```

### Connection Management

```javascript
const clients = new Map();

helios.onconnection(async (starling) => {
  // Get client manifest
  const manifest = await starling.request("manifest");
  clients.set(manifest.data.name, starling);
  
  // Handle disconnection
  starling.events.on("close", () => {
    clients.delete(manifest.data.name);
  });
});
```

## 🔌 API Reference

### Helios Class

#### `new Helios()`
Creates a new Helios server instance.

#### `helios.method(name, handler)`
Register a method that clients can call.

- `name` (string): Method name
- `handler` (function): Async function that receives a `RequestContext`

#### `helios.useProxy(handler)`
Set up peer-to-peer message routing.

- `handler` (function): Async function that receives a `ProxyContext`

#### `helios.onconnection(callback)`
Listen for new client connections.

- `callback` (function): Function that receives a `Starling` instance

#### `helios.serve(port?)`
Start the WebSocket server.

- `port` (number, optional): Port to listen on

### Context Objects

#### RequestContext
- `context.request` - The incoming request
- `context.success(data, options?)` - Send success response
- `context.error(error, options?)` - Send error response
- `context.finish()` - Clean up the request

#### ProxyContext
- `context.message` - The incoming message
- `context.forward(starling)` - Forward message to another client
- `context.reply(data, options?)` - Reply to the sender
- `context.deny(reason, status?)` - Deny the request
- `context.starlings` - Access to all connected clients

### Starling Instance (Server-side client)
- `starling.id` - Unique client identifier
- `starling.request(method, payload, options?)` - Make request to client
- `starling.json(data, options?)` - Send JSON message
- `starling.text(data, options?)` - Send text message
- `starling.binary(data, options?)` - Send binary message
- `starling.set(key, value)` - Store client data
- `starling.get(key)` - Retrieve client data

## 🎮 Real-World Examples

### Chat Server
```javascript
const rooms = new Map();

helios.method("room:join", async (context) => {
  const { roomId } = context.request.payload;
  const { starling } = context;
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  
  rooms.get(roomId).add(starling);
  starling.set("currentRoom", roomId);
  
  return context.success({ joined: roomId });
});

helios.method("message:send", async (context) => {
  const { message } = context.request.payload;
  const { starling } = context;
  const roomId = starling.get("currentRoom");
  
  // Broadcast to all room members
  for (const client of rooms.get(roomId)) {
    if (client !== starling) {
      client.json({ type: "message", data: message });
    }
  }
  
  return context.success({ sent: true });
});
```

### Game Server
```javascript
const gameState = { players: new Map() };

helios.method("game:join", async (context) => {
  const { playerName } = context.request.payload;
  const { starling } = context;
  
  gameState.players.set(starling.id, {
    name: playerName,
    position: { x: 0, y: 0 },
    starling
  });
  
  // Notify all players
  broadcastGameState();
  
  return context.success({ playerId: starling.id });
});

helios.method("player:move", async (context) => {
  const { position } = context.request.payload;
  const { starling } = context;
  
  const player = gameState.players.get(starling.id);
  if (player) {
    player.position = position;
    broadcastGameState();
  }
  
  return context.success({ moved: true });
});

function broadcastGameState() {
  const state = Array.from(gameState.players.values()).map(p => ({
    id: p.starling.id,
    name: p.name,
    position: p.position
  }));
  
  for (const player of gameState.players.values()) {
    player.starling.json({ type: "gameState", data: state });
  }
}
```

### Microservice Hub
```javascript
const services = new Map();

helios.onconnection(async (starling) => {
  try {
    const manifest = await starling.request("manifest");
    services.set(manifest.data.name, starling);
    console.log(`Service registered: ${manifest.data.name}`);
  } catch (error) {
    console.error("Failed to get service manifest");
  }
});

helios.useProxy(async (context) => {
  const { message } = context;
  
  if (message.peer?.service) {
    const targetService = services.get(message.peer.service);
    
    if (targetService) {
      const response = await context.forward(targetService);
      return context.reply(response.data);
    } else {
      return context.deny("Service not available", 503);
    }
  }
});
```

## 🔧 Configuration

### Server Options
```javascript
const helios = new Helios();

// Custom port
helios.serve(8080);

// With Bun server options
const server = Bun.serve({
  port: 3000,
  fetch: helios.fetch,
  websocket: helios.handlers
});
```

### Message Options
```javascript
// Method with custom options
helios.method("slow-operation", async (context) => {
  // Long running operation...
  return context.success(result, {
    headers: { 
      status: 200,
      "x-processing-time": processingTime 
    }
  });
});
```

## 🤝 Related

- **[@killiandvcz/starling](https://github.com/killiandvcz/starling)** - WebSocket client for Helios
- **[@killiandvcz/pulse](https://github.com/killiandvcz/pulse)** - Event system used internally

## 📄 License

MIT

## 🙋‍♂️ Support

- Create an issue on [GitHub](https://github.com/killiandvcz/helios/issues)
- Follow [@killiandvcz](https://github.com/killiandvcz) for updates

---

Built with ❤️ by [killiandvcz](https://github.com/killiandvcz)