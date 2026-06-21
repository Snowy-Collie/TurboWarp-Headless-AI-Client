/* eslint-env node */
/* eslint-disable import/no-nodejs-modules, import/no-commonjs */
const {app, BrowserWindow, ipcMain} = require('electron');
const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const activeWindows = {}; // windowId -> { win, title, targets: [] }
const projectHistory = {}; // windowId -> { targetId -> Array of snapshots }
const pendingIpcRequests = new Map(); // correlationId -> { resolve, reject }
let dashboardWindow = null;

const resolveWindowId = (req, bodyObj = null) => {
    const parsedUrl = url.parse(req.url, true);
    if (parsedUrl.query.windowId) {
        return parsedUrl.query.windowId;
    }
    if (bodyObj && bodyObj.windowId) {
        return bodyObj.windowId;
    }
    
    // Fallback 1: currently focused workspace window
    const focusedWin = BrowserWindow.getFocusedWindow();
    if (focusedWin) {
        for (const [id, winInfo] of Object.entries(activeWindows)) {
            if (winInfo.win === focusedWin) {
                return id;
            }
        }
    }
    
    // Fallback 2: if only one window is registered, default to it
    const keys = Object.keys(activeWindows);
    if (keys.length === 1) {
        return keys[0];
    }
    
    return null;
};

const sendIpcRequest = (windowId, type, data = {}) => new Promise((resolve, reject) => {
    const winInfo = activeWindows[windowId];
    if (!winInfo || !winInfo.win) {
        return reject(new Error(`Window not found: ${windowId}`));
    }
    
    const rand = Math.random();
    const correlationId = rand.toString(36)
        .substr(2, 9);
    
    pendingIpcRequests.set(correlationId, {resolve, reject});
    
    winInfo.win.webContents.send('ipc-action', {
        id: correlationId,
        type: type,
        data: data
    });
    
    // Timeout after 15 seconds
    setTimeout(() => {
        if (pendingIpcRequests.has(correlationId)) {
            pendingIpcRequests.delete(correlationId);
            reject(new Error(`Request ${type} to renderer timed out`));
        }
    }, 15000);
});

const startApiServer = (port = 8080) => {
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url, true);
        const pathName = parsedUrl.pathname;

        // Serve media static assets
        if (pathName.startsWith('/media/')) {
            const relativePath = pathName.substring(7);
            const mediaPath = path.resolve(__dirname, '../../node_modules/scratch-blocks/media', relativePath);
            fs.readFile(mediaPath, (err, fileData) => {
                if (err) {
                    res.writeHead(404, {'Content-Type': 'text/plain'});
                    res.end('Not Found');
                } else {
                    let contentType = 'application/octet-stream';
                    if (mediaPath.endsWith('.svg')) contentType = 'image/svg+xml';
                    else if (mediaPath.endsWith('.png')) contentType = 'image/png';
                    else if (mediaPath.endsWith('.mp3')) contentType = 'audio/mp3';
                    else if (mediaPath.endsWith('.wav')) contentType = 'audio/wav';
                    res.writeHead(200, {'Content-Type': contentType});
                    res.end(fileData);
                }
            });
            return;
        }

        // GET /api/windows
        if (pathName === '/api/windows' && req.method === 'GET') {
            const windowsList = Object.entries(activeWindows).map(([id, winInfo]) => ({
                windowId: id,
                title: winInfo.title,
                targets: winInfo.targets
            }));
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(windowsList));
            return;
        }

        // POST endpoints require body parsing
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
            });
            req.on('end', () => {
                let data = {};
                if (body) {
                    try {
                        data = JSON.parse(body);
                    } catch (e) {
                        res.writeHead(400, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: 'Invalid JSON body'}));
                        return;
                    }
                }

                const windowId = resolveWindowId(req, data);
                if (!windowId) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({
                        error: 'Could not determine target windowId. ' +
                            'Please provide windowId parameter or focus a workstation window.'
                    }));
                    return;
                }

                // POST /api/blocks
                if (pathName === '/blocks' || pathName === '/api/blocks') {
                    const targetId = data.targetId;
                    const code = data.code;
                    if (!targetId || typeof code === 'undefined') {
                        res.writeHead(400, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: 'Missing targetId or code parameters'}));
                        return;
                    }

                    if (!projectHistory[windowId]) {
                        projectHistory[windowId] = {};
                    }
                    const targetHistory = projectHistory[windowId][targetId] || [];
                    const randStr = Math.random().toString(36);
                    const versionId = `v_${Date.now()}_${randStr.substr(2, 5)}`;
                    const snapshot = {
                        timestamp: Date.now(),
                        targetId: targetId,
                        code: code,
                        versionId: versionId
                    };
                    targetHistory.push(snapshot);
                    projectHistory[windowId][targetId] = targetHistory;

                    sendIpcRequest(windowId, 'update_blocks', {targetId, code})
                        .then(result => {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify(result));
                        })
                        .catch(err => {
                            // Pop failed snapshot on compile failure
                            const history = projectHistory[windowId][targetId];
                            if (history && history.length > 0) {
                                history.pop();
                            }
                            res.writeHead(400, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({error: err.message}));
                        });
                    return;
                }

                // POST /api/get_sprite_code
                if (pathName === '/api/get_sprite_code') {
                    sendIpcRequest(windowId, 'get_sprite_code', data)
                        .then(result => {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify(result));
                        })
                        .catch(err => {
                            res.writeHead(400, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({error: err.message}));
                        });
                    return;
                }

                // POST /api/create_sprite
                if (pathName === '/api/create_sprite') {
                    sendIpcRequest(windowId, 'create_sprite', data)
                        .then(result => {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify(result));
                        })
                        .catch(err => {
                            res.writeHead(400, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({error: err.message}));
                        });
                    return;
                }

                // POST /api/rollback
                if (pathName === '/api/rollback') {
                    const targetId = data.targetId;
                    if (!targetId) {
                        res.writeHead(400, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: 'Missing targetId parameter'}));
                        return;
                    }

                    const targetHistory = projectHistory[windowId] ? projectHistory[windowId][targetId] : null;
                    if (!targetHistory || targetHistory.length < 2) {
                        res.writeHead(400, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: 'No version history to rollback to'}));
                        return;
                    }

                    const poppedSnapshot = targetHistory.pop();
                    const prevSnapshot = targetHistory[targetHistory.length - 1];

                    sendIpcRequest(windowId, 'update_blocks', {targetId, code: prevSnapshot.code})
                        .then(() => {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({
                                success: true,
                                targetId: targetId,
                                code: prevSnapshot.code,
                                versionId: prevSnapshot.versionId
                            }));
                        })
                        .catch(err => {
                            // Restore popped snapshot on rollback failure
                            targetHistory.push(poppedSnapshot);
                            res.writeHead(400, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({error: err.message}));
                        });
                    return;
                }

                // POST /stop
                if (pathName === '/stop') {
                    sendIpcRequest(windowId, 'stop_project')
                        .then(result => {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify(result));
                        })
                        .catch(err => {
                            res.writeHead(400, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({error: err.message}));
                        });
                    return;
                }

                // POST /run
                if (pathName === '/run') {
                    sendIpcRequest(windowId, 'run_project')
                        .then(result => {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify(result));
                        })
                        .catch(err => {
                            res.writeHead(400, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({error: err.message}));
                        });
                    return;
                }

                res.writeHead(404, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'Not Found'}));
            });
            return;
        }

        // GET endpoints requiring windowId (GET /environment)
        if (req.method === 'GET') {
            const windowId = resolveWindowId(req, null);
            if (!windowId) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                    error: 'Could not determine target windowId. ' +
                        'Please provide windowId parameter or focus a workstation window.'
                }));
                return;
            }

            // GET /environment
            if (pathName === '/environment') {
                const includeCode = parsedUrl.query.includeCode !== 'false';
                sendIpcRequest(windowId, 'get_environment', {includeCode})
                    .then(result => {
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify(result));
                    })
                    .catch(err => {
                        res.writeHead(400, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: err.message}));
                    });
                return;
            }
        }

        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Not Found'}));
    });

    server.listen(port, () => {
        console.log(`[API Server] Local WebSocket/HTTP API server is listening on port ${port}`);
    });
};

