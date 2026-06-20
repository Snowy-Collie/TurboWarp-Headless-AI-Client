/* eslint-disable require-jsdoc, func-style, no-use-before-define, max-len */
// TurboWarp Pseudo-code Transpiler and Decompiler
// Exposes compiler and decompiler to translate clean pseudo-code into target blocks and vice-versa.

function normalizeOpcode (op) {
    if (typeof op !== 'string') return op;
    if (op.startsWith('data_')) {
        const cmd = op.substring(5);
        const dataCommands = [
            'set_global_var', 'change_global_var', 'show_global_var', 'hide_global_var',
            'set_local_var', 'change_local_var', 'show_local_var', 'hide_local_var',
            'add_to_global_list', 'delete_of_global_list', 'delete_all_of_global_list', 'insert_at_global_list', 'replace_item_of_global_list', 'item_of_global_list', 'item_num_of_global_list', 'length_of_global_list', 'list_contains_global_item', 'show_global_list', 'hide_global_list',
            'add_to_local_list', 'delete_of_local_list', 'delete_all_of_local_list', 'insert_at_local_list', 'replace_item_of_local_list', 'item_of_local_list', 'item_num_of_local_list', 'length_of_local_list', 'list_contains_local_item', 'show_local_list', 'hide_local_list',
            'get_global_var', 'get_local_var', 'get_global_list', 'get_local_list'
        ];
        if (dataCommands.includes(cmd)) {
            return `data.${cmd}`;
        }
    }
    return op;
}

const BlockParams = {
    // Opcode -> array of { name: string, type: 'input'|'field', varType?: string }
    motion_movesteps: [{name: 'STEPS', type: 'input'}],
    motion_turnright: [{name: 'DEGREES', type: 'input'}],
    motion_turnleft: [{name: 'DEGREES', type: 'input'}],
    motion_goto: [{name: 'TO', type: 'input'}],
    motion_gotoxy: [{name: 'X', type: 'input'}, {name: 'Y', type: 'input'}],
    motion_glideto: [{name: 'SECS', type: 'input'}, {name: 'TO', type: 'input'}],
    motion_glidesecstoxy: [{name: 'SECS', type: 'input'}, {name: 'X', type: 'input'}, {name: 'Y', type: 'input'}],
    motion_pointindirection: [{name: 'DIRECTION', type: 'input'}],
    motion_pointtowards: [{name: 'TOWARDS', type: 'input'}],
    motion_changexby: [{name: 'DX', type: 'input'}],
    motion_setx: [{name: 'X', type: 'input'}],
    motion_changeyby: [{name: 'DY', type: 'input'}],
    motion_sety: [{name: 'Y', type: 'input'}],
    motion_setrotationstyle: [{name: 'STYLE', type: 'field'}],

    looks_sayforsecs: [{name: 'MESSAGE', type: 'input'}, {name: 'SECS', type: 'input'}],
    looks_say: [{name: 'MESSAGE', type: 'input'}],
    looks_thinkforsecs: [{name: 'MESSAGE', type: 'input'}, {name: 'SECS', type: 'input'}],
    looks_think: [{name: 'MESSAGE', type: 'input'}],
    looks_switchcostumeto: [{name: 'COSTUME', type: 'input'}],
    looks_switchbackdropto: [{name: 'BACKDROP', type: 'input'}],
    looks_changesizeby: [{name: 'CHANGE', type: 'input'}],
    looks_setsizeto: [{name: 'SIZE', type: 'input'}],
    looks_changeeffectby: [{name: 'EFFECT', type: 'field'}, {name: 'CHANGE', type: 'input'}],
    looks_seteffectto: [{name: 'EFFECT', type: 'field'}, {name: 'VALUE', type: 'input'}],
    looks_gotofrontback: [{name: 'FRONT_BACK', type: 'field'}],
    looks_goforwardbackwardlayers: [{name: 'NUM', type: 'input'}, {name: 'FORWARD_BACKWARD', type: 'field'}],

    sound_playuntildone: [{name: 'SOUND_MENU', type: 'input'}],
    sound_play: [{name: 'SOUND_MENU', type: 'input'}],
    sound_changeeffectby: [{name: 'EFFECT', type: 'field'}, {name: 'VALUE', type: 'input'}],
    sound_seteffectto: [{name: 'EFFECT', type: 'field'}, {name: 'VALUE', type: 'input'}],
    sound_changevolumeby: [{name: 'VOLUME', type: 'input'}],
    sound_setvolumeto: [{name: 'VOLUME', type: 'input'}],

    event_whenkeypressed: [{name: 'KEY_OPTION', type: 'field'}],
    event_whenbackdropswitchesto: [{name: 'BACKDROP_OPTION', type: 'field'}],
    event_whengreaterthan: [{name: 'WHATEVER', type: 'field'}, {name: 'VALUE', type: 'input'}],
    event_whenbroadcastreceived: [{name: 'BROADCAST_OPTION', type: 'field', varType: 'broadcast_msg'}],
    event_broadcast: [{name: 'BROADCAST_INPUT', type: 'input', varType: 'broadcast_msg'}],
    event_broadcastandwait: [{name: 'BROADCAST_INPUT', type: 'input', varType: 'broadcast_msg'}],

    control_wait: [{name: 'DURATION', type: 'input'}],
    control_repeat: [{name: 'TIMES', type: 'input'}],
    control_if: [{name: 'CONDITION', type: 'input'}],
    control_if_else: [{name: 'CONDITION', type: 'input'}],
    control_wait_until: [{name: 'CONDITION', type: 'input'}],
    control_repeat_until: [{name: 'CONDITION', type: 'input'}],
    control_stop: [{name: 'STOP_OPTION', type: 'field'}],
    control_create_clone_of: [{name: 'CLONE_OPTION', type: 'input'}],

    sensing_touchingobject: [{name: 'TOUCHINGOBJECTMENU', type: 'input'}],
    sensing_touchingcolor: [{name: 'COLOR', type: 'input'}],
    sensing_coloristouchingcolor: [{name: 'COLOR', type: 'input'}, {name: 'COLOR2', type: 'input'}],
    sensing_distanceto: [{name: 'DISTANCETOMENU', type: 'input'}],
    sensing_askandwait: [{name: 'QUESTION', type: 'input'}],
    sensing_keypressed: [{name: 'KEY_OPTION', type: 'input'}],
    sensing_of: [{name: 'PROPERTY', type: 'field'}, {name: 'OBJECT', type: 'input'}],
    sensing_current: [{name: 'CURRENTMENU', type: 'field'}],

    operator_add: [{name: 'NUM1', type: 'input'}, {name: 'NUM2', type: 'input'}],
    operator_subtract: [{name: 'NUM1', type: 'input'}, {name: 'NUM2', type: 'input'}],
    operator_multiply: [{name: 'NUM1', type: 'input'}, {name: 'NUM2', type: 'input'}],
    operator_divide: [{name: 'NUM1', type: 'input'}, {name: 'NUM2', type: 'input'}],
    operator_random: [{name: 'FROM', type: 'input'}, {name: 'TO', type: 'input'}],
    operator_gt: [{name: 'OPERAND1', type: 'input'}, {name: 'OPERAND2', type: 'input'}],
    operator_lt: [{name: 'OPERAND1', type: 'input'}, {name: 'OPERAND2', type: 'input'}],
    operator_equals: [{name: 'OPERAND1', type: 'input'}, {name: 'OPERAND2', type: 'input'}],
    operator_and: [{name: 'OPERAND1', type: 'input'}, {name: 'OPERAND2', type: 'input'}],
    operator_or: [{name: 'OPERAND1', type: 'input'}, {name: 'OPERAND2', type: 'input'}],
    operator_not: [{name: 'OPERAND', type: 'input'}],
    operator_join: [{name: 'STRING1', type: 'input'}, {name: 'STRING2', type: 'input'}],
    operator_letter_of: [{name: 'LETTER', type: 'input'}, {name: 'STRING', type: 'input'}],
    operator_length: [{name: 'STRING', type: 'input'}],
    operator_contains: [{name: 'STRING1', type: 'input'}, {name: 'STRING2', type: 'input'}],
    operator_mod: [{name: 'NUM1', type: 'input'}, {name: 'NUM2', type: 'input'}],
    operator_round: [{name: 'NUM', type: 'input'}],
    operator_mathop: [{name: 'OPERATOR', type: 'field'}, {name: 'NUM', type: 'input'}],

    data_setvariableto: [{name: 'VARIABLE', type: 'field', varType: ''}, {name: 'VALUE', type: 'input'}],
    data_changevariableby: [{name: 'VARIABLE', type: 'field', varType: ''}, {name: 'VALUE', type: 'input'}],
    data_showvariable: [{name: 'VARIABLE', type: 'field', varType: ''}],
    data_hidevariable: [{name: 'VARIABLE', type: 'field', varType: ''}],
    data_addtolist: [{name: 'ITEM', type: 'input'}, {name: 'LIST', type: 'field', varType: 'list'}],
    data_deleteoflist: [{name: 'INDEX', type: 'input'}, {name: 'LIST', type: 'field', varType: 'list'}],
    data_deletealloflist: [{name: 'LIST', type: 'field', varType: 'list'}],
    data_insertatlist: [{name: 'ITEM', type: 'input'}, {name: 'INDEX', type: 'input'}, {name: 'LIST', type: 'field', varType: 'list'}],
    data_replaceitemoflist: [{name: 'INDEX', type: 'input'}, {name: 'LIST', type: 'field', varType: 'list'}, {name: 'ITEM', type: 'input'}],
    data_itemoflist: [{name: 'INDEX', type: 'input'}, {name: 'LIST', type: 'field', varType: 'list'}],
    data_itemnumoflist: [{name: 'ITEM', type: 'input'}, {name: 'LIST', type: 'field', varType: 'list'}],
    data_lengthoflist: [{name: 'LIST', type: 'field', varType: 'list'}],
    data_listcontainsitem: [{name: 'LIST', type: 'field', varType: 'list'}, {name: 'ITEM', type: 'input'}],
    data_showlist: [{name: 'LIST', type: 'field', varType: 'list'}],
    data_hidelist: [{name: 'LIST', type: 'field', varType: 'list'}]
};

