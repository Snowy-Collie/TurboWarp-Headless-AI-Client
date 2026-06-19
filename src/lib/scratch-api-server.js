/* eslint-disable require-jsdoc, func-style, no-use-before-define, import/no-commonjs */
const http = require('http');
const url = require('url');
const WebSocket = require('ws');

let clientSocket = null;
const pendingRequests = new Map(); // id -> res (HTTP response object)
const pendingBlocksSnapshot = new Map(); // id -> { targetId, code }
const pendingRollbackMap = new Map(); // id -> { targetId, code, versionId, poppedSnapshot }
const projectHistory = {}; // targetId -> Array of { timestamp, targetId, code, versionId }

function startApiServer (port = 8080) {
    const server = http.createServer((req, res) => {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url, true);
        const path = parsedUrl.pathname;

        if (!clientSocket || clientSocket.readyState !== WebSocket.OPEN) {
            res.writeHead(503, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Browser client is not connected'}));
            return;
        }

        const correlationId = Math.random().toString(36)
            .substr(2, 9);

        // GET /environment
        if (path === '/environment' && req.method === 'GET') {
            const includeCode = parsedUrl.query.includeCode !== 'false';
            pendingRequests.set(correlationId, res);
            clientSocket.send(JSON.stringify({
                id: correlationId,
                type: 'get_environment',
                includeCode: includeCode,
                data: {
                    includeCode: includeCode
                }
            }));
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (pendingRequests.has(correlationId)) {
                    pendingRequests.delete(correlationId);
                    res.writeHead(504, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'Request to browser client timed out'}));
                }
            }, 10000);
            return;
        }

        // POST /blocks
        if (path === '/blocks' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
            });
            req.on('end', () => {
                let data;
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'Invalid JSON body'}));
                    return;
                }

                // Push new version to projectHistory stack immediately
                const targetId = data.targetId;
                const history = projectHistory[targetId] || [];
                const randStr = Math.random().toString(36);
                const versionId = `v_${Date.now()}_${randStr.substr(2, 5)}`;
                const newSnapshot = {
                    timestamp: Date.now(),
                    targetId: targetId,
                    code: data.code,
                    versionId: versionId
                };
                history.push(newSnapshot);
                projectHistory[targetId] = history;

                pendingRequests.set(correlationId, res);
                pendingBlocksSnapshot.set(correlationId, {
                    targetId: targetId,
                    code: data.code
                });

                clientSocket.send(JSON.stringify({
                    id: correlationId,
                    type: 'update_blocks',
                    data: {
                        targetId: targetId,
                        code: data.code
                    }
                }));

                setTimeout(() => {
                    if (pendingRequests.has(correlationId)) {
                        pendingRequests.delete(correlationId);
                        pendingBlocksSnapshot.delete(correlationId);

                        // Timeout: remove the failed snapshot from history
                        const currentHistory = projectHistory[targetId];
                        if (currentHistory && currentHistory.length > 0) {
                            currentHistory.pop();
                        }

                        res.writeHead(504, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: 'Request to browser client timed out'}));
                    }
                }, 15000);
            });
            return;
        }

        // POST /api/create_sprite
        if (path === '/api/create_sprite' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
            });
            req.on('end', () => {
                let data;
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'Invalid JSON body'}));
                    return;
                }

                pendingRequests.set(correlationId, res);
                clientSocket.send(JSON.stringify({
                    id: correlationId,
                    type: 'create_sprite',
                    data: data
                }));

                setTimeout(() => {
                    if (pendingRequests.has(correlationId)) {
                        pendingRequests.delete(correlationId);
                        res.writeHead(504, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: 'Request to browser client timed out'}));
                    }
                }, 15000);
            });
            return;
        }

        // POST /api/get_sprite_code
        if (path === '/api/get_sprite_code' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
            });
            req.on('end', () => {
                let data;
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'Invalid JSON body'}));
                    return;
                }

                pendingRequests.set(correlationId, res);
                clientSocket.send(JSON.stringify({
                    id: correlationId,
                    type: 'get_sprite_code',
                    data: data
                }));

                setTimeout(() => {
                    if (pendingRequests.has(correlationId)) {
                        pendingRequests.delete(correlationId);
                        res.writeHead(504, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: 'Request to browser client timed out'}));
                    }
                }, 10000);
            });
            return;
        }

        // POST /api/rollback
        if (path === '/api/rollback' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
            });
            req.on('end', () => {
                let data;
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'Invalid JSON body'}));
                    return;
                }

                const targetId = data.targetId;
                const history = projectHistory[targetId] || [];
                if (history.length < 2) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'No version history to rollback to'}));
                    return;
                }

                // Pop the current version
                const poppedSnapshot = history.pop();
                // Get the previous version
                const prevSnapshot = history[history.length - 1];

                pendingRequests.set(correlationId, res);
                pendingRollbackMap.set(correlationId, {
                    targetId: targetId,
                    code: prevSnapshot.code,
                    versionId: prevSnapshot.versionId,
                    poppedSnapshot: poppedSnapshot
                });

                clientSocket.send(JSON.stringify({
                    id: correlationId,
                    type: 'update_blocks',
                    data: {
                        targetId: targetId,
                        code: prevSnapshot.code
                    }
                }));

                setTimeout(() => {
                    if (pendingRequests.has(correlationId)) {
                        pendingRequests.delete(correlationId);
                        
                        // Timeout: restore the popped snapshot
                        const rollbackInfo = pendingRollbackMap.get(correlationId);
                        if (rollbackInfo) {
                            pendingRollbackMap.delete(correlationId);
                            const currentHistory = projectHistory[rollbackInfo.targetId] || [];
                            currentHistory.push(rollbackInfo.poppedSnapshot);
                            projectHistory[rollbackInfo.targetId] = currentHistory;
                        }

                        res.writeHead(504, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: 'Request to browser client timed out'}));
                    }
                }, 15000);
            });
            return;
        }

        // POST /stop
        if (path === '/stop' && req.method === 'POST') {
            pendingRequests.set(correlationId, res);
            clientSocket.send(JSON.stringify({
                id: correlationId,
                type: 'stop_project'
            }));
            setTimeout(() => {
                if (pendingRequests.has(correlationId)) {
                    pendingRequests.delete(correlationId);
                    res.writeHead(504, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'Request to browser client timed out'}));
                }
            }, 5000);
            return;
        }

        // POST /run
        if (path === '/run' && req.method === 'POST') {
            pendingRequests.set(correlationId, res);
            clientSocket.send(JSON.stringify({
                id: correlationId,
                type: 'run_project'
            }));
            setTimeout(() => {
                if (pendingRequests.has(correlationId)) {
                    pendingRequests.delete(correlationId);
                    res.writeHead(504, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'Request to browser client timed out'}));
                }
            }, 5000);
            return;
        }

        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Not Found'}));
    });

    const wss = new WebSocket.Server({noServer: true});

    server.on('upgrade', (request, socket, head) => {
        const pathname = url.parse(request.url).pathname;

        wss.handleUpgrade(request, socket, head, ws => {
            if (pathname === '/client') {
                if (clientSocket) {
                    clientSocket.close();
                }
                clientSocket = ws;
                console.log('[API Server] Browser client connected');
                
                ws.on('message', message => {
                    let msg;
                    try {
                        msg = JSON.parse(message);
                    } catch (e) {
                        return;
                    }

                    if (msg.type === 'response' && msg.id) {
                        const pendingRes = pendingRequests.get(msg.id);
                        if (pendingRes) {
                            pendingRequests.delete(msg.id);
                            
                            // 1. Check if this is a rollback response
                            const rollbackInfo = pendingRollbackMap.get(msg.id);
                            if (rollbackInfo) {
                                pendingRollbackMap.delete(msg.id);
                                if (msg.data && msg.data.success) {
                                    pendingRes.writeHead(200, {'Content-Type': 'application/json'});
                                    pendingRes.end(JSON.stringify({
                                        success: true,
                                        targetId: rollbackInfo.targetId,
                                        code: rollbackInfo.code,
                                        versionId: rollbackInfo.versionId
                                    }));
                                } else {
                                    // Rollback failed, restore the popped snapshot
                                    const history = projectHistory[rollbackInfo.targetId] || [];
                                    history.push(rollbackInfo.poppedSnapshot);
                                    projectHistory[rollbackInfo.targetId] = history;

                                    pendingRes.writeHead(400, {'Content-Type': 'application/json'});
                                    pendingRes.end(JSON.stringify({
                                        success: false,
                                        error: (msg.data && msg.data.error) || 'Failed to rollback blocks update'
                                    }));
                                }
                                return;
                            }

                            // 2. Check if this was a blocks update response
                            const snapshot = pendingBlocksSnapshot.get(msg.id);
                            if (snapshot) {
                                pendingBlocksSnapshot.delete(msg.id);
                                if (!msg.data || !msg.data.success) {
                                    // Compilation failed! Pop the failed snapshot from history
                                    const history = projectHistory[snapshot.targetId];
                                    if (history && history.length > 0) {
                                        history.pop();
                                    }
                                }
                            }

                            pendingRes.writeHead(200, {'Content-Type': 'application/json'});
                            pendingRes.end(JSON.stringify(msg.data || {success: true}));
                        }
                    }
                });

                ws.on('close', () => {
                    console.log('[API Server] Browser client disconnected');
                    if (clientSocket === ws) {
                        clientSocket = null;
                    }
                });
            } else {
                console.log('[API Server] Agent connected via WebSocket');
                ws.on('message', message => {
                    let msg;
                    try {
                        msg = JSON.parse(message);
                    } catch (e) {
                        ws.send(JSON.stringify({error: 'Invalid JSON'}));
                        return;
                    }

                    if (!clientSocket || clientSocket.readyState !== WebSocket.OPEN) {
                        ws.send(JSON.stringify({id: msg.id, error: 'Browser client is not connected'}));
                        return;
                    }

                    const agentCorrelationId = msg.id || Math.random().toString(36)
                        .substr(2, 9);
                    
                    const listener = clientMsg => {
                        let parsedClientMsg;
                        try {
                            parsedClientMsg = JSON.parse(clientMsg);
                        } catch (e) {
                            return;
                        }
                        if (parsedClientMsg.type === 'response' && parsedClientMsg.id === agentCorrelationId) {
                            ws.send(JSON.stringify({
                                id: msg.id,
                                type: 'response',
                                data: parsedClientMsg.data
                            }));
                            clientSocket.removeListener('message', listener);
                        }
                    };

                    clientSocket.on('message', listener);
                    clientSocket.send(JSON.stringify({
                        id: agentCorrelationId,
                        type: msg.type,
                        data: msg.data
                    }));
                });
            }
        });
    });

    server.listen(port, () => {
        console.log(`[API Server] Local WebSocket/HTTP API server is listening on port ${port}`);
    });
}

module.exports = startApiServer;