const notifyDashboardUpdated = () => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        const windowsList = Object.entries(activeWindows).map(([id, winInfo]) => ({
            windowId: id,
            title: winInfo.title,
            targets: winInfo.targets
        }));
        dashboardWindow.webContents.send('active-windows-updated', windowsList);
    }
};

const createDashboard = () => {
    dashboardWindow = new BrowserWindow({
        width: 850,
        height: 650,
        title: 'AI Game Development Workstation Dashboard',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    dashboardWindow.loadFile(path.resolve(__dirname, 'dashboard.html'));

    dashboardWindow.on('closed', () => {
        dashboardWindow = null;
        if (Object.keys(activeWindows).length === 0) {
            app.quit();
        }
    });
};

const createWorkspaceWindow = (windowId, title) => {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: title,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    activeWindows[windowId] = {
        win: win,
        title: title,
        windowId: windowId,
        targets: []
    };

    const editorPath = path.resolve(__dirname, '../../build/editor.html');
    win.loadURL(`file://${editorPath}?windowId=${windowId}`);

    win.webContents.on('did-finish-load', () => {
        win.webContents.executeJavaScript(`window.Window_ID = "${windowId}";`);
        notifyDashboardUpdated();
    });

    win.on('closed', () => {
        delete activeWindows[windowId];
        delete projectHistory[windowId];
        notifyDashboardUpdated();
        if (!dashboardWindow && Object.keys(activeWindows).length === 0) {
            app.quit();
        }
    });
};

// IPC Handlers
ipcMain.on('register-window-targets', (event, {windowId, title, targets}) => {
    const winInfo = activeWindows[windowId];
    if (winInfo) {
        winInfo.title = title || winInfo.title;
        winInfo.targets = targets || [];
        notifyDashboardUpdated();
    }
});

ipcMain.on('api-response', (event, response) => {
    const {id, success, data, error} = response;
    const pending = pendingIpcRequests.get(id);
    if (pending) {
        pendingIpcRequests.delete(id);
        if (success) {
            pending.resolve(data);
        } else {
            pending.reject(new Error(error || 'Renderer returned failure'));
        }
    }
});

ipcMain.handle('get-active-windows', () =>
    Object.entries(activeWindows).map(([id, winInfo]) => ({
        windowId: id,
        title: winInfo.title,
        targets: winInfo.targets
    }))
);

ipcMain.on('create-new-window', (event, options = {}) => {
    const rand = Math.random();
    const windowId = `Win_${Date.now()}_${rand.toString(36).substr(2, 5)}`;
    const title = options.title || `Workstation Window ${Object.keys(activeWindows).length + 1}`;
    createWorkspaceWindow(windowId, title);
});

ipcMain.on('close-window', (event, windowId) => {
    const winInfo = activeWindows[windowId];
    if (winInfo && winInfo.win) {
        winInfo.win.close();
    }
});

// App lifecycle
app.whenReady().then(() => {
    startApiServer(8080);
    createDashboard();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createDashboard();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