const OpcodeToPythonic = {
    motion_movesteps: 'motion.move_steps',
    motion_turnright: 'motion.turn_right',
    motion_turnleft: 'motion.turn_left',
    motion_goto: 'motion.go_to',
    motion_gotoxy: 'motion.go_to_xy',
    motion_glideto: 'motion.glide_to',
    motion_glidesecstoxy: 'motion.glide_secs_to_xy',
    motion_pointindirection: 'motion.point_in_direction',
    motion_pointtowards: 'motion.point_towards',
    motion_changexby: 'motion.change_x_by',
    motion_setx: 'motion.set_x',
    motion_changeyby: 'motion.change_y_by',
    motion_sety: 'motion.set_y',
    motion_ifonedgebounce: 'motion.if_on_edge_bounce',
    motion_setrotationstyle: 'motion.set_rotation_style',

    looks_sayforsecs: 'looks.say_for_secs',
    looks_say: 'looks.say',
    looks_thinkforsecs: 'looks.think_for_secs',
    looks_think: 'looks.think',
    looks_switchcostumeto: 'looks.switch_costume',
    looks_switchbackdropto: 'looks.switch_backdrop',
    looks_changesizeby: 'looks.change_size_by',
    looks_setsizeto: 'looks.set_size_to',
    looks_changeeffectby: 'looks.change_effect_by',
    looks_seteffectto: 'looks.set_effect_to',
    looks_gotofrontback: 'looks.go_to_front_back',
    looks_goforwardbackwardlayers: 'looks.go_forward_backward_layers',

    sound_playuntildone: 'sound.play_until_done',
    sound_play: 'sound.play',
    sound_changeeffectby: 'sound.change_effect_by',
    sound_seteffectto: 'sound.set_effect_to',
    sound_changevolume_by: 'sound.change_volume_by',
    sound_setvolumeto: 'sound.set_volume_to',

    control_wait: 'control.wait',
    control_wait_until: 'control.wait_until',
    control_stop: 'control.stop',
    control_create_clone_of: 'control.create_clone_of',
    control_delete_this_clone: 'control.delete_this_clone',

    sensing_touchingobject: 'sensing.touching_object',
    sensing_touchingcolor: 'sensing.touching_color',
    sensing_coloristouchingcolor: 'sensing.color_is_touching_color',
    sensing_distanceto: 'sensing.distance_to',
    sensing_askandwait: 'sensing.ask_and_wait',
    sensing_answer: 'sensing.answer',
    sensing_keypressed: 'sensing.key_pressed',
    sensing_mousedown: 'sensing.mouse_down',
    sensing_mousex: 'sensing.mouse_x',
    sensing_mousey: 'sensing.mouse_y',
    sensing_loudness: 'sensing.loudness',
    sensing_timer: 'sensing.timer',
    sensing_resettimer: 'sensing.reset_timer',
    sensing_of: 'sensing.of',
    sensing_current: 'sensing.current',
    sensing_dayssince2000: 'sensing.days_since_2000',
    sensing_username: 'sensing.username',

    operator_add: 'operator.add',
    operator_subtract: 'operator.subtract',
    operator_multiply: 'operator.multiply',
    operator_divide: 'operator.divide',
    operator_random: 'operator.random',
    operator_gt: 'operator.gt',
    operator_lt: 'operator.lt',
    operator_equals: 'operator.equals',
    operator_and: 'operator.and',
    operator_or: 'operator.or',
    operator_not: 'operator.not',
    operator_join: 'operator.join',
    operator_letter_of: 'operator.letter_of',
    operator_length: 'operator.length',
    operator_contains: 'operator.contains',
    operator_mod: 'operator.mod',
    operator_round: 'operator.round',
    operator_mathop: 'operator.mathop'
};

const OpcodeMapping = {};
Object.keys(OpcodeToPythonic).forEach(key => {
    OpcodeMapping[OpcodeToPythonic[key]] = key;
});

const ScopedOpcodes = {
    // Global Variables
    'data.set_global_var': {opcode: 'data_setvariableto', forceGlobal: true, isList: false},
    'data.change_global_var': {opcode: 'data_changevariableby', forceGlobal: true, isList: false},
    'data.show_global_var': {opcode: 'data_showvariable', forceGlobal: true, isList: false},
    'data.hide_global_var': {opcode: 'data_hidevariable', forceGlobal: true, isList: false},

    // Local Variables
    'data.set_local_var': {opcode: 'data_setvariableto', forceGlobal: false, isList: false},
    'data.change_local_var': {opcode: 'data_changevariableby', forceGlobal: false, isList: false},
    'data.show_local_var': {opcode: 'data_showvariable', forceGlobal: false, isList: false},
    'data.hide_local_var': {opcode: 'data_hidevariable', forceGlobal: false, isList: false},

    // Global Lists
    'data.add_to_global_list': {opcode: 'data_addtolist', forceGlobal: true, isList: true},
    'data.delete_of_global_list': {opcode: 'data_deleteoflist', forceGlobal: true, isList: true},
    'data.delete_all_of_global_list': {opcode: 'data_deletealloflist', forceGlobal: true, isList: true},
    'data.insert_at_global_list': {opcode: 'data_insertatlist', forceGlobal: true, isList: true},
    'data.replace_item_of_global_list': {opcode: 'data_replaceitemoflist', forceGlobal: true, isList: true},
    'data.item_of_global_list': {opcode: 'data_itemoflist', forceGlobal: true, isList: true},
    'data.item_num_of_global_list': {opcode: 'data_itemnumoflist', forceGlobal: true, isList: true},
    'data.length_of_global_list': {opcode: 'data_lengthoflist', forceGlobal: true, isList: true},
    'data.list_contains_global_item': {opcode: 'data_listcontainsitem', forceGlobal: true, isList: true},
    'data.show_global_list': {opcode: 'data_showlist', forceGlobal: true, isList: true},
    'data.hide_global_list': {opcode: 'data_hidelist', forceGlobal: true, isList: true},

    // Local Lists
    'data.add_to_local_list': {opcode: 'data_addtolist', forceGlobal: false, isList: true},
    'data.delete_of_local_list': {opcode: 'data_deleteoflist', forceGlobal: false, isList: true},
    'data.delete_all_of_local_list': {opcode: 'data_deletealloflist', forceGlobal: false, isList: true},
    'data.insert_at_local_list': {opcode: 'data_insertatlist', forceGlobal: false, isList: true},
    'data.replace_item_of_local_list': {opcode: 'data_replaceitemoflist', forceGlobal: false, isList: true},
    'data.item_of_local_list': {opcode: 'data_itemoflist', forceGlobal: false, isList: true},
    'data.item_num_of_local_list': {opcode: 'data_itemnumoflist', forceGlobal: false, isList: true},
    'data.length_of_local_list': {opcode: 'data_lengthoflist', forceGlobal: false, isList: true},
    'data.list_contains_local_item': {opcode: 'data_listcontainsitem', forceGlobal: false, isList: true},
    'data.show_local_list': {opcode: 'data_showlist', forceGlobal: false, isList: true},
    'data.hide_local_list': {opcode: 'data_hidelist', forceGlobal: false, isList: true}
};

