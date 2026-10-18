# Smart-X IoT Mesh Gateway — Part 1 and Part 2

Smart-X is a simulated IoT gateway for validating telemetry and managing command-capable devices. The application includes a React dashboard and an ASP.NET Core Minimal API package for Visual Studio. Sample readings and devices are simulated in memory; no physical sensors are required.

## Run in Visual Studio

1. Install Visual Studio with the **ASP.NET and web development** workload and a **.NET 10 SDK**. Use a Visual Studio release that supports .NET 10.
2. Extract the ZIP to a folder.
3. Open `visual-studio/SmartX.Gateway.sln`.
4. Build, then press **F5** using the `SmartX.Gateway.Api` profile.
5. Browse to `https://localhost:58690/` for the dashboard. If it is not opened automatically, use the address directly.

The API runs on the same host under `/api`. For example, visit `/api/healthz`, `/api/summary`, or `/api/commands`.

The extracted ZIP includes the built dashboard. Node.js and pnpm are only needed if you plan to edit/rebuild the React dashboard.

## Run the preview implementation

Requirements: Node.js 20+ and pnpm.

```sh
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/smartx-gateway run dev
```

The preview implementation uses a Node API server and Vite dashboard. The separate Visual Studio package is the .NET 10 submission version.

## Part 2 features

- Home, About, Dashboard, sensor, telemetry, command stream, command history, and engagement pages with responsive navigation.
- Asynchronous pump and relay command processing with standard FIFO and critical-priority queues.
- Command search and status/action filters; history is retained newest-first.
- Device controls for simulated pumps and relays.
- Explicit search-event tracking and daily review check-ins to support repeat operator engagement.
- Evidence-based recommendations using low-moisture telemetry, prior commands, and submitted device searches. Recommendations are advisory: applying one is required before a device command is queued.
- Try/catch handling around command processing and visible loading, retry, empty, and error states.

## Test checklist

With the .NET API running:

1. `GET /api/healthz` should return `{"status":"ok"}`.
2. `GET /api/summary`, `/api/sensors`, `/api/telemetry`, and `/api/devices` should return seeded simulation data.
3. In the dashboard, submit a pump or relay command. It should progress asynchronously through queued, processing, and completed.
4. Apply a recommendation and confirm the resulting command appears in the command stream and history.
5. Submit a search in the command page. Search history is listed at `GET /api/searches` and influences the explanatory recommendation evidence.
6. Complete the daily operator review once; a repeat submission during the same UTC day is idempotent.
7. `POST /api/telemetry` with an invalid sensor ID should return a validation result and not add a reading.

The gateway store resets to its seeded sample data whenever the application restarts. This matches the assignment's simulation requirement and is not intended as persistent production storage.

## Rebuild the bundled dashboard

The React source lives in `artifacts/smartx-gateway`; the .NET app serves the built copy from `visual-studio/SmartX.Gateway.Api/wwwroot`.

From the repository root, after installing Node.js 20+ and pnpm:

```powershell
pnpm install
.\visual-studio\build-dashboard.ps1
```

Then rebuild and run the solution from Visual Studio.

## Project map

- `visual-studio/` — Visual Studio solution, .NET API, background command worker, launch profile, and dashboard bundling script.
- `artifacts/smartx-gateway/` — React/Vite dashboard source.
- `artifacts/api-server/` — Node-based API used for the Replit preview.
- `lib/api-spec/` — OpenAPI contract shared by the generated API client and Zod schemas.
- `docs/part1-research.md` and `docs/Part1-Research-SmartX.docx` — Part 1 research deliverables.

For the Visual Studio setup and test steps, see [`visual-studio/README.md`](visual-studio/README.md).
