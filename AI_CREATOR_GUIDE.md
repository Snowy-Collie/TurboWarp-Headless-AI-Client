# AI Creator Integration Guide (Scratch Pseudo-code DSL)

This document is a formal specification for **External AI Agents / Large Language Models (LLMs)** integrating with this headless TurboWarp instance. Any AI agent acting as a developer must read and adhere to the guidelines, constraints, and grammar specifications defined below.

---

## 1. System Role & Context Mapping

As the programming agent, you are connected to a headless **TurboWarp (Scratch) Virtual Machine** via a local HTTP API server listening on **Port 8080** (default). 

- You do not interact with the graphical Scratch interface or complex block JSON representations directly.
- Instead, you read and write Scratch scripts using a customized **Pythonic Indentation-based Pseudo-code DSL**.
- Your execution target is the Scratch runtime, where your pseudo-code is compiled into VM-native blocks and run in real-time.

---

## 2. The 3-Step Workflow Constraint

You must strictly follow this three-step cycle when updating scripts or implementing features:

```
Step 1: Get Environment State       Step 2: Parse and Plan           Step 3: Push Full Code Overwrite
   [GET /environment]              [Analyze Sprites & Code]             [POST /blocks]
           |                                  |                                 |
           v                                  v                                 v
 Fetches targets, active           Identify targetId and code       Compile and overwrite the target
 variables, & current code.       updates needed in DSL.           sprite's entire script block.
```

### Step 1: Fetch Current Environment
Send a `GET` request to `http://localhost:8080/environment`. This returns a JSON payload detailing the current project state:
- All sprites/targets and their unique IDs (`targetId`).
- Stage configuration with `global_variables` and `global_lists`.
- Sprite targets with their own `local_variables` and `local_lists`.
- The decompiled Pythonic pseudo-code (`code` field) currently active for each sprite.

### Step 2: Read Current Sprite Code
Locate the target sprite you wish to modify from the `targets` array. Inspect its `code` field to see its existing scripts.

### Step 3: Write and Push UPDATED Code
To update a sprite's scripts, send a `POST` request to `http://localhost:8080/blocks` with the following JSON structure:
```json
{
  "targetId": "sprite_target_id",
  "code": "@on_green_flag\n    motion.move_steps(10)\n    looks.say(\"Hello!\")"
}
```

> [!IMPORTANT]
> **Strict Overwrite Rule:** Partial delta updates are illegal. The transpiler engine operates on a full-replace model. Your payload must contain the **entire block of scripts** (all event handlers, custom procedures, and variable declarations) for that sprite. Any script left out of the request will be permanently deleted from the workspace.

---

## 3. Explicit Variable & List Creation

To allocate memory assets dynamically, you should declare your variables and lists at the top of your pseudo-code script block. These declarations are intercepted and executed by the compiler to register assets in the VM memory before generating workspace blocks.

- **Create Variable:**
  `create_var("variable_name", "local" | "global")`
- **Create List:**
  `create_list("list_name", "local" | "global")`

*Note: Global scope variables/lists are registered on the Stage target, while local scope variables/lists belong to the specific sprite target.*

Example:
```python
create_var("score", "global")
create_list("inventory", "local")
```

---

## 4. Custom Procedure (My Blocks) Compilation

You can create and call reusable custom procedures (comparable to "My Blocks" in Scratch).

### 4.1 Defining a Custom Procedure
Use the `@def_block` decorator at the root indentation level (0 spaces). Nest the body blocks using a 4-space indentation:
```python
@def_block("procedure_name", "param_name_1", "param_name_2")
    # Body statements go here
    motion.move_steps(get_arg("param_name_1"))
    looks.say_for_secs(get_arg("param_name_2"), 2)
```
- **`get_arg("param_name")`**: Used inside the custom block body to access parameter values reporter blocks.

### 4.2 Calling a Custom Procedure
To invoke a defined custom procedure, use the `call_block` statement:
```python
call_block("procedure_name", arg_val_1, arg_val_2)
```