const HatOpcodes = [
    'event_whenflagclicked',
    'event_whenkeypressed',
    'event_whenthisspriteclicked',
    'event_whenbackdropswitchesto',
    'event_whengreaterthan',
    'event_whenbroadcastreceived',
    'control_start_as_clone'
];

function randomId () {
    return Math.random().toString(36)
        .substr(2, 9);
}

class ParseNode {
    constructor (opcode, args, indent) {
        this.opcode = opcode;
        this.args = args || [];
        this.indent = indent;
        this.children = [];
        this.next = null;
    }
}

const preprocessPythonicCode = code => {
    let processed = code;
    // Replace trailing colons on keywords
    processed = processed.replace(/\bforever\s*:/g, 'control_forever()');
    processed = processed.replace(/\belse\s*:/g, 'else');
    processed = processed.replace(/\bif\s+([^:]+):/g, 'control_if($1)');
    processed = processed.replace(/\brepeat\s*\(([^)]+)\)\s*:/g, 'control_repeat($1)');
    processed = processed.replace(/\brepeat_until\s*\(([^)]+)\)\s*:/g, 'control_repeat_until($1)');

    // Event decorators
    processed = processed.replace(/@on_green_flag/g, 'event_whenflagclicked()');
    processed = processed.replace(/@on_key\(([^)]+)\)/g, 'event_whenkeypressed($1)');
    processed = processed.replace(/@on_sprite_clicked/g, 'event_whenthisspriteclicked()');
    processed = processed.replace(/@on_backdrop\(([^)]+)\)/g, 'event_whenbackdropswitchesto($1)');
    processed = processed.replace(/@on_greater_than\(([^,]+),\s*([^)]+)\)/g, 'event_whengreaterthan($1, $2)');
    processed = processed.replace(/@on_receive\(([^)]+)\)/g, 'event_whenbroadcastreceived($1)');

    // Custom Procedure Definition decorator
    processed = processed.replace(/@def_block\(([^)]+)\)/g, 'procedures_definition($1)');

    // Core Motion
    processed = processed.replace(/motion\.move_steps/g, 'motion_movesteps');
    processed = processed.replace(/motion\.turn_right/g, 'motion_turnright');
    processed = processed.replace(/motion\.turn_left/g, 'motion_turnleft');
    processed = processed.replace(/motion\.go_to_xy/g, 'motion_gotoxy');
    processed = processed.replace(/motion\.go_to/g, 'motion_goto');
    processed = processed.replace(/motion\.glide_secs_to_xy/g, 'motion_glidesecstoxy');
    processed = processed.replace(/motion\.glide_to/g, 'motion_glideto');
    processed = processed.replace(/motion\.point_in_direction/g, 'motion_pointindirection');
    processed = processed.replace(/motion\.point_towards/g, 'motion_pointtowards');
    processed = processed.replace(/motion\.change_x_by/g, 'motion_changexby');
    processed = processed.replace(/motion\.set_x/g, 'motion_setx');
    processed = processed.replace(/motion\.change_y_by/g, 'motion_changeyby');
    processed = processed.replace(/motion\.set_y/g, 'motion_sety');
    processed = processed.replace(/motion\.if_on_edge_bounce/g, 'motion_ifonedgebounce');
    processed = processed.replace(/motion\.set_rotation_style/g, 'motion_setrotationstyle');

    // Core Looks
    processed = processed.replace(/looks\.say_for_secs/g, 'looks_sayforsecs');
    processed = processed.replace(/looks\.say/g, 'looks_say');
    processed = processed.replace(/looks\.think_for_secs/g, 'looks_thinkforsecs');
    processed = processed.replace(/looks\.think/g, 'looks_think');
    processed = processed.replace(/looks\.switch_costume/g, 'looks_switchcostumeto');
    processed = processed.replace(/looks\.next_costume/g, 'looks_nextcostume');
    processed = processed.replace(/looks\.switch_backdrop/g, 'looks_switchbackdropto');
    processed = processed.replace(/looks\.next_backdrop/g, 'looks_nextbackdrop');
    processed = processed.replace(/looks\.change_size_by/g, 'looks_changesizeby');
    processed = processed.replace(/looks\.set_size_to/g, 'looks_setsizeto');
    processed = processed.replace(/looks\.change_effect_by/g, 'looks_changeeffectby');
    processed = processed.replace(/looks\.set_effect_to/g, 'looks_seteffectto');
    processed = processed.replace(/looks\.clear_effects/g, 'looks_cleareffects');
    processed = processed.replace(/looks\.show/g, 'looks_show');
    processed = processed.replace(/looks\.hide/g, 'looks_hide');
    processed = processed.replace(/looks\.go_to_front_back/g, 'looks_gotofrontback');
    processed = processed.replace(/looks\.go_forward_backward_layers/g, 'looks_goforwardbackwardlayers');

    // Core Sound
    processed = processed.replace(/sound\.play_until_done/g, 'sound_playuntildone');
    processed = processed.replace(/sound\.play/g, 'sound_play');
    processed = processed.replace(/sound\.change_effect_by/g, 'sound_changeeffectby');
    processed = processed.replace(/sound\.set_effect_to/g, 'sound_seteffectto');
    processed = processed.replace(/sound\.change_volume_by/g, 'sound_changevolumeby');
    processed = processed.replace(/sound\.set_volume_to/g, 'sound_setvolumeto');

    // Core Control
    processed = processed.replace(/control\.wait_until/g, 'control_wait_until');
    processed = processed.replace(/control\.wait/g, 'control_wait');
    processed = processed.replace(/control\.repeat_until/g, 'control_repeat_until');
    processed = processed.replace(/control\.repeat/g, 'control_repeat');
    processed = processed.replace(/control\.stop/g, 'control_stop');
    processed = processed.replace(/control\.create_clone_of/g, 'control_create_clone_of');
    processed = processed.replace(/control\.delete_this_clone/g, 'control_delete_this_clone');

    // Core Sensing
    processed = processed.replace(/sensing\.touching_object/g, 'sensing_touchingobject');
    processed = processed.replace(/sensing\.touching_color/g, 'sensing_touchingcolor');
    processed = processed.replace(/sensing\.color_is_touching_color/g, 'sensing_coloristouchingcolor');
    processed = processed.replace(/sensing\.distance_to/g, 'sensing_distanceto');
    processed = processed.replace(/sensing\.ask_and_wait/g, 'sensing_askandwait');
    processed = processed.replace(/sensing\.answer/g, 'sensing_answer');
    processed = processed.replace(/sensing\.key_pressed/g, 'sensing_keypressed');
    processed = processed.replace(/sensing\.mouse_down/g, 'sensing_mousedown');
    processed = processed.replace(/sensing\.mouse_x/g, 'sensing_mousex');
    processed = processed.replace(/sensing\.mouse_y/g, 'sensing_mousey');
    processed = processed.replace(/sensing\.loudness/g, 'sensing_loudness');
    processed = processed.replace(/sensing\.timer/g, 'sensing_timer');
    processed = processed.replace(/sensing\.reset_timer/g, 'sensing_resettimer');
    processed = processed.replace(/sensing\.of/g, 'sensing_of');
    processed = processed.replace(/sensing\.current/g, 'sensing_current');
    processed = processed.replace(/sensing\.days_since_2000/g, 'sensing_dayssince2000');
    processed = processed.replace(/sensing\.username/g, 'sensing_username');

    // Core Operators
    processed = processed.replace(/operator\.add/g, 'operator_add');
    processed = processed.replace(/operator\.subtract/g, 'operator_subtract');
    processed = processed.replace(/operator\.multiply/g, 'operator_multiply');
    processed = processed.replace(/operator\.divide/g, 'operator_divide');
    processed = processed.replace(/operator\.random/g, 'operator_random');
    processed = processed.replace(/operator\.gt/g, 'operator_gt');
    processed = processed.replace(/operator\.lt/g, 'operator_lt');
    processed = processed.replace(/operator\.equals/g, 'operator_equals');
    processed = processed.replace(/operator\.and/g, 'operator_and');
    processed = processed.replace(/operator\.or/g, 'operator_or');
    processed = processed.replace(/operator\.not/g, 'operator_not');
    processed = processed.replace(/operator\.join/g, 'operator_join');
    processed = processed.replace(/operator\.letter_of/g, 'operator_letter_of');
    processed = processed.replace(/operator\.length/g, 'operator_length');
    processed = processed.replace(/operator\.contains/g, 'operator_contains');
    processed = processed.replace(/operator\.mod/g, 'operator_mod');
    processed = processed.replace(/operator\.round/g, 'operator_round');
    processed = processed.replace(/operator\.mathop/g, 'operator_mathop');

    // Generic Custom Decorators (e.g. @music.whenPlayDrum(1) -> music.whenPlayDrum(1))
    processed = processed.replace(/@([a-zA-Z0-9_.]+)\(([^)]*)\)/g, '$1($2)');
    processed = processed.replace(/@([a-zA-Z0-9_.]+)/g, '$1()');

    // Remove function wrapper definitions
    processed = processed.replace(/^\s*def\s+\w+\s*\([^)]*\)\s*:/gm, '');

    return processed;
};

