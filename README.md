# TurboWarp Headless AI Client

This repository is a modified instance of **TurboWarp (Scratch-GUI)** equipped with a built-in headless execution layer, a local WebSocket/HTTP API server, and an indentation-based Pythonic Pseudo-code transpiler. It serves as an **obedient execution engine** allowing external AI agents to programmatically inspect, control, and update Scratch sprites and scripts.

---

## 1. System Architecture

The client acts as a bridge between an external AI creator and the Scratch runtime:

```
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                              External AI Agent / LLM                              |
|                                                                                   |
+------------------------------------+----------------------------------------------+
                                     |
                                     | HTTP Requests (CORS enabled) or WebSocket
                                     | (Default Port: 8080)
                                     v
+------------------------------------+----------------------------------------------+
|                                                                                   |
|             Local Node.js WebSocket/HTTP Server (scratch-api-server.js)           |
|                                                                                   |
+------------------------------------+----------------------------------------------+
                                     |
                                     | WebSocket Tunnel (Path: /client)
                                     v
+------------------------------------+----------------------------------------------+
|                                                                                   |
|                 TurboWarp Web Client Browser Tab (webpack-dev-server)              |
|                                                                                   |
|    +-----------------------------+             +-----------------------------+    |
|    |                             |             |                             |    |
|    |  Client Bridge Connector    |             |  Python-like Transpiler     |    |
|    |  (tw-agent-server-connector)|<----------->|  (tw-agent-transpiler.js)   |    |
|    |                             |             |                             |    |
|    +--------------+--------------+             +--------------+--------------+    |
|                   |                                           |                   |
|                   v                                           v                   |
|    +--------------+-------------------------------------------+--------------+    |
|    |                                                                         |    |
|    |                             Scratch Virtual Machine                     |    |
|    |                      (window.vm & target.blocks mutation)               |    |
|    |                                                                         |    |
|    +-------------------------------------------------------------------------+    |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

1. **Local Node.js Server:** Listens on port `8080` (or `WS_PORT`). It handles WebSocket connections from both the browser client (`/client`) and external agents (`/agent`), and acts as a stateless HTTP endpoint.
2. **WebSocket Client Tunnel:** The web application in the browser connects to `ws://localhost:8080/client` and maintains a persistent two-way command tunnel.
3. **VM Manipulation:** Requests received by the server are routed to the browser, executed against `window.vm.runtime` via direct state manipulation, and returned back to the server.

---

## 2. Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)

### Setup & Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development environment:
   ```bash
   npm start
   ```
   *Note: The local API server (port 8080) boots automatically alongside the Webpack development server (port 8601) via the devServer `before` hook.*
3. Open `http://localhost:8601/` in your browser. The connection status indicator in the console will log `[TW Agent Connector] Connected to API server`.

---

## 3. Endpoint Reference

All HTTP request bodies must be JSON, and responses return JSON payloads.

### `GET /environment`
Retrieves the current editing environment, including sprite targets, variables, current selection, and the decompiled Pythonic pseudo-code of each sprite.

- **Request:**
  ```http
  GET /environment HTTP/1.1
  Host: localhost:8080
  ```
- **Response:**
  ```json
  {
    "targets": [
      {
        "id": "stage",
        "name": "Stage",
        "isStage": true,
        "variables": [
          {
            "id": "var_score",
            "name": "score",
            "type": "",
            "value": 0
          }
        ],
        "code": ""
      },
      {
        "id": "sprite1_id",
        "name": "Sprite1",
        "isStage": false,
        "variables": [],
        "code": "@on_green_flag\n  motion.move_steps(10)\n  looks.say(\"Hello!\")"
      }
    ],
    "currentTarget": "sprite1_id"
  }
  ```

---

### `POST /blocks`
Overwrites the entire script representation of a specific sprite target with updated Pythonic pseudo-code. During execution, it automatically pre-registers variables/lists and updates the Blockly workspace.