Example:
```python
@on_green_flag
    call_block("procedure_name", 50, "Moving fast!")
```

---

## 5. Indentation-based Syntax Grammar

### 5.1 Event Decorators (Hat Blocks)
Every script thread must start with one of the following decorators at the root indentation level (0 spaces):

| Decorator | Scratch Equivalent | Example |
| :--- | :--- | :--- |
| `@on_green_flag` | When Green Flag Clicked | `@on_green_flag` |
| `@on_key("keyname")` | When Key Pressed | `@on_key("space")` |
| `@on_sprite_clicked` | When This Sprite Clicked | `@on_sprite_clicked` |
| `@on_backdrop("name")` | When Backdrop Switches To | `@on_backdrop("level1")` |
| `@on_greater_than("source", val)` | When Greater Than (e.g., loudness) | `@on_greater_than("loudness", 10)` |
| `@on_receive("msg")` | When Broadcast Received | `@on_receive("game_over")` |

*Note: Custom extension hat blocks can be called dynamically using the `@namespace.block_name(...)` syntax.*

### 5.2 Control Loops and Conditionals
Loops and conditionals use a colon and nested block indentation:

- **Forever Loop:**
  ```python
  forever:
      motion.turn_right(15)
  ```
- **Repeat Loop:**
  ```python
  repeat(10):
      motion.move_steps(5)
  ```
- **Repeat Until Loop:**
  ```python
  repeat_until(sensing.touching_object("_edge_")):
      motion.move_steps(10)
  ```
- **If / Else Conditionals:**
  ```python
  if operator.gt(sensing.mouse_x(), 100):
      looks.say("Far right!")
  else:
      looks.say("Left side.")
  ```

---

## 6. Universal Dynamic Opcodes & Namespaces

The transpiler supports dynamic block resolution to compile any standard or extension blocks:

### 6.1 Namespace Resolution
Calling `namespace.block_name(args)` automatically resolves to the opcode `${namespace}_${block_name}` inside the VM.
- **Example (Standard):** `motion.move_steps(10)` -> resolves to `motion_movesteps`.
- **Example (Extension):** `music.playDrumForBeats(1, 0.25)` -> resolves to `music_playDrumForBeats`.

### 6.2 Fallback Raw Block Compilation
If a block name contains irregular syntax or belongs to a complex custom extension, you can invoke it directly by its exact VM opcode using `raw_block`:
```python
raw_block("opcode_string", arg1, arg2, ...)
```
- **Example:** `raw_block("music_playDrumForBeats", 1, 0.25)`

### 6.3 Prefix Operator Notation
All mathematical and logical operations **must** use prefix functional notation. Standard infix operators (e.g., `+`, `-`, `>`, `==`) are not supported directly by the parser.

- `operator.add(num1, num2)`
- `operator.subtract(num1, num2)`
- `operator.multiply(num1, num2)`
- `operator.divide(num1, num2)`
- `operator.random(from_val, to_val)`
- `operator.gt(val1, val2)` (Greater than)
- `operator.lt(val1, val2)` (Less than)
- `operator.equals(val1, val2)` (Equals)
- `operator.and(bool1, bool2)`
- `operator.or(bool1, bool2)`
- `operator.not(bool_val)`

### 6.4 Looks.say Auto-Translation
- `looks.say(message)`: Displays the speech bubble indefinitely.
- `looks.say(message, seconds)`: Automatically translated during compilation to `looks.say_for_secs(message, seconds)` (e.g. `looks.say("Hello", 2)` compiles to `looks_sayforsecs`). Either version is fully supported.

---

## 7. Strict Explicit Scope Variable & List Operations

To prevent scope collision bugs (e.g., when a global and local variable share the same name), generic variable/list commands are deprecated. You must always use the explicit scoped operations below:

> [!TIP]
> **Syntax Fault-Tolerance:** Dotted notation (`data.set_local_var`) is the standard syntax and must be preferred. However, the transpiler contains fault-tolerant checks that automatically convert underscore-based prefixes (e.g., `data_set_local_var(...)`) to standard dotted notation (`data.set_local_var(...)`) during compilation.

### 7.1 Global Variable Commands
- `data.set_global_var(name, value)`
- `data.change_global_var(name, value)`
- `data.show_global_var(name)`
- `data.hide_global_var(name)`
- `data.get_global_var(name)` (Used inside expressions to read a global variable)

### 7.2 Local Variable Commands
- `data.set_local_var(name, value)`
- `data.change_local_var(name, value)`
- `data.show_local_var(name)`
- `data.hide_local_var(name)`
- `data.get_local_var(name)` (Used inside expressions to read a local variable)

### 7.3 Global List Commands
- `data.add_to_global_list(item, list_name)`
- `data.delete_of_global_list(index, list_name)`
- `data.delete_all_of_global_list(list_name)`
- `data.insert_at_global_list(item, index, list_name)`
- `data.replace_item_of_global_list(index, list_name, item)`
- `data.item_of_global_list(index, list_name)`
- `data.item_num_of_global_list(item, list_name)`
- `data.length_of_global_list(list_name)`
- `data.list_contains_global_item(list_name, item)`
- `data.show_global_list(list_name)`
- `data.hide_global_list(list_name)`
- `data.get_global_list(list_name)` (Used inside expressions to read a global list contents)

### 7.4 Local List Commands
- `data.add_to_local_list(item, list_name)`
- `data.delete_of_local_list(index, list_name)`
- `data.delete_all_of_local_list(list_name)`
- `data.insert_at_local_list(item, index, list_name)`
- `data.replace_item_of_local_list(index, list_name, item)`
- `data.item_of_local_list(index, list_name)`
- `data.item_num_of_local_list(item, list_name)`
- `data.length_of_local_list(list_name)`
- `data.list_contains_local_item(list_name, item)`
- `data.show_local_list(list_name)`
- `data.hide_local_list(list_name)`
- `data.get_local_list(list_name)` (Used inside expressions to read a local list contents)

---

## 8. Complete Programming Example

Below is a complete, compliant script block demonstrating declarations, custom procedures, dynamic namespaces, and strict scope variable/list operations:

```python
create_var("score", "global")
create_var("speed", "local")
create_list("inventory", "local")

@def_block("reset_player", "start_x", "start_y")
    motion.go_to_xy(get_arg("start_x"), get_arg("start_y"))
    data.set_local_var("speed", 5)
    looks.say_for_secs("Starting state reset!", 2)

@on_green_flag
    data.set_global_var("score", 0)
    call_block("reset_player", 0, 0)
    forever:
        if sensing.key_pressed("right arrow"):
            motion.change_x_by(data.get_local_var("speed"))
            
        if sensing.touching_object("Obstacle"):
            music.playDrumForBeats(1, 0.25)
            data.change_global_var("score", -1)
            call_block("reset_player", 0, 0)
            
        if operator.lt(data.get_global_var("score"), 0):
            looks.say("Game Over!")
            control.stop("all")
```

---

## 9. Orchestration and Utilities (Dynamic Sprite Creation, Version Rollback, Selective Fetching)

To support advanced orchestration, token optimization, and version control, the local API server exposes endpoints for managing assets and version histories.

### 9.1 Dynamic Sprite & Geometry Canvas Generation
Send a `POST` request to `http://localhost:8080/api/create_sprite` with a canvas geometry blueprint:
- **Payload:**
  ```json
  {
    "name": "EnemyCircle",
    "canvasType": "circle",
    "dimensions": {
      "radius": 20
    },
    "color": "#ff0000"
  }
  ```
- **Blueprint Options:**
  - `canvasType`: `"empty"` (creates 1x1 vector space), `"circle"` (requires `radius`), or `"rect"` (requires `width` and `height`).
  - `dimensions`: Object containing `radius`, or `width` and `height`.
  - `color`: Hex color string (defaults to `#ff0000` for circle and `#0000ff` for rect).