function parseExpression (str) {
    str = str.trim();
    if (!str) return null;

    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        return {type: 'string', value: str.substring(1, str.length - 1)};
    }

    if (str.startsWith('#') && str.length === 7) {
        return {type: 'color', value: str};
    }

    if (str === 'true' || str === 'false') {
        return {type: 'boolean', value: str === 'true'};
    }

    if (!isNaN(str) && !isNaN(parseFloat(str))) {
        return {type: 'number', value: parseFloat(str)};
    }

    const parenIndex = str.indexOf('(');
    if (parenIndex !== -1 && str.endsWith(')')) {
        let name = str.substring(0, parenIndex).trim();
        const innerStr = str.substring(parenIndex + 1, str.length - 1).trim();
        const args = parseArguments(innerStr);
        name = normalizeOpcode(name);
        if ((name === 'looks.say' || name === 'looks_say') && args.length === 2) {
            name = 'looks_sayforsecs';
        }
        return {type: 'call', opcode: name, args: args};
    }

    return {type: 'variable', name: str};
}

function parseArguments (str) {
    if (!str) return [];
    const args = [];
    let depth = 0;
    let inQuote = false;
    let quoteChar = null;
    let currentArg = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (inQuote) {
            if (char === quoteChar && str[i - 1] !== '\\') {
                inQuote = false;
            }
            currentArg += char;
        } else if (char === '"' || char === "'") {
            inQuote = true;
            quoteChar = char;
            currentArg += char;
        } else if (char === '(') {
            depth++;
            currentArg += char;
        } else if (char === ')') {
            depth--;
            currentArg += char;
        } else if (char === ',' && depth === 0) {
            args.push(parseExpression(currentArg));
            currentArg = '';
        } else {
            currentArg += char;
        }
    }
    if (currentArg.trim()) {
        args.push(parseExpression(currentArg));
    }
    return args;
}

function parsePseudoCode (code) {
    const preprocessed = preprocessPythonicCode(code);
    const lines = preprocessed.split('\n');
    const rootNodes = [];
    const stack = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
            continue;
        }

        const indent = line.length - line.trimStart().length;

        let opcode = trimmed;
        let argsStr = '';
        const parenIndex = trimmed.indexOf('(');
        if (parenIndex !== -1 && trimmed.endsWith(')')) {
            opcode = trimmed.substring(0, parenIndex).trim();
            argsStr = trimmed.substring(parenIndex + 1, trimmed.length - 1).trim();
        }

        const args = parseArguments(argsStr);
        opcode = normalizeOpcode(opcode);
        if ((opcode === 'looks.say' || opcode === 'looks_say') && args.length === 2) {
            opcode = 'looks_sayforsecs';
        }
        const node = new ParseNode(opcode, args, indent);

        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        if (stack.length > 0) {
            stack[stack.length - 1].children.push(node);
        } else {
            rootNodes.push(node);
        }

        stack.push(node);
    }

    function linkSiblings (nodes) {
        for (let i = 0; i < nodes.length; i++) {
            nodes[i].next = null; // Reset first
            if (i < nodes.length - 1) {
                const nextOp = nodes[i + 1].opcode;
                if (!HatOpcodes.includes(nextOp) && nextOp !== 'procedures_definition') {
                    nodes[i].next = nodes[i + 1];
                }
            }
            linkSiblings(nodes[i].children);
        }
    }

    function associateElseBlocks (nodes) {
        const result = [];
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            node.children = associateElseBlocks(node.children);
            if ((node.opcode === 'control_if' || node.opcode === 'control_if_else') && i < nodes.length - 1 && nodes[i + 1].opcode === 'else') {
                const elseNode = nodes[i + 1];
                node.opcode = 'control_if_else';
                node.elseChildren = associateElseBlocks(elseNode.children);
                node.elseChildren.forEach(c => {
                    c.indent = node.indent + 2;
                });
                i++;
            }
            result.push(node);
        }
        return result;
    }

    const finalNodes = associateElseBlocks(rootNodes);
    linkSiblings(finalNodes);

    return finalNodes;
}

function lookupOrCreateVariable (target, name, type = '', forceGlobal = false) {
    if (forceGlobal) {
        const stage = target.runtime.getTargetForStage();
        let variable = stage.lookupVariableByNameAndType(name, type);
        if (!variable) {
            const id = `${type === 'list' ? 'list' : 'var'}_${randomId()}`;
            stage.createVariable(id, name, type, false);
            variable = stage.lookupVariableById(id);
        }
        return variable;
    }
    
    let localVariable = null;
    for (const id in target.variables) {
        const v = target.variables[id];
        if (v.name === name && v.type === type) {
            localVariable = v;
            break;
        }
    }
    if (localVariable) {
        return localVariable;
    }

    const id = `${type === 'list' ? 'list' : 'var'}_${randomId()}`;
    target.createVariable(id, name, type, false);
    return target.lookupVariableById(id);
}

function getBlockParams (opcode, target) {
    if (BlockParams[opcode]) {
        return BlockParams[opcode];
    }

    const runtime = target.runtime;
    if (runtime && runtime._blockInfo) {
        for (const category of runtime._blockInfo) {
            const catId = category.id;
            const blocks = category.blocks || [];
            for (const block of blocks) {
                if (!block.info || !block.info.opcode) continue;
                const blockOp = `${catId}_${block.info.opcode}`;
                if (blockOp === opcode) {
                    const text = block.info.text || '';
                    const argNames = [];
                    const regex = /\[([^\]]+)\]/g;
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        argNames.push(match[1]);
                    }
                    return argNames.map(name => ({
                        name: name,
                        type: 'input'
                    }));
                }
            }
        }
    }
    return null;
}

function isHatBlock (opcode, target) {
    if (HatOpcodes.includes(opcode) || opcode === 'procedures_definition') {
        return true;
    }
    const runtime = target.runtime;
    if (runtime && runtime._blockInfo) {
        for (const category of runtime._blockInfo) {
            const catId = category.id;
            const blocks = category.blocks || [];
            for (const block of blocks) {
                if (!block.info || !block.info.opcode) continue;
                const blockOp = `${catId}_${block.info.opcode}`;
                if (blockOp === opcode) {
                    return block.info.blockType === 'hat' || block.info.blockType === 'event';
                }
            }
        }
    }
    return false;
}