- **Request:**
  ```http
  POST /blocks HTTP/1.1
  Host: localhost:8080
  Content-Type: application/json

  {
    "targetId": "sprite1_id",
    "code": "@on_green_flag\n  motion.move_steps(15)\n  looks.say(\"Welcome!\")\n  forever:\n    motion.turn_right(15)"
  }
  ```
- **Response:**
  ```json
  {
    "success": true
  }
  ```

---

### `POST /stop`
Stops all executing threads, loops, and running scripts in the Scratch VM environment.

- **Request:**
  ```http
  POST /stop HTTP/1.1
  Host: localhost:8080
  ```
- **Response:**
  ```json
  {
    "success": true
  }
  ```

---

### `POST /run`
Triggers the execution of the green flag scripts across all sprites.

- **Request:**
  ```http
  POST /run HTTP/1.1
  Host: localhost:8080
  ```
- **Response:**
  ```json
  {
    "success": true
  }
  ```

---

### `POST /api/create_sprite`
Dynamically creates a new vector sprite in the editor workspace based on geometry specifications.

- **Request:**
  ```http
  POST /api/create_sprite HTTP/1.1
  Host: localhost:8080
  Content-Type: application/json

  {
    "name": "EnemyBall",
    "canvasType": "circle",
    "dimensions": {
      "radius": 15
    },
    "color": "#ff00ff"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "targetId": "sprite_id_1781827300002",
    "name": "EnemyBall"
  }
  ```

---

### `GET /environment?includeCode=false`
Retrieves environment details without raw scripts to save tokens during catalog sweeps. When `includeCode=false`, target entries omit the `code` field and return `contentHash` containing the string hash of the target's pseudo-code.

- **Request:**
  ```http
  GET /environment?includeCode=false HTTP/1.1
  Host: localhost:8080
  ```
- **Response:**
  ```json
  {
    "targets": [
      {
        "id": "sprite_id_1",
        "name": "Sprite1",
        "isStage": false,
        "contentHash": "3be7f746",
        "local_variables": [],
        "local_lists": []
      }
    ],
    "currentTarget": "sprite_id_1"
  }
  ```

---

### `POST /api/get_sprite_code`
Retrieves decompiled pseudo-code for a list of target IDs.

- **Request:**
  ```http
  POST /api/get_sprite_code HTTP/1.1
  Host: localhost:8080
  Content-Type: application/json

  {
    "targetIds": ["sprite_id_1"]
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "codes": {
      "sprite_id_1": "@on_green_flag\n  motion.move_steps(10)"
    }
  }
  ```

---

### `POST /api/rollback`
Rolls back a target sprite's blocks to the previous version snapshot stored in the memory history dictionary.

- **Request:**
  ```http
  POST /api/rollback HTTP/1.1
  Host: localhost:8080
  Content-Type: application/json

  {
    "targetId": "sprite_id_1"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "targetId": "sprite_id_1",
    "code": "@on_green_flag\n  motion.move_steps(10)",
    "versionId": "v_1781827300005_u9zl4"
  }
  ```

---

## 4. Compilation & Production Release

To compile and package the application for distribution, follow these commands.

### Static Bundle Compilation
To build the optimized static asset package of the web player/editor:
```bash
npm run build
```
This generates the bundled static site under the `./build` directory.

### Running the API Server in Production
Since the API server runs in Node.js, the static web files alone cannot run the API server. You have two production deployment strategies:

#### Option A: Running via Node.js / Process Manager (Web Deploy)
Serve the static web build using a standard server (e.g. Nginx/Vite) on your target port, and run the API server in the background using `pm2`:
```bash
# Start the API server directly in the background
PORT=8080 node src/lib/scratch-api-server.js

# Or using pm2 to ensure automatic recovery
pm2 start src/lib/scratch-api-server.js --name "scratch-api-server"
```

#### Option B: Standalone Desktop Packaging (Electron)
If packaging the application as a desktop release using Electron:
1. Require and boot the api server inside the Electron main process:
   ```javascript
   // Inside Electron main.js / index.js
   const startApiServer = require('./src/lib/scratch-api-server');
   startApiServer(8080);
   ```
2. Build the Electron application installer using standard packager tools.
