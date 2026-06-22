import {compilePseudoCodeToTarget, decompileTargetBlocks, BlockParams} from './tw-agent-transpiler';


function getHash (str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
}

function getBlockOptionsCatalog (vm) {
    const catalog = {};
    const broadcastMsgs = [];
    if (vm.runtime && vm.runtime.targets) {
        const messages = new Set();
        for (const target of vm.runtime.targets) {
            for (const variable of Object.values(target.variables)) {
                if (variable.type === 'broadcast_msg') {
                    messages.add(variable.name);
                }
            }
        }
        broadcastMsgs.push(...messages);
    }

    const coreOptions = {
        looks_changeeffectby: {
            EFFECT: ['COLOR', 'FISHEYE', 'WHIRL', 'PIXELATE', 'MOSAIC', 'BRIGHTNESS', 'GHOST']
        },
        looks_seteffectto: {
            EFFECT: ['COLOR', 'FISHEYE', 'WHIRL', 'PIXELATE', 'MOSAIC', 'BRIGHTNESS', 'GHOST']
        },
        sound_changeeffectby: {
            EFFECT: ['PITCH', 'PAN']
        },
        sound_seteffectto: {
            EFFECT: ['PITCH', 'PAN']
        },
        motion_setrotationstyle: {
            STYLE: ['left-right', "don't rotate", 'all around']
        },
        looks_gotofrontback: {
            FRONT_BACK: ['front', 'back']
        },
        looks_goforwardbackwardlayers: {
            FORWARD_BACKWARD: ['forward', 'backward']
        },
        event_whengreaterthan: {
            WHATEVER: ['LOUDNESS', 'TIMER']
        },
        control_stop: {
            STOP_OPTION: ['all', 'this script', 'other scripts in sprite']
        },
        sensing_current: {
            CURRENTMENU: ['YEAR', 'MONTH', 'DATE', 'DAYOFWEEK', 'HOUR', 'MINUTE', 'SECOND']
        },
        operator_mathop: {
            OPERATOR: ['abs', 'floor', 'ceiling', 'sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'e ^', '10 ^']
        },
        event_whenkeypressed: {
            KEY_OPTION: ['space', 'up arrow', 'down arrow', 'right arrow', 'left arrow', 'any', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
        },
        sensing_keypressed: {
            KEY_OPTION: ['space', 'up arrow', 'down arrow', 'right arrow', 'left arrow', 'any', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
        },
        event_whenbroadcastreceived: {
            BROADCAST_OPTION: broadcastMsgs
        },
        event_broadcast: {
            BROADCAST_INPUT: broadcastMsgs
        },
        event_broadcastandwait: {
            BROADCAST_INPUT: broadcastMsgs
        }
    };

    for (const [opcode, params] of Object.entries(BlockParams)) {
        catalog[opcode] = {
            opcode: opcode,
            params: params,
            args: params,
            options: coreOptions[opcode] || {}
        };
    }

    if (vm.runtime && vm.runtime._blockInfo) {
        for (const category of vm.runtime._blockInfo) {
            const catId = category.id;
            const menuInfoMap = category.menuInfo || {};
            const blocks = category.blocks || [];
            
            for (const block of blocks) {
                if (!block.info || !block.info.opcode) continue;
                const opcode = `${catId}_${block.info.opcode}`;
                
                let params = catalog[opcode] ? catalog[opcode].params : null;
                if (!params) {
                    const text = block.info.text || '';
                    const regex = /\[([^\]]+)\]/g;
                    const argNames = [];
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        argNames.push(match[1]);
                    }
                    params = argNames.map(name => {
                        const argMeta = block.info.arguments && block.info.arguments[name];
                        const isField = argMeta && argMeta.menu &&
                            (!category.menuInfo || !category.menuInfo[argMeta.menu] ||
                            !category.menuInfo[argMeta.menu].acceptReporters);
                        return {
                            name: name,
                            type: isField ? 'field' : 'input',
                            varType: argMeta ? argMeta.type : undefined
                        };
                    });
                }
                
                const options = {};
                if (block.info.arguments) {
                    for (const [argName, argMeta] of Object.entries(block.info.arguments)) {
                        if (argMeta && argMeta.menu) {
                            const menuInfo = menuInfoMap[argMeta.menu];
                            if (menuInfo && menuInfo.items) {
                                let items = [];
                                if (Array.isArray(menuInfo.items)) {
                                    items = menuInfo.items;
                                } else if (typeof menuInfo.items === 'function') {
                                    try {
                                        items = menuInfo.items.call(category);
                                    } catch (e) {
                                        // ignore
                                    }
                                }
                                
                                if (Array.isArray(items)) {
                                    options[argName] = items.map(item => {
                                        if (typeof item === 'string' || typeof item === 'number') {
                                            return String(item);
                                        }
                                        if (item && typeof item === 'object') {
                                            return String(item.value !== undefined ? item.value : item.text);
                                        }
                                        return String(item);
                                    });
                                }
                            }
                        }
                    }
                }
                
                const existingOptions = catalog[opcode] ? catalog[opcode].options : {};
                catalog[opcode] = {
                    opcode: opcode,
                    params: params,
                    args: params,
                    options: Object.assign({}, existingOptions, options)
                };
            }
        }
    }

    return catalog;
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
                currentTarget: currentTarget,
                blocks: getBlockOptionsCatalog(vm)
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
                svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"></svg>';
                rotationCenterX = 15;
                rotationCenterY = 15;
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
                x: 0,
                y: 0,
                size: 100,
                scale: 100,
                volume: 100,
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