function preRegisterAssets (target, nodes) {
    function traverseExpression (expr) {
        if (!expr) return;
        if (expr.type === 'variable') {
            lookupOrCreateVariable(target, expr.name, '');
        } else if (expr.type === 'call') {
            const op = expr.opcode;
            if (op === 'data.get_global_var') {
                const nameArg = expr.args[0];
                if (nameArg) lookupOrCreateVariable(target, nameArg.value || nameArg.name, '', true);
            } else if (op === 'data.get_local_var') {
                const nameArg = expr.args[0];
                if (nameArg) lookupOrCreateVariable(target, nameArg.value || nameArg.name, '', false);
            } else if (op === 'data.get_global_list') {
                const nameArg = expr.args[0];
                if (nameArg) lookupOrCreateVariable(target, nameArg.value || nameArg.name, 'list', true);
            } else if (op === 'data.get_local_list') {
                const nameArg = expr.args[0];
                if (nameArg) lookupOrCreateVariable(target, nameArg.value || nameArg.name, 'list', false);
            } else {
                expr.args.forEach(traverseExpression);
            }
        }
    }

    function traverseNode (node) {
        const op = node.opcode;
        
        if (op === 'data.set_global_var' || op === 'data.change_global_var' || op === 'data.show_global_var' || op === 'data.hide_global_var') {
            const varArg = node.args[0];
            if (varArg) {
                const name = varArg.value || varArg.name;
                lookupOrCreateVariable(target, name, '', true);
            }
        } else if (op === 'data.set_local_var' || op === 'data.change_local_var' || op === 'data.show_local_var' || op === 'data.hide_local_var') {
            const varArg = node.args[0];
            if (varArg) {
                const name = varArg.value || varArg.name;
                lookupOrCreateVariable(target, name, '', false);
            }
        } else {
            let listArg = null;
            let isGlobal = false;
            
            if (op === 'data.delete_all_of_global_list' || op === 'data.length_of_global_list' || op === 'data.show_global_list' || op === 'data.hide_global_list' || op === 'data.list_contains_global_item') {
                listArg = node.args[0];
                isGlobal = true;
            } else if (op === 'data.add_to_global_list' || op === 'data.delete_of_global_list' || op === 'data.item_of_global_list' || op === 'data.item_num_of_global_list' || op === 'data.replace_item_of_global_list') {
                listArg = node.args[1];
                isGlobal = true;
            } else if (op === 'data.insert_at_global_list') {
                listArg = node.args[2];
                isGlobal = true;
            }
            
            if (op === 'data.delete_all_of_local_list' || op === 'data.length_of_local_list' || op === 'data.show_local_list' || op === 'data.hide_local_list' || op === 'data.list_contains_local_item') {
                listArg = node.args[0];
            } else if (op === 'data.add_to_local_list' || op === 'data.delete_of_local_list' || op === 'data.item_of_local_list' || op === 'data.item_num_of_local_list' || op === 'data.replace_item_of_local_list') {
                listArg = node.args[1];
            } else if (op === 'data.insert_at_local_list') {
                listArg = node.args[2];
            }
            
            if (listArg) {
                const name = listArg.value || listArg.name;
                lookupOrCreateVariable(target, name, 'list', isGlobal);
            }
        }

        node.args.forEach(traverseExpression);
        node.children.forEach(traverseNode);
    }

    nodes.forEach(traverseNode);
}

function compileExpression (expr, target, blocksObj, parentId) {
    const exprId = `expr_${randomId()}`;
    
    if (expr.type === 'number') {
        blocksObj[exprId] = {
            id: exprId,
            opcode: 'math_number',
            inputs: {},
            fields: {
                NUM: {name: 'NUM', value: String(expr.value)}
            },
            next: null,
            topLevel: false,
            parent: parentId,
            shadow: true
        };
        return exprId;
    }
    
    if (expr.type === 'string') {
        blocksObj[exprId] = {
            id: exprId,
            opcode: 'text',
            inputs: {},
            fields: {
                TEXT: {name: 'TEXT', value: expr.value}
            },
            next: null,
            topLevel: false,
            parent: parentId,
            shadow: true
        };
        return exprId;
    }
    
    if (expr.type === 'color') {
        blocksObj[exprId] = {
            id: exprId,
            opcode: 'colour_picker',
            inputs: {},
            fields: {
                COLOUR: {name: 'COLOUR', value: expr.value}
            },
            next: null,
            topLevel: false,
            parent: parentId,
            shadow: true
        };
        return exprId;
    }
    
    if (expr.type === 'boolean') {
        blocksObj[exprId] = {
            id: exprId,
            opcode: 'text',
            inputs: {},
            fields: {
                TEXT: {name: 'TEXT', value: String(expr.value)}
            },
            next: null,
            topLevel: false,
            parent: parentId,
            shadow: true
        };
        return exprId;
    }
    
    if (expr.type === 'variable') {
        // Fallback checks target variables first, then stage
        let variable = target.lookupVariableByNameAndType(expr.name, 'list');
        if (variable) {
            blocksObj[exprId] = {
                id: exprId,
                opcode: 'data_listcontents',
                inputs: {},
                fields: {
                    LIST: {name: 'LIST', id: variable.id, value: variable.name, variableType: 'list'}
                },
                next: null,
                topLevel: false,
                parent: parentId,
                shadow: false
            };
            return exprId;
        }
        
        variable = target.lookupVariableByNameAndType(expr.name, '');
        if (!variable) {
            variable = lookupOrCreateVariable(target, expr.name, '', false);
        }
        blocksObj[exprId] = {
            id: exprId,
            opcode: 'data_variable',
            inputs: {},
            fields: {
                VARIABLE: {name: 'VARIABLE', id: variable.id, value: variable.name, variableType: ''}
            },
            next: null,
            topLevel: false,
            parent: parentId,
            shadow: false
        };
        return exprId;
    }
    
    if (expr.type === 'call') {
        const op = expr.opcode;
        if (op === 'get_arg') {
            const argNameArg = expr.args[0];
            const argName = argNameArg ? (argNameArg.value || argNameArg.name) : '';
            blocksObj[exprId] = {
                id: exprId,
                opcode: 'argument_reporter_string_number',
                inputs: {},
                fields: {
                    VALUE: {name: 'VALUE', value: argName}
                },
                next: null,
                topLevel: false,
                parent: parentId,
                shadow: false
            };
            return exprId;
        }
        
        if (op === 'data.get_global_var' || op === 'data.get_local_var') {
            const nameArg = expr.args[0];
            const name = nameArg ? (nameArg.value || nameArg.name) : '';
            const forceGlobal = op === 'data.get_global_var';
            const variable = lookupOrCreateVariable(target, name, '', forceGlobal);
            blocksObj[exprId] = {
                id: exprId,
                opcode: 'data_variable',
                inputs: {},
                fields: {
                    VARIABLE: {name: 'VARIABLE', id: variable ? variable.id : name, value: name, variableType: ''}
                },
                next: null,
                topLevel: false,
                parent: parentId,
                shadow: false
            };
            return exprId;
        }
        
        if (op === 'data.get_global_list' || op === 'data.get_local_list') {
            const nameArg = expr.args[0];
            const name = nameArg ? (nameArg.value || nameArg.name) : '';
            const forceGlobal = op === 'data.get_global_list';
            const variable = lookupOrCreateVariable(target, name, 'list', forceGlobal);
            blocksObj[exprId] = {
                id: exprId,
                opcode: 'data_listcontents',
                inputs: {},
                fields: {
                    LIST: {name: 'LIST', id: variable ? variable.id : name, value: name, variableType: 'list'}
                },
                next: null,
                topLevel: false,
                parent: parentId,
                shadow: false
            };
            return exprId;
        }

        compileBlockNode(new ParseNode(expr.opcode, expr.args, 0), target, blocksObj, parentId, false, null, exprId);
        return exprId;
    }

    return null;
}

const customProceduresRegistry = {};

function registerProcedures (nodes) {
    for (const node of nodes) {
        if (node.opcode === 'procedures_definition') {
            const nameArg = node.args[0];
            if (nameArg) {
                const procName = nameArg.value || nameArg.name;
                const argNames = node.args.slice(1).map(arg => arg.value || arg.name);
                const placeholders = argNames.map(() => '%s').join(' ');
                const proccode = placeholders ? `${procName} ${placeholders}` : procName;
                const argumentids = argNames.map((_, idx) => `arg_${idx}`);
                const argumentdefaults = argNames.map(() => '');
                
                customProceduresRegistry[procName] = {
                    name: procName,
                    argumentnames: argNames,
                    argumentids: argumentids,
                    argumentdefaults: argumentdefaults,
                    proccode: proccode
                };
            }
        }
        registerProcedures(node.children);
        if (node.elseChildren) {
            registerProcedures(node.elseChildren);
        }
    }
}

