# Smart-X in Visual Studio

This folder contains the .NET 10 ASP.NET Core Minimal API project and solution. The dashboard is included as static files under `SmartX.Gateway.Api/wwwroot`, so you can run the whole application from Visual Studio without starting a separate frontend server.

## Install

Install Visual Studio with the **ASP.NET and web development** workload and a **.NET 10 SDK**. Use a Visual Studio release that supports targeting .NET 10. The project has no third-party NuGet dependencies.

If you want to change the React dashboard, also install Node.js 20 or later and pnpm. You do not need Node.js just to run the included dashboard.

## Open and run

1. Extract the project ZIP to a normal folder.
2. Open `visual-studio/SmartX.Gateway.sln` in Visual Studio.
3. Allow Visual Studio to restore/build the solution.
4. Select the `SmartX.Gateway.Api` launch profile and press **F5**.
5. Open `https://localhost:58690/` if the browser does not open automatically. Accept the local development certificate prompt if shown.

The home page is the Smart-X dashboard. The API is available under `/api`, for example:

- `https://localhost:58690/api/healthz`
- `https://localhost:58690/api/summary`
- `https://localhost:58690/api/commands`

## Verify Part 2 features

From the dashboard:

1. Open **Dashboard** and confirm the sensor summary, warnings, recent telemetry, recommendations, and daily operator check-in are visible.
2. Open **Command stream**, submit a pump or relay action, and confirm its status moves from queued to processing to completed.
3. Submit a critical command while a standard command is queued; the critical command is selected first.
4. Use the status/action filters and search field to narrow the command list.
5. Open **Command history** and confirm completed actions appear newest first.
6. Open **Engagement** and review the strategy and daily check-in progress. A second check-in on the same UTC date does not increase the count.
7. To test telemetry validation, send a request to `POST /api/telemetry` with an unregistered sensor ID or a low moisture value; the API returns validation errors/warnings rather than silently accepting invalid data.
8. Restart the application to confirm the sample data is recreated. This is an in-memory simulation, not persistent storage.

The project intentionally uses simulated devices and seeded data. Recommendations use a transparent history-based heuristic; an operator must choose **Apply** before a recommended command enters the queue.

## Rebuild the dashboard after editing it

The bundled `wwwroot` lets the .NET app work by itself. To refresh it after changing the React source:

1. Install Node.js 20+ and pnpm.
2. From the repository root, run `pnpm install`.
3. In PowerShell, run:

   ```powershell
   .\visual-studio\build-dashboard.ps1
   ```

4. Rebuild and run the .NET solution in Visual Studio.

## Assessment data structures

- `Dictionary<string, Sensor>` keyed by MAC address: sensor registration and duplicate detection.
- `SortedDictionary<DateTimeOffset, List<TelemetryReading>>`: time-ordered telemetry, including multiple readings at the same timestamp.
- `Queue<DeviceCommand>`: standard commands in first-in, first-out order.
- `PriorityQueue<DeviceCommand, ...>`: critical commands are selected before standard commands.
- `Stack<DeviceCommand>`: newest completed command is at the top of the history.
- `Dictionary<string, Device>`: command-capable device lookup.
- `HashSet<string>`: active alert de-duplication, daily check-in de-duplication, and idempotency tracking.

The command worker uses asynchronous waits and catches/logs unexpected errors. HTTP handlers return promptly while command processing continues in the background.
