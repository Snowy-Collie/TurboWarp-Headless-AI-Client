/* eslint-disable require-jsdoc, func-style, no-use-before-define */
import {compilePseudoCodeToTarget, decompileTargetBlocks} from './tw-agent-transpiler';

function getHash (str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
}

function initTwAgentServerConnector (vm) {
    if (typeof window === 'undefined') return;

    let socket = null;
    let reconnectTimeout = null;

    function connect () {
        if (socket) {
            socket.close();
        }

        console.log('[TW Agent Connector] Connecting to API server...');
        socket = new WebSocket('ws://localhost:8080/client');

        socket.onopen = () => {
            console.log('[TW Agent Connector] Connected to API server');
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
        };

        socket.onmessage = async event => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch (err) {
                console.error('[TW Agent Connector] Failed to parse message:', err);
                return;
            }

            console.log('[TW Agent Connector] Received message:', msg.type);

            try {
                await handleMessage(msg);
            } catch (err) {
                console.error('[TW Agent Connector] Error handling message:', err);
                socket.send(JSON.stringify({
                    id: msg.id,
                    type: 'response',
                    data: {success: false, error: err.message}
                }));
            }
        };

        socket.onclose = () => {
            console.log('[TW Agent Connector] Connection closed. Retrying in 5 seconds...');
            socket = null;
            if (!reconnectTimeout) {
                reconnectTimeout = setTimeout(connect, 5000);
            }
        };

        socket.onerror = err => {
            console.error('[TW Agent Connector] WebSocket error:', err);
        };
    }

    async function handleMessage (msg) {
        if (msg.type === 'get_environment') {
            const includeCode = msg.includeCode !== false && (!msg.data || msg.data.includeCode !== false);
            const targets = vm.runtime.targets.map(t => {
                const vars = Object.values(t.variables).map(v => ({
                    id: v.id,
                    name: v.name,
                    type: v.type,
                    value: v.value
                }));
                
                const variablesOnly = vars.filter(v => v.type === '');
                const listsOnly = vars.filter(v => v.type === 'list');

                let code = '';
                try {
                    code = decompileTargetBlocks(t);
                } catch (decompileErr) {
                    console.error(`[TW Agent Connector] Failed to decompile target ${t.getName()}:`, decompileErr);
                }

                const targetObj = {
                    id: t.id,
                    name: t.getName(),
                    isStage: t.isStage
                };

                if (includeCode) {
                    targetObj.code = code;
                } else {
                    targetObj.contentHash = getHash(code);
                }

                if (t.isStage) {
                    targetObj.global_variables = variablesOnly;
                    targetObj.global_lists = listsOnly;
                } else {
                    targetObj.local_variables = variablesOnly;
                    targetObj.local_lists = listsOnly;
                }

                return targetObj;
            });

            const currentTarget = vm.editingTarget ? vm.editingTarget.id : null;

            socket.send(JSON.stringify({
                id: msg.id,
                type: 'response',
                data: {
                    targets: targets,
                    currentTarget: currentTarget
                }
            }));
            return;
        }

        if (msg.type === 'get_sprite_code') {
            const targetIds = (msg.data && msg.data.targetIds) || [];
            const codes = {};
            for (const id of targetIds) {
                const target = vm.runtime.getTargetById(id);
                if (target) {
                    try {
                        codes[id] = decompileTargetBlocks(target);
                    } catch (decompileErr) {
                        console.error(
                            `[TW Agent Connector] Failed to decompile target ${target.getName()}:`,
                            decompileErr
                        );
                        codes[id] = '';
                    }
                }
            }
            socket.send(JSON.stringify({
                id: msg.id,
                type: 'response',
                data: {
                    success: true,
                    codes: codes
                }
            }));
            return;
        }

        if (msg.type === 'create_sprite') {
            const {name, canvasType, dimensions, color} = msg.data;
            let svgString = '';
            let rotationCenterX = 0.5;
            let rotationCenterY = 0.5;

            if (canvasType === 'empty') {
                svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
                rotationCenterX = 0.5;
                rotationCenterY = 0.5;
            } else if (canvasType === 'circle') {
                const r = (dimensions && dimensions.radius) || 20;
                const diameter = r * 2;
                svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}"><circle cx="${r}" cy="${r}" r="${r}" fill="${color || '#ff0000'}"/></svg>`;
                rotationCenterX = r;
                rotationCenterY = r;
            } else if (canvasType === 'rect') {
                const w = (dimensions && dimensions.width) || 40;
                const h = (dimensions && dimensions.height) || 40;
                svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${color || '#0000ff'}"/></svg>`;
                rotationCenterX = w / 2;
                rotationCenterY = h / 2;
            } else {
                throw new Error(`Unsupported canvasType: ${canvasType}`);
            }

            const storage = vm.runtime.storage;
            const textEncoder = new TextEncoder();
            const data = textEncoder.encode(svgString);
            const asset = storage.createAsset(
                storage.AssetType.ImageVector,
                storage.DataFormat.SVG,
                data,
                null,
                true
            );

            await storage.store(
                asset.assetType,
                asset.dataFormat,
                asset.data,
                asset.assetId
            );

            const spriteJSON = {
                objName: name,
                sounds: [],
                costumes: [
                    {
                        costumeName: name,
                        baseLayerID: -1,
                        baseLayerMD5: `${asset.assetId}.svg`,
                        bitmapResolution: 1,
                        rotationCenterX: rotationCenterX,
                        rotationCenterY: rotationCenterY
                    }
                ],
                currentCostumeIndex: 0,
                scratchX: 0,
                scratchY: 0,
                scale: 100,
                direction: 90,
                rotationStyle: 'normal',
                isDraggable: false,
                visible: true,
                spriteInfo: {}
            };

            const existingIds = new Set(vm.runtime.targets.map(t => t.id));

            await vm.addSprite(JSON.stringify(spriteJSON));

            const newTarget = vm.runtime.targets.find(t => !existingIds.has(t.id));
            const targetId = newTarget ? newTarget.id : null;
            const finalName = newTarget ? newTarget.getName() : name;

            socket.send(JSON.stringify({
                id: msg.id,
                type: 'response',
                data: {
                    success: true,
                    targetId: targetId,
                    name: finalName
                }
            }));
            return;
        }

        if (msg.type === 'update_blocks') {
            const {targetId, code} = msg.data;
            const target = targetId ? vm.runtime.getTargetById(targetId) : vm.editingTarget;

            if (!target) {
                throw new Error(`Target not found: ${targetId}`);
            }

            // 1. Protection logic: Stop executing threads
            vm.runtime.stopAll();

            // 2. Transpile and mutate target blocks
            compilePseudoCodeToTarget(code, target);

            // 3. Emit workspace update to sync with ScratchBlocks/GUI
            vm.emitWorkspaceUpdate();

            socket.send(JSON.stringify({
                id: msg.id,
                type: 'response',
                data: {success: true}
            }));
            return;
        }

        if (msg.type === 'stop_project') {
            vm.runtime.stopAll();
            socket.send(JSON.stringify({
                id: msg.id,
                type: 'response',
                data: {success: true}
            }));
            return;
        }

        if (msg.type === 'run_project') {
            vm.greenFlag();
            socket.send(JSON.stringify({
                id: msg.id,
                type: 'response',
                data: {success: true}
            }));
            return;
        }

        // Unknown message type
        socket.send(JSON.stringify({
            id: msg.id,
            type: 'response',
            data: {success: false, error: `Unknown message type: ${msg.type}`}
        }));
    }

    connect();
}

export default initTwAgentServerConnector;