function processDeclarations (target, nodes) {
    const remainingNodes = [];
    for (const node of nodes) {
        const op = node.opcode;
        if (op === 'create_var' || op === 'create_list' || op === 'Notes') {
            const nameArg = node.args[0];
            const scopeArg = node.args[1];
            if (nameArg) {
                const name = nameArg.value || nameArg.name;
                const scope = (scopeArg && (scopeArg.value || scopeArg.name)) === 'global' ? 'global' : 'local';
                const isList = op === 'create_list' || op === 'Notes';
                const type = isList ? 'list' : '';
                
                const container = (scope === 'global') ? target.runtime.getTargetForStage() : target;
                const variable = container.lookupVariableByNameAndType(name, type);
                if (!variable) {
                    const id = `${isList ? 'list' : 'var'}_${randomId()}`;
                    container.createVariable(id, name, type, false);
                }
            }
        } else {
            node.children = processDeclarations(target, node.children);
            if (node.elseChildren) {
                node.elseChildren = processDeclarations(target, node.elseChildren);
            }
            remainingNodes.push(node);
        }
    }
    
    for (let i = 0; i < remainingNodes.length; i++) {
        remainingNodes[i].next = null;
        if (i < remainingNodes.length - 1) {
            const nextOp = remainingNodes[i + 1].opcode;
            if (!HatOpcodes.includes(nextOp) && nextOp !== 'procedures_definition') {
                remainingNodes[i].next = remainingNodes[i + 1];
            }
        }
    }
    return remainingNodes;
}

function findExistingProcedureInTarget (target, name) {
    if (!target || !target.blocks) return null;
    const blocks = target.blocks._blocks || {};
    for (const id in blocks) {
        const b = blocks[id];
        if (b.opcode === 'procedures_prototype' && b.mutation) {
            const proccode = b.mutation.proccode || '';
            const procName = proccode.split(' ')[0];
            if (procName === name) {
                return {
                    name: procName,
                    argumentnames: JSON.parse(b.mutation.argumentnames || '[]'),
                    argumentids: JSON.parse(b.mutation.argumentids || '[]'),
                    proccode: proccode
                };
            }
        }
    }
    return null;
}

function compileBlockNode (node, target, blocksObj, parentId, isTopLevel, nextNode, forcedId) {
    const blockId = forcedId || (`block_${randomId()}`);
    let opcode = node.opcode;
    let nodeArgs = node.args;
    let forceGlobal = false;

    // Handle scoped variables and lists
    if (ScopedOpcodes[opcode]) {
        const meta = ScopedOpcodes[opcode];
        opcode = meta.opcode;
        forceGlobal = meta.forceGlobal;
    } else if (opcode === 'raw_block') {
        const opcodeArg = nodeArgs[0];
        if (opcodeArg) {
            opcode = opcodeArg.value || opcodeArg.name;
            nodeArgs = nodeArgs.slice(1);
        }
    } else if (opcode.includes('.')) {
        const mapped = OpcodeMapping[opcode];
        if (mapped) {
            opcode = mapped;
        } else {
            const parts = opcode.split('.');
            const ns = parts[0];
            const blockName = parts.slice(1).join('_');
            opcode = `${ns}_${blockName}`;
        }
    }

    // Handle procedure definitions
    if (opcode === 'procedures_definition') {
        const nameArg = nodeArgs[0];
        if (!nameArg) return null;
        const procName = nameArg.value || nameArg.name;
        const reg = customProceduresRegistry[procName];
        if (!reg) return null;
        
        const defId = blockId;
        const protoId = `proto_${randomId()}`;
        
        blocksObj[defId] = {
            id: defId,
            opcode: 'procedures_definition',
            inputs: {
                custom_block: {
                    name: 'custom_block',
                    block: protoId,
                    shadow: protoId
                }
            },
            fields: {},
            next: null,
            topLevel: true,
            parent: null,
            shadow: false,
            x: 100,
            y: 100
        };
        
        const protoInputs = {};
        reg.argumentids.forEach((argId, idx) => {
            const reporterId = `reporter_${randomId()}`;
            protoInputs[argId] = {
                name: argId,
                block: reporterId,
                shadow: reporterId
            };
            
            blocksObj[reporterId] = {
                id: reporterId,
                opcode: 'argument_reporter_string_number',
                inputs: {},
                fields: {
                    VALUE: {name: 'VALUE', value: reg.argumentnames[idx]}
                },
                next: null,
                parent: protoId,
                shadow: true
            };
        });
        
        blocksObj[protoId] = {
            id: protoId,
            opcode: 'procedures_prototype',
            inputs: protoInputs,
            fields: {},
            next: null,
            parent: defId,
            shadow: true,
            mutation: {
                tagName: 'mutation',
                proccode: reg.proccode,
                argumentids: JSON.stringify(reg.argumentids),
                argumentnames: JSON.stringify(reg.argumentnames),
                argumentdefaults: JSON.stringify(reg.argumentdefaults),
                warp: 'false'
            }
        };
        
        if (node.children.length > 0) {
            for (let j = 0; j < node.children.length; j++) {
                node.children[j].next = (j < node.children.length - 1) ? node.children[j + 1] : null;
            }
            const firstBodyId = `block_${randomId()}`;
            compileBlockNode(node.children[0], target, blocksObj, defId, false, null, firstBodyId);
            blocksObj[defId].next = firstBodyId;
        }
        
        return defId;
    }

    // Handle procedure calls
    if (opcode === 'call_block') {
        const procNameArg = nodeArgs[0];
        if (!procNameArg) return null;
        const procName = procNameArg.value || procNameArg.name;
        
        let reg = customProceduresRegistry[procName];
        if (!reg) {
            reg = findExistingProcedureInTarget(target, procName);
        }
        if (!reg) {
            const argNames = nodeArgs.slice(1).map((_, idx) => `arg_${idx}`);
            const placeholders = argNames.map(() => '%s').join(' ');
            reg = {
                name: procName,
                argumentnames: argNames,
                argumentids: argNames.map((_, idx) => `arg_${idx}`),
                argumentdefaults: argNames.map(() => ''),
                proccode: placeholders ? `${procName} ${placeholders}` : procName
            };
        }
        
        const callId = blockId;
        const callInputs = {};
        const valArgs = nodeArgs.slice(1);
        valArgs.forEach((valArg, idx) => {
            const argId = reg.argumentids[idx] || `arg_${idx}`;
            const inputBlockId = compileExpression(valArg, target, blocksObj, callId);
            if (inputBlockId) {
                const shadow = blocksObj[inputBlockId].shadow ? inputBlockId : null;
                callInputs[argId] = {
                    name: argId,
                    block: inputBlockId,
                    shadow: shadow
                };
            }
        });
        
        blocksObj[callId] = {
            id: callId,
            opcode: 'procedures_call',
            inputs: callInputs,
            fields: {},
            next: null,
            parent: parentId,
            shadow: false,
            mutation: {
                tagName: 'mutation',
                proccode: reg.proccode,
                argumentids: JSON.stringify(reg.argumentids),
                warp: 'false'
            }
        };
        
        if (node.next) {
            const nextBlockId = `block_${randomId()}`;
            compileBlockNode(node.next, target, blocksObj, callId, false, null, nextBlockId);
            blocksObj[callId].next = nextBlockId;
        }
        return callId;
    }

    const block = {
        id: blockId,
        opcode: opcode,
        inputs: {},
        fields: {},
        next: null,
        topLevel: isTopLevel,
        parent: parentId,
        shadow: false
    };

    if (isTopLevel) {
        block.x = 100;
        block.y = 100;
    }

    blocksObj[blockId] = block;

    const params = getBlockParams(opcode, target) || [];
    for (let i = 0; i < nodeArgs.length; i++) {
        const arg = nodeArgs[i];
        if (!arg) continue;

        const param = params[i];
        if (param) {
            if (param.type === 'field') {
                if (typeof param.varType === 'string') {
                    const name = arg.value || arg.name;
                    const variable = lookupOrCreateVariable(target, name, param.varType, forceGlobal);
                    block.fields[param.name] = {
                        name: param.name,
                        id: variable ? variable.id : name,
                        value: name,
                        variableType: param.varType
                    };
                } else {
                    block.fields[param.name] = {
                        name: param.name,
                        value: String(arg.value === (void 0) ? arg.name : arg.value)
                    };
                }
            } else {
                const inputBlockId = compileExpression(arg, target, blocksObj, blockId);
                if (inputBlockId) {
                    const shadow = blocksObj[inputBlockId].shadow ? inputBlockId : null;
                    block.inputs[param.name] = {
                        name: param.name,
                        block: inputBlockId,
                        shadow: shadow
                    };
                }
            }
        } else {
            const inputName = `ARG${i}`;
            const inputBlockId = compileExpression(arg, target, blocksObj, blockId);
            if (inputBlockId) {
                const shadow = blocksObj[inputBlockId].shadow ? inputBlockId : null;
                block.inputs[inputName] = {
                    name: inputName,
                    block: inputBlockId,
                    shadow: shadow
                };
            }
        }
    }

    if (node.children.length > 0) {
        const substackFirstNode = node.children[0];
        const substackFirstBlockId = `block_${randomId()}`;
        const hasSubstack = ['control_forever', 'control_repeat', 'control_repeat_until', 'control_if', 'control_if_else'].includes(opcode);

        if (hasSubstack) {
            if (opcode === 'control_if_else') {
                const ifChildren = node.children;
                const elseChildren = node.elseChildren || [];

                for (let j = 0; j < ifChildren.length; j++) {
                    ifChildren[j].next = (j < ifChildren.length - 1) ? ifChildren[j + 1] : null;
                }
                for (let j = 0; j < elseChildren.length; j++) {
                    elseChildren[j].next = (j < elseChildren.length - 1) ? elseChildren[j + 1] : null;
                }

                if (ifChildren.length > 0) {
                    const ifFirstId = `block_${randomId()}`;
                    compileBlockNode(ifChildren[0], target, blocksObj, blockId, false, null, ifFirstId);
                    block.inputs.SUBSTACK = {
                        name: 'SUBSTACK',
                        block: ifFirstId,
                        shadow: null
                    };
                }

                if (elseChildren.length > 0) {
                    const elseFirstId = `block_${randomId()}`;
                    compileBlockNode(elseChildren[0], target, blocksObj, blockId, false, null, elseFirstId);
                    block.inputs.SUBSTACK2 = {
                        name: 'SUBSTACK2',
                        block: elseFirstId,
                        shadow: null
                    };
                }
            } else {
                for (let j = 0; j < node.children.length; j++) {
                    node.children[j].next = (j < node.children.length - 1) ? node.children[j + 1] : null;
                }
                compileBlockNode(substackFirstNode, target, blocksObj, blockId, false, null, substackFirstBlockId);
                block.inputs.SUBSTACK = {
                    name: 'SUBSTACK',
                    block: substackFirstBlockId,
                    shadow: null
                };
            }
        } else {
            for (let j = 0; j < node.children.length; j++) {
                node.children[j].next = (j < node.children.length - 1) ? node.children[j + 1] : null;
            }
            compileBlockNode(substackFirstNode, target, blocksObj, blockId, false, null, substackFirstBlockId);
            block.next = substackFirstBlockId;
        }
    }

    if (nextNode) {
        const nextBlockId = `block_${randomId()}`;
        compileBlockNode(nextNode, target, blocksObj, blockId, false, null, nextBlockId);
        block.next = nextBlockId;
    } else if (node.next) {
        const nextBlockId = `block_${randomId()}`;
        compileBlockNode(node.next, target, blocksObj, blockId, false, null, nextBlockId);
        block.next = nextBlockId;
    }

    return blockId;
}

