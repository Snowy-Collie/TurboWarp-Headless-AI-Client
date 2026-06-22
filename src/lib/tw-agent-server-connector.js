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

    // Detect Electron environment
    const electron = window.require ? window.require('electron') : null;
    const ipcRenderer = electron ? electron.ipcRenderer : null;

    if (!ipcRenderer) {
        console.warn('[TW Agent Connector] Electron ipcRenderer not found. Running in standalone browser mode.');
        return;
    }

    // Determine Window ID
    let windowId = window.Window_ID;
    if (!windowId) {
        const params = new URLSearchParams(window.location.search);
        windowId = params.get('windowId') || 'Win_default';
        window.Window_ID = windowId;
    }

    console.log(`[TW Agent Connector] Initializing with Window ID: ${windowId}`);

    // Register active targets to main process to keep dashboard updated
    const registerTargets = () => {
        const targets = vm.runtime.targets.map(t => ({
            id: t.id,
            name: t.getName(),
            isStage: t.isStage
        }));
        ipcRenderer.send('register-window-targets', {
            windowId: windowId,
            title: document.title || 'TurboWarp Workstation Window',
            targets: targets
        });
    };

    // Listen to Scratch runtime events to keep target lists in sync
    vm.runtime.on('target_was_created', registerTargets);
    vm.runtime.on('target_was_removed', registerTargets);
    vm.runtime.on('PROJECT_LOADED', registerTargets);

    // Initial delay registration
    setTimeout(registerTargets, 1000);

    // Handle messages received from Electron main process
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
            return {
                targets: targets,
                currentTarget: currentTarget
            };
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
            return {
                success: true,
                codes: codes
            };
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

            try {
                await storage.store(
                    asset.assetType,
                    asset.dataFormat,
                    asset.data,
                    asset.assetId
                );
            } catch (storeErr) {
                console.warn(
                    '[TW Agent Connector] storage.store failed, falling back to builtinHelper:',
                    storeErr
                );
                storage.builtinHelper._store(
                    asset.assetType,
                    asset.dataFormat,
                    asset.data,
                    asset.assetId
                );
            }

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

            // Trigger target registration to update dashboard with the new sprite
            registerTargets();

            return {
                success: true,
                targetId: targetId,
                name: finalName
            };
        }

        if (msg.type === 'update_blocks') {
            const {targetId, code} = msg.data;
            const target = targetId ? vm.runtime.getTargetById(targetId) : vm.editingTarget;

            if (!target) {
                throw new Error(`Target not found: ${targetId}`);
            }

            vm.runtime.stopAll();
            compilePseudoCodeToTarget(code, target);
            vm.emitWorkspaceUpdate();

            // Refresh target list in dashboard
            registerTargets();

            return {success: true};
        }

        if (msg.type === 'stop_project') {
            vm.runtime.stopAll();
            return {success: true};
        }

        if (msg.type === 'run_project') {
            vm.greenFlag();
            return {success: true};
        }

        throw new Error(`Unknown message type: ${msg.type}`);
    }

    // Subscribe to IPC messages from Main Process
    ipcRenderer.on('ipc-action', async (event, msg) => {
        console.log('[TW Agent Connector] Received IPC action:', msg.type);
        try {
            const resultData = await handleMessage(msg);
            ipcRenderer.send('api-response', {
                id: msg.id,
                success: true,
                data: resultData
            });
        } catch (err) {
            console.error('[TW Agent Connector] Error handling message:', err);
            ipcRenderer.send('api-response', {
                id: msg.id,
                success: false,
                error: err.message
            });
        }
    });
}

export default initTwAgentServerConnector;