- **Response:**
  ```json
  {
    "success": true,
    "targetId": "newly_created_sprite_id",
    "name": "EnemyCircle"
  }
  ```

### 9.2 Token-Saving Selective Fetching
When query load increases, you can request environment details without raw scripts to save tokens:
1. Call `GET http://localhost:8080/environment?includeCode=false`.
2. The targets array will omit the `code` field and instead provide `contentHash` representing the hash string of its current pseudo-code:
   ```json
   {
     "id": "sprite_id",
     "name": "EnemyCircle",
     "isStage": false,
     "contentHash": "5a2bc3f4",
     "local_variables": [],
     "local_lists": []
   }
   ```
3. Look up specific sprite pseudo-code by sending a `POST` request to `http://localhost:8080/api/get_sprite_code`:
   - **Payload:**
     ```json
     {
       "targetIds": ["sprite_id"]
     }
     ```
   - **Response:**
     ```json
     {
       "success": true,
       "codes": {
         "sprite_id": "@on_green_flag\n    motion.move_steps(10)"
       }
     }
     ```

### 9.3 Local Git-like Version Rollback
The API server automatically manages a memory rollback history. To revert a target sprite's blocks workspace to its previous state, send a `POST` request to `http://localhost:8080/api/rollback`:
- **Payload:**
  ```json
  {
    "targetId": "sprite_id"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "targetId": "sprite_id",
    "code": "@on_green_flag\n    looks.say(\"Previous State\")",
    "versionId": "v_17123456789_a3d2c"
  }
  ```

---

## 10. Multi-Window Workspace Orchestration (Electron Desktop Mode)

In Electron Desktop mode, the workstation can host multiple independent TurboWarp editor windows concurrently. Each workspace window is isolated and tracked by a unique `Window_ID`.

To interact with the environment, you must dynamically target specific windows by following this protocol:

### 10.1 Querying Open Windows
Send a `GET` request to `http://localhost:8080/api/windows` to discover the inventory of all open project windows:
- **Response:**
  ```json
  [
    {
      "windowId": "Win_171891234_abcde",
      "title": "Battlefield 2D Project",
      "targets": [
        {
          "id": "sprite_id_1",
          "name": "Player",
          "isStage": false
        }
      ]
    }
  ]
  ```

### 10.2 Window-Targeted Operations
Every API request can specify a target window using the `windowId` parameter. If omitted, the server will default to targeting the currently focused window or the single open workspace window (if only one exists). 

To ensure stability across multi-project compilation, **always** specify the targeted `windowId`:

1. **GET Environment State:**
   - URL: `GET http://localhost:8080/environment?windowId=Win_171891234_abcde`
2. **POST Mutate Code blocks:**
   - URL: `POST http://localhost:8080/api/blocks` (or `/blocks`)
   - Payload:
     ```json
     {
       "windowId": "Win_171891234_abcde",
       "targetId": "sprite_id_1",
       "code": "@on_green_flag\n    motion.move_steps(10)"
     }
     ```
3. **POST Create Sprite:**
   - URL: `POST http://localhost:8080/api/create_sprite`
   - Payload:
     ```json
     {
       "windowId": "Win_171891234_abcde",
       "name": "Projectile",
       "canvasType": "circle",
       "dimensions": { "radius": 5 }
     }
     ```
4. **POST Rollback Workspace:**
   - URL: `POST http://localhost:8080/api/rollback`
   - Payload:
     ```json
     {
       "windowId": "Win_171891234_abcde",
       "targetId": "sprite_id_1"
     }
     ```
5. **POST Control State (Run/Stop):**
   - URL: `POST http://localhost:8080/run` or `POST http://localhost:8080/stop`
   - Payload:
     ```json
     {
       "windowId": "Win_171891234_abcde"
     }
     ```