function decompileValue (val, target) {
    if (!val) return '""';
    const innerBlock = target.blocks.getBlock(val.block);
    if (!innerBlock) return '""';
    
    if (innerBlock.shadow) {
        if (innerBlock.opcode === 'math_number' || innerBlock.opcode === 'math_integer' || innerBlock.opcode === 'math_positive_number' || innerBlock.opcode === 'math_whole_number' || innerBlock.opcode === 'math_angle') {
            return String(innerBlock.fields.NUM.value);
        }
        if (innerBlock.opcode === 'text') {
            return JSON.stringify(innerBlock.fields.TEXT.value);
        }
        if (innerBlock.opcode === 'colour_picker') {
            return JSON.stringify(innerBlock.fields.COLOUR.value);
        }
        return '""';
    }
    
    return decompileReporterBlock(innerBlock.id, target);
}

function getDecompiledOpcodeName (block, target) {
    const opcode = block.opcode;
    const isVarBlock = ['data_setvariableto', 'data_changevariableby', 'data_showvariable', 'data_hidevariable'].includes(opcode);
    const isListBlock = [
        'data_addtolist', 'data_deleteoflist', 'data_deletealloflist', 'data_insertatlist',
        'data_replaceitemoflist', 'data_itemoflist', 'data_itemnumoflist', 'data_lengthoflist',
        'data_listcontainsitem', 'data_showlist', 'data_hidelist'
    ].includes(opcode);

    if (isVarBlock) {
        const varId = block.fields.VARIABLE ? block.fields.VARIABLE.id : null;
        const isLocal = target.variables[varId] !== void 0;
        const scope = isLocal ? 'local' : 'global';
        
        if (opcode === 'data_setvariableto') return `data.set_${scope}_var`;
        if (opcode === 'data_changevariableby') return `data.change_${scope}_var`;
        if (opcode === 'data_showvariable') return `data.show_${scope}_var`;
        if (opcode === 'data_hidevariable') return `data.hide_${scope}_var`;
    }

    if (isListBlock) {
        const listId = block.fields.LIST ? block.fields.LIST.id : null;
        const isLocal = target.variables[listId] !== void 0;
        const scope = isLocal ? 'local' : 'global';
        
        if (opcode === 'data_addtolist') return `data.add_to_${scope}_list`;
        if (opcode === 'data_deleteoflist') return `data.delete_of_${scope}_list`;
        if (opcode === 'data_deletealloflist') return `data.delete_all_of_${scope}_list`;
        if (opcode === 'data_insertatlist') return `data.insert_at_${scope}_list`;
        if (opcode === 'data_replaceitemoflist') return `data.replace_item_of_${scope}_list`;
        if (opcode === 'data_itemoflist') return `data.item_of_${scope}_list`;
        if (opcode === 'data_itemnumoflist') return `data.item_num_of_${scope}_list`;
        if (opcode === 'data_lengthoflist') return `data.length_of_${scope}_list`;
        if (opcode === 'data_listcontainsitem') return `data.list_contains_${scope}_item`;
        if (opcode === 'data_showlist') return `data.show_${scope}_list`;
        if (opcode === 'data_hidelist') return `data.hide_${scope}_list`;
    }

    return OpcodeToPythonic[opcode] || (() => {
        if (opcode.includes('_')) {
            const parts = opcode.split('_');
            return `${parts[0]}.${parts.slice(1).join('_')}`;
        }
        return opcode;
    })();
}

function decompileReporterBlock (rBlockId, target) {
    const rBlock = target.blocks.getBlock(rBlockId);
    if (!rBlock) return '""';
    
    if (rBlock.opcode === 'data_variable') {
        const varId = rBlock.fields.VARIABLE ? rBlock.fields.VARIABLE.id : null;
        const varName = rBlock.fields.VARIABLE ? rBlock.fields.VARIABLE.value : '';
        const isLocal = target.variables[varId] !== void 0;
        return `data.get_${isLocal ? 'local' : 'global'}_var(${JSON.stringify(varName)})`;
    }
    if (rBlock.opcode === 'data_listcontents') {
        const listId = rBlock.fields.LIST ? rBlock.fields.LIST.id : null;
        const listName = rBlock.fields.LIST ? rBlock.fields.LIST.value : '';
        const isLocal = target.variables[listId] !== void 0;
        return `data.get_${isLocal ? 'local' : 'global'}_list(${JSON.stringify(listName)})`;
    }
    if (rBlock.opcode === 'argument_reporter_string_number' || rBlock.opcode === 'argument_reporter_boolean') {
        return `get_arg(${JSON.stringify(rBlock.fields.VALUE.value)})`;
    }

    const rParams = getBlockParams(rBlock.opcode, target) || [];
    const rArgs = [];
    
    rParams.forEach(p => {
        if (p.type === 'field') {
            rArgs.push(rBlock.fields[p.name] ? JSON.stringify(rBlock.fields[p.name].value) : '""');
        } else {
            rArgs.push(decompileValue(rBlock.inputs[p.name], target));
        }
    });

    if (rParams.length === 0) {
        Object.keys(rBlock.inputs).forEach(inputKey => {
            rArgs.push(decompileValue(rBlock.inputs[inputKey], target));
        });
        Object.keys(rBlock.fields).forEach(fieldKey => {
            rArgs.push(JSON.stringify(rBlock.fields[fieldKey].value));
        });
    }

    const mappedOp = getDecompiledOpcodeName(rBlock, target);
    return `${mappedOp}(${rArgs.join(', ')})`;
}

