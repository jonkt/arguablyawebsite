# AI Context & Guidelines

## Project Overview
**Name**: WeatherLight
**Type**: Electron Application (Node.js)
**Purpose**: Ambient weather visualization using Kuando Busylight.

## Technology Stack
- **Runtime**: Electron (v37.x), Node.js.
- **Language**: JavaScript (CommonJS).
- **Key Libraries**:
    - `axios`: HTTP requests.
    - `node-hid`: USB HID communication.
    - `electron`: UI/System integration.

## Filesystem Structure
- `src/main.js`: **Entry Point**. Orchestrates services.
- `src/services/`: **Core Logic**.
    - `weather-service.js`: API handling, Auto-location, `isNight` logic.
    - `busylight-service.js`: Hardware control, color mapping, pulsing.
    - `config-service.js`: Settings persistence.
- `src/settings.html` / `.js`: Settings UI (Renderer).
- `src/icon_generator.html` / `.js`: Hidden renderer for Tray icons.
- `src/color-scale.js`: Generated high-res color map.
- `lib/`: Busylight low-level driver.

## Coding Patterns & Constraints
1.  **Service Architecture**: Keep `main.js` thin. Logic goes into `src/services/`.
2.  **Context Isolation**: 
    - Renderers (`settings.html`, `icon_generator.html`) CANNOT use Node.js modules directly.
    - Use `src/preload.js` and `ipcMain`/`ipcRenderer` for all communication.
3.  **Error Handling**: 
    - Wrap API calls in `try/catch`.
    - Handle `busylight` connection errors gracefully (device might be unplugged).
4.  **Configuration**:
    - Use `configService` to get/save. DO NOT access `config.json` directly from other files.
    - Use `window.api.getSettings()` in renderers.

## Critical Rules
1.  **System Prompt Alignment**: Read `system_prompt.md` in the root. Adhere to "Expert", "Autonomous", "Thorough" personas.
2.  **No "User"**: Refer to the human as "Jon".
3.  **Testing**: 
    - **Diagnostics Mode**: Use the in-app Diagnostics Mode (Settings -> Bottom Link) to verify hardware control (Manual color/pulse) without waiting for weather events.
    - **Simulated Verification**: Run `npm start` and check logs for "Weather: ...".
4.  **Documentation**: Update `docs/ARCHITECTURE.md` if architectural changes are made.

## Common Pitfalls
-   **HID Permissions**: On Linux/macOS, udev rules are needed. On Windows, usually fine.
-   **Window Sizing**: Settings window dynamically resizes based on provider (OWM needs more space for API key). Use `window.api.resizeSettings(height)`.
-   **Zombie Processes**: Ensure `app.quit()` is called correctly on exit.