function decompileBlock (blockId, target, indentLevel) {
    const block = target.blocks.getBlock(blockId);
    if (!block) return '';

    const indent = '  '.repeat(indentLevel);
    const opcode = block.opcode;
    
    // Specially handle procedure definitions
    if (opcode === 'procedures_definition') {
        const prototypeBlockId = block.inputs.custom_block ? block.inputs.custom_block.block : null;
        let lineDef = '';
        if (prototypeBlockId) {
            const protoBlock = target.blocks.getBlock(prototypeBlockId);
            if (protoBlock && protoBlock.mutation) {
                const proccode = protoBlock.mutation.proccode || '';
                const procName = proccode.split(' ')[0];
                const argNames = JSON.parse(protoBlock.mutation.argumentnames || '[]');
                const decoratorArgs = [JSON.stringify(procName), ...argNames.map(a => JSON.stringify(a))].join(', ');
                lineDef = `${indent}@def_block(${decoratorArgs})`;
            }
        }
        if (!lineDef) {
            lineDef = `${indent}@def_block("unknown")`;
        }
        
        let resultDef = lineDef;
        if (block.next) {
            resultDef += `\n${decompileBlock(block.next, target, indentLevel + 1)}`;
        }
        return resultDef;
    }

    // Specially handle procedure calls
    if (opcode === 'procedures_call') {
        const mutation = block.mutation || {};
        const proccode = mutation.proccode || '';
        const procName = proccode.split(' ')[0];
        const argIds = JSON.parse(mutation.argumentids || '[]');
        const callArgs = [JSON.stringify(procName)];
        argIds.forEach(id => {
            callArgs.push(decompileValue(block.inputs[id], target));
        });
        const lineCall = `${indent}call_block(${callArgs.join(', ')})`;
        let resultCall = lineCall;
        if (block.next) {
            resultCall += `\n${decompileBlock(block.next, target, indentLevel)}`;
        }
        return resultCall;
    }

    const params = getBlockParams(opcode, target) || [];
    const args = [];
    
    params.forEach(p => {
        if (p.type === 'field') {
            const fld = block.fields[p.name];
            args.push(fld ? JSON.stringify(fld.value) : '""');
        } else {
            args.push(decompileValue(block.inputs[p.name], target));
        }
    });

    if (params.length === 0) {
        Object.keys(block.fields).forEach(fieldKey => {
            args.push(JSON.stringify(block.fields[fieldKey].value));
        });
        Object.keys(block.inputs).forEach(inputKey => {
            if (inputKey.substring(0, 8) !== 'SUBSTACK' && inputKey !== 'custom_block') {
                args.push(decompileValue(block.inputs[inputKey], target));
            }
        });
    }

    const isHat = isHatBlock(opcode, target);
    let line = '';
    if (isHat) {
        if (opcode === 'event_whenflagclicked') {
            line = `${indent}@on_green_flag`;
        } else if (opcode === 'event_whenkeypressed') {
            line = `${indent}@on_key(${args.join(', ')})`;
        } else if (opcode === 'event_whenthisspriteclicked') {
            line = `${indent}@on_sprite_clicked`;
        } else if (opcode === 'event_whenbackdropswitchesto') {
            line = `${indent}@on_backdrop(${args.join(', ')})`;
        } else if (opcode === 'event_whengreaterthan') {
            line = `${indent}@on_greater_than(${args.join(', ')})`;
        } else if (opcode === 'event_whenbroadcastreceived') {
            line = `${indent}@on_receive(${args.join(', ')})`;
        } else {
            const mappedOp = getDecompiledOpcodeName(block, target);
            line = `${indent}@${mappedOp}(${args.join(', ')})`;
        }
    } else if (opcode === 'control_forever') {
        line = `${indent}forever:`;
    } else if (opcode === 'control_repeat') {
        line = `${indent}repeat(${args.join(', ')}):`;
    } else if (opcode === 'control_repeat_until') {
        line = `${indent}repeat_until(${args.join(', ')}):`;
    } else if (opcode === 'control_if' || opcode === 'control_if_else') {
        line = `${indent}if ${args.join(', ')}:`;
    } else if (opcode === 'else') {
        line = `${indent}else:`;
    } else {
        const mappedOp = getDecompiledOpcodeName(block, target);
        line = `${indent}${mappedOp}(${args.join(', ')})`;
        if (args.length === 0 && !opcode.includes('_')) {
            line = `${indent}${mappedOp}`;
        } else if (args.length === 0) {
            line = `${indent}${mappedOp}()`;
        }
    }

    const substacks = [];
    if (block.inputs.SUBSTACK) {
        substacks.push(decompileStack(block.inputs.SUBSTACK.block, target, indentLevel + 1));
    }
    if (block.inputs.SUBSTACK2) {
        substacks.push(decompileStack(block.inputs.SUBSTACK2.block, target, indentLevel + 1));
    }

    let result = line;
    if (substacks.length > 0) {
        result += `\n${substacks[0]}`;
        if (substacks.length > 1) {
            result += `\n${indent}else:\n${substacks[1]}`;
        }
    }

    if (isHat && block.next) {
        result += `\n${decompileBlock(block.next, target, indentLevel + 1)}`;
    } else if (block.next) {
        result += `\n${decompileBlock(block.next, target, indentLevel)}`;
    }

    return result;
}

function decompileStack (firstBlockId, target, indentLevel) {
    return decompileBlock(firstBlockId, target, indentLevel);
}

// Main compiler API
function compilePseudoCodeToTarget (code, target) {
    const rawNodes = parsePseudoCode(code);
    
    // Pass 1: Clear and build procedures registry
    Object.keys(customProceduresRegistry).forEach(k => delete customProceduresRegistry[k]);
    registerProcedures(rawNodes);
    
    // Pass 1: Parse explicit variable/list declarations and remove them from execution AST
    const nodes = processDeclarations(target, rawNodes);
    
    // Pre-register referenced variable/list assets that were not explicitly declared
    preRegisterAssets(target, nodes);

    target.blocks._blocks = {};
    target.blocks._scripts = [];
    target.blocks.resetCache();

    const linkedAsNext = new Set();
    const markLinked = node => {
        if (!node) return;
        if (node.next) {
            linkedAsNext.add(node.next);
            markLinked(node.next);
        }
        node.children.forEach(markLinked);
        if (node.elseChildren) {
            node.elseChildren.forEach(markLinked);
        }
    };

    if (nodes.length > 0) {
        nodes.forEach(markLinked);

        for (let i = 0; i < nodes.length; i++) {
            if (!linkedAsNext.has(nodes[i])) {
                const rootId = `block_${randomId()}`;
                compileBlockNode(nodes[i], target, target.blocks._blocks, null, true, null, rootId);
                target.blocks._scripts.push(rootId);
            }
        }
    }

    target.blocks.resetCache();
}

// Main decompiler API
function decompileTargetBlocks (target) {
    const decls = [];
    const isStage = target.isStage;
    const scope = isStage ? 'global' : 'local';
    
    Object.values(target.variables).forEach(v => {
        if (v && v.name) {
            if (v.type === 'list') {
                decls.push(`create_list(${JSON.stringify(v.name)}, ${JSON.stringify(scope)})`);
            } else if (v.type === '') {
                decls.push(`create_var(${JSON.stringify(v.name)}, ${JSON.stringify(scope)})`);
            }
        }
    });

    const scripts = [];
    const scriptRoots = target.blocks.getScripts();
    for (const rootId of scriptRoots) {
        const code = decompileStack(rootId, target, 0);
        if (code) scripts.push(code);
    }
    
    let result = '';
    if (decls.length > 0) {
        result += `${decls.join('\n')}\n\n`;
    }
    result += scripts.join('\n\n');
    return result;
}

export {
    parsePseudoCode,
    compilePseudoCodeToTarget,
    decompileTargetBlocks
};
