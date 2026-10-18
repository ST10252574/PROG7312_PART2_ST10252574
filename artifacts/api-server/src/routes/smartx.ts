import { Router, type IRouter } from "express";
import {
  CreateSensorBody,
  CreateSensorResponse,
  CreateCommandBody,
  CreateCommandResponse,
  CreateEngagementCheckInBody,
  CreateSearchEventBody,
  CreateSearchEventResponse,
  GetEngagementCheckInStatusResponse,
  GetEngagementStrategyResponse,
  GetGatewaySummaryResponse,
  IngestTelemetryBody,
  IngestTelemetryResponse,
  ListActivityResponse,
  ListCommandHistoryResponse,
  ListCommandsQueryParams,
  ListCommandsResponse,
  ListDevicesResponse,
  ListRecommendationsResponse,
  ListSearchEventsQueryParams,
  ListSearchEventsResponse,
  ListSensorsResponse,
  ListTelemetryQueryParams,
  ListTelemetryResponse,
  UpdateEngagementStrategyBody,
  UpdateEngagementStrategyResponse,
  ResolveRecommendationBody,
  ResolveRecommendationParams,
  ResolveRecommendationResponse,
  ValidateTelemetryBody,
  ValidateTelemetryResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const now = () => new Date().toISOString();

type SensorRecord = {
  id: string;
  macAddress: string;
  location: string;
  category: "environmental" | "power" | "actuator";
  status: "online" | "warning" | "offline";
  lastSeen: string;
  readingsToday: number;
};

type TelemetryRecord = {
  id: string;
  sensorId: string;
  sensorLabel: string;
  metric: string;
  value: number;
  unit: string;
  recordedAt: string;
  quality: "valid" | "warning" | "rejected";
};

type ActivityRecord = {
  id: string;
  title: string;
  detail: string;
  tone: "success" | "warning" | "info";
  occurredAt: string;
};

type EngagementRecord = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: "threshold" | "disconnect" | "anomaly";
  delivery: "dashboard" | "email" | "webhook";
  updatedAt: string;
};

type DeviceRecord = {
  id: string;
  name: string;
  type: "water_pump" | "smart_relay";
  state: string;
  sensorId: string | null;
  macAddress: string | null;
};

type CommandAction =
  | "pump_start"
  | "pump_stop"
  | "relay_on"
  | "relay_off"
  | "relay_toggle";

type CommandRecord = {
  id: string;
  deviceId: string;
  deviceLabel: string;
  action: CommandAction;
  priority: "standard" | "critical";
  status: "queued" | "processing" | "completed" | "failed";
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: string | null;
  idempotencyKey: string | null;
};

type RecommendationRecord = {
  id: string;
  deviceId: string;
  deviceLabel: string;
  title: string;
  rationale: string;
  confidence: number;
  severity: "low" | "medium" | "high";
  suggestedAction: CommandAction;
  createdAt: string;
  status: "suggested" | "applied" | "dismissed";
};

type SearchEventRecord = {
  id: string;
  query: string;
  deviceId: string | null;
  occurredAt: string;
};

type CheckInRecord = {
  id: string;
  date: string;
  checkedAt: string;
};

let sensors: SensorRecord[] = [
  {
    id: "sensor-001",
    macAddress: "A4:C1:38:7F:20:11",
    location: "Cape Town / Workshop",
    category: "environmental" as const,
    status: "online" as const,
    lastSeen: now(),
    readingsToday: 148,
  },
  {
    id: "sensor-002",
    macAddress: "B8:27:EB:44:19:02",
    location: "Johannesburg / Rooftop",
    category: "power" as const,
    status: "warning" as const,
    lastSeen: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    readingsToday: 96,
  },
  {
    id: "sensor-003",
    macAddress: "D0:39:72:AA:03:8C",
    location: "Durban / Pump Room",
    category: "actuator" as const,
    status: "online" as const,
    lastSeen: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    readingsToday: 83,
  },
  {
    id: "sensor-004",
    macAddress: "58:BF:25:9E:77:41",
    location: "Pretoria / Loading Bay",
    category: "environmental" as const,
    status: "offline" as const,
    lastSeen: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    readingsToday: 12,
  },
];

let telemetry: TelemetryRecord[] = [
  {
    id: "reading-001",
    sensorId: "sensor-001",
    sensorLabel: "Cape Town / Workshop",
    metric: "Temperature",
    value: 23.4,
    unit: "°C",
    recordedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    quality: "valid" as const,
  },
  {
    id: "reading-002",
    sensorId: "sensor-002",
    sensorLabel: "Johannesburg / Rooftop",
    metric: "Power draw",
    value: 4.82,
    unit: "kW",
    recordedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    quality: "warning" as const,
  },
  {
    id: "reading-003",
    sensorId: "sensor-003",
    sensorLabel: "Durban / Pump Room",
    metric: "Flow rate",
    value: 18.7,
    unit: "L/min",
    recordedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    quality: "valid" as const,
  },
  {
    id: "reading-004",
    sensorId: "sensor-001",
    sensorLabel: "Cape Town / Workshop",
    metric: "Humidity",
    value: 51,
    unit: "%",
    recordedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    quality: "valid" as const,
  },
];

let activity: ActivityRecord[] = [
  {
    id: "activity-001",
    title: "Mesh heartbeat restored",
    detail: "Durban / Pump Room is responding within the expected interval.",
    tone: "success" as const,
    occurredAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
  {
    id: "activity-002",
    title: "Power threshold crossed",
    detail: "Johannesburg / Rooftop reported 4.82 kW against a 4.5 kW warning threshold.",
    tone: "warning" as const,
    occurredAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
  {
    id: "activity-003",
    title: "Telemetry batch accepted",
    detail: "12 readings passed schema and range validation.",
    tone: "info" as const,
    occurredAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
];

let engagementStrategy: EngagementRecord = {
  id: "strategy-001",
  name: "Proactive operator alerts",
  description:
    "Surface threshold crossings, device disconnects, and validation warnings in the dashboard so operators can respond before data quality degrades.",
  enabled: true,
  trigger: "threshold" as const,
  delivery: "dashboard" as const,
  updatedAt: now(),
};

const devices: DeviceRecord[] = [
  {
    id: "pump-001",
    name: "Durban / Water Pump",
    type: "water_pump",
    state: "paused",
    sensorId: "sensor-003",
    macAddress: "D0:39:72:AA:03:8C",
  },
  {
    id: "relay-001",
    name: "Cape Town / Smart Relay",
    type: "smart_relay",
    state: "on",
    sensorId: null,
    macAddress: "A4:C1:38:7F:20:12",
  },
];

const day = 24 * 60 * 60 * 1000;
const commandHistory: CommandRecord[] = [
  {
    id: "cmd-history-001",
    deviceId: "pump-001",
    deviceLabel: "Durban / Water Pump",
    action: "pump_start",
    priority: "standard",
    status: "completed",
    queuedAt: new Date(Date.now() - 3 * day).toISOString(),
    startedAt: new Date(Date.now() - 3 * day + 500).toISOString(),
    completedAt: new Date(Date.now() - 3 * day + 1200).toISOString(),
    result: "Simulation: water pump started successfully.",
    idempotencyKey: null,
  },
  {
    id: "cmd-history-002",
    deviceId: "pump-001",
    deviceLabel: "Durban / Water Pump",
    action: "pump_start",
    priority: "standard",
    status: "completed",
    queuedAt: new Date(Date.now() - 2 * day).toISOString(),
    startedAt: new Date(Date.now() - 2 * day + 500).toISOString(),
    completedAt: new Date(Date.now() - 2 * day + 1200).toISOString(),
    result: "Simulation: water pump started successfully.",
    idempotencyKey: null,
  },
  {
    id: "cmd-history-003",
    deviceId: "pump-001",
    deviceLabel: "Durban / Water Pump",
    action: "pump_start",
    priority: "standard",
    status: "completed",
    queuedAt: new Date(Date.now() - day).toISOString(),
    startedAt: new Date(Date.now() - day + 500).toISOString(),
    completedAt: new Date(Date.now() - day + 1200).toISOString(),
    result: "Simulation: water pump started successfully.",
    idempotencyKey: null,
  },
];
const commands: CommandRecord[] = [];
const standardCommandQueue: CommandRecord[] = [];
const criticalCommandQueue: CommandRecord[] = [];
const processedIdempotencyKeys = new Map<string, CommandRecord>();
const searchEvents: SearchEventRecord[] = [
  {
    id: "search-history-001",
    query: "water pump",
    deviceId: "pump-001",
    occurredAt: new Date(Date.now() - 3 * day).toISOString(),
  },
  {
    id: "search-history-002",
    query: "pump irrigation",
    deviceId: "pump-001",
    occurredAt: new Date(Date.now() - 2 * day).toISOString(),
  },
  {
    id: "search-history-003",
    query: "pump",
    deviceId: "pump-001",
    occurredAt: new Date(Date.now() - day).toISOString(),
  },
];
const engagementCheckIns: CheckInRecord[] = [];
const checkInDateKeys = new Set<string>();
const activeAlertKeys = new Set<string>([
  "sensor-offline:sensor-004",
  "power-threshold:sensor-002",
]);
let commandSequence = 0;
let processingCommand = false;

function utcDate(daysAgo = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

for (const daysAgo of [2, 1]) {
  const date = utcDate(daysAgo);
  engagementCheckIns.unshift({
    id: `check-in-seed-${daysAgo}`,
    date,
    checkedAt: new Date(`${date}T10:00:00.000Z`).toISOString(),
  });
  checkInDateKeys.add(date);
}

telemetry.push({
  id: "reading-005",
  sensorId: "sensor-001",
  sensorLabel: "Cape Town / Workshop",
  metric: "Moisture",
  value: 18,
  unit: "%",
  recordedAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
  quality: "warning",
});

const recommendations: RecommendationRecord[] = [];

function updateRecommendations(): void {
  const moisture = telemetry.find(
    (item) => item.metric.toLowerCase() === "moisture",
  );
  const pump = devices.find((item) => item.type === "water_pump");
  if (!moisture || !pump || moisture.value >= 20) return;
  const id = `recommendation-moisture-${moisture.sensorId}`;
  const previous = recommendations.find((item) => item.id === id);
  const matchingHistory = commandHistory.filter(
    (item) =>
      item.deviceId === pump.id &&
      item.action === "pump_start" &&
      item.status === "completed" &&
      Date.now() - Date.parse(item.completedAt ?? item.queuedAt) < 30 * day,
  ).length;
  const matchingSearches = searchEvents.filter(
    (event) =>
      (event.deviceId === pump.id || event.query.toLowerCase().includes("pump")) &&
      Date.now() - Date.parse(event.occurredAt) < 30 * day,
  ).length;
  const activeStatus = previous?.status ?? "suggested";
  const recommendation: RecommendationRecord = {
    id,
    deviceId: pump.id,
    deviceLabel: pump.name,
    title: "Moisture is below the 20% threshold",
    rationale: `The latest moisture reading is ${moisture.value}${moisture.unit}. In the last 30 days, operators searched for this pump ${matchingSearches} times and started it ${matchingHistory} times after similar low readings. This is a transparent history-based heuristic, not a guarantee; review before applying.`,
    confidence: Math.min(0.95, 0.5 + matchingHistory * 0.05 + matchingSearches * 0.05),
    severity: "medium",
    suggestedAction: "pump_start",
    createdAt: previous?.createdAt ?? now(),
    status: activeStatus,
  };
  const index = recommendations.findIndex((item) => item.id === id);
  if (index >= 0) recommendations[index] = recommendation;
  else recommendations.unshift(recommendation);
}

function getCheckInStatus() {
  const currentDate = utcDate();
  const dates = new Set(engagementCheckIns.map((item) => item.date));
  let streakStart = dates.has(currentDate) ? currentDate : utcDate(1);
  let consecutiveDays = 0;
  while (dates.has(streakStart)) {
    consecutiveDays += 1;
    const previous = new Date(`${streakStart}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    streakStart = previous.toISOString().slice(0, 10);
  }
  const weekStart = Date.now() - 7 * day;
  const status = {
    todayComplete: checkInDateKeys.has(currentDate),
    completedThisWeek: engagementCheckIns.filter(
      (item) => Date.parse(item.checkedAt) >= weekStart,
    ).length,
    consecutiveDays,
    lastCheckedInAt: engagementCheckIns[0]?.checkedAt ?? null,
    history: engagementCheckIns.slice(0, 14),
  };
  return GetEngagementCheckInStatusResponse.parse(status);
}

function queueCommand(
  input: {
    deviceId: string;
    action: CommandAction;
    priority: "standard" | "critical";
    idempotencyKey?: string;
  },
): { command: CommandRecord; duplicate: boolean } | null {
  const device = devices.find((item) => item.id === input.deviceId);
  if (!device) return null;
  if (
    (device.type === "water_pump" && !input.action.startsWith("pump_")) ||
    (device.type === "smart_relay" && !input.action.startsWith("relay_"))
  ) {
    return null;
  }
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    const existing = processedIdempotencyKeys.get(idempotencyKey);
    if (existing) return { command: existing, duplicate: true };
  }

  const command: CommandRecord = {
    id: `command-${Date.now()}-${++commandSequence}`,
    deviceId: device.id,
    deviceLabel: device.name,
    action: input.action,
    priority: input.priority,
    status: "queued",
    queuedAt: now(),
    startedAt: null,
    completedAt: null,
    result: null,
    idempotencyKey,
  };
  commands.unshift(command);
  if (idempotencyKey) processedIdempotencyKeys.set(idempotencyKey, command);
  if (input.priority === "critical") {
    criticalCommandQueue.push(command);
    criticalCommandQueue.sort((a, b) => Date.parse(a.queuedAt) - Date.parse(b.queuedAt));
  } else {
    standardCommandQueue.push(command);
  }
  return { command, duplicate: false };
}

function processNextCommand(): void {
  if (processingCommand) return;
  const command = criticalCommandQueue.shift() ?? standardCommandQueue.shift();
  if (!command) return;
  processingCommand = true;
  command.status = "processing";
  command.startedAt = now();
  setTimeout(() => {
    try {
      const device = devices.find((item) => item.id === command.deviceId);
      if (!device) {
        command.status = "failed";
        command.result = "Device is no longer registered.";
      } else {
        if (command.action === "pump_start") device.state = "running";
        if (command.action === "pump_stop") device.state = "paused";
        if (command.action === "relay_on") device.state = "on";
        if (command.action === "relay_off") device.state = "off";
        if (command.action === "relay_toggle") device.state = device.state === "on" ? "off" : "on";
        command.status = "completed";
        command.result = `Simulation: ${command.action.replaceAll("_", " ")} completed for ${device.name}.`;
      }
      command.completedAt = now();
      commandHistory.push(command);
      activity.unshift({
        id: `activity-${Date.now()}`,
        title: command.status === "completed" ? "Device command completed" : "Device command failed",
        detail: command.result ?? "The command could not be completed.",
        tone: command.status === "completed" ? "success" : "warning",
        occurredAt: now(),
      });
      activity = activity.slice(0, 50);
    } catch (error) {
      logger.error({ err: error, commandId: command.id }, "Device command processing failed");
      command.status = "failed";
      command.result = "The simulated command processor encountered an error.";
      command.completedAt = now();
      commandHistory.push(command);
    } finally {
      processingCommand = false;
      updateRecommendations();
    }
  }, 700);
}

setInterval(processNextCommand, 250);
updateRecommendations();

function validateTelemetry(input: {
  sensorId: string;
  metric: string;
  value: number;
  unit: string;
  recordedAt?: string;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sensor = sensors.find((item) => item.id === input.sensorId);

  if (!sensor) errors.push("The sensor ID is not registered.");
  if (!Number.isFinite(input.value)) errors.push("The reading value must be numeric.");
  if (input.metric.trim().length < 2) errors.push("The metric name is too short.");
  if (input.unit.trim().length < 1) errors.push("The unit is required.");
  if (input.metric.toLowerCase().includes("temperature") && (input.value < -40 || input.value > 85)) {
    warnings.push("Temperature is outside the expected operating band of -40°C to 85°C.");
  }
  if (input.metric.toLowerCase().includes("power") && input.value > 4.5) {
    warnings.push("Power draw is above the configured warning threshold.");
  }
  if (input.recordedAt && Number.isNaN(Date.parse(input.recordedAt))) {
    errors.push("The recordedAt value must be an ISO timestamp.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

router.get("/summary", (_req, res): void => {
  const accepted = telemetry.filter((item) => item.quality !== "rejected").length;
  const acceptedRate = telemetry.length === 0 ? 100 : Math.round((accepted / telemetry.length) * 100);
  const data = GetGatewaySummaryResponse.parse({
    registeredSensors: sensors.length,
    onlineSensors: sensors.filter((item) => item.status === "online").length,
    readingsToday: sensors.reduce((total, item) => total + item.readingsToday, 0),
    acceptedRate,
    alerts: activeAlertKeys.size,
    lastIngestedAt: telemetry[0]?.recordedAt ?? now(),
  });
  res.json(data);
});

router.get("/sensors", (_req, res): void => {
  res.json(ListSensorsResponse.parse(sensors));
});

router.post("/sensors", (req, res): void => {
  const parsed = CreateSensorBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid sensor registration");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const sensor = CreateSensorResponse.parse({
    id: `sensor-${String(sensors.length + 1).padStart(3, "0")}`,
    ...parsed.data,
    status: "online",
    lastSeen: now(),
    readingsToday: 0,
  });
  sensors = [sensor, ...sensors];
  activity = [
    {
      id: `activity-${Date.now()}`,
      title: "Sensor registered",
      detail: `${sensor.location} is now available to the gateway.`,
      tone: "success" as const,
      occurredAt: now(),
    },
    ...activity,
  ];
  res.status(201).json(sensor);
});

router.get("/telemetry", (req, res): void => {
  const parsed = ListTelemetryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(ListTelemetryResponse.parse(telemetry.slice(0, parsed.data.limit ?? 20)));
});

router.post("/validation", (req, res): void => {
  const parsed = ValidateTelemetryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(ValidateTelemetryResponse.parse(validateTelemetry(parsed.data)));
});

router.post("/telemetry", (req, res): void => {
  const parsed = IngestTelemetryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const validation = validateTelemetry(parsed.data);
  if (!validation.valid) {
    res.status(202).json(
      IngestTelemetryResponse.parse({
        accepted: false,
        reading: null,
        validation,
      }),
    );
    return;
  }

  const sensor = sensors.find((item) => item.id === parsed.data.sensorId);
  const reading = {
    id: `reading-${Date.now()}`,
    sensorId: parsed.data.sensorId,
    sensorLabel: sensor?.location ?? "Unknown sensor",
    metric: parsed.data.metric,
    value: parsed.data.value,
    unit: parsed.data.unit,
    recordedAt: parsed.data.recordedAt ?? now(),
    quality: validation.warnings.length > 0 ? ("warning" as const) : ("valid" as const),
  };
  telemetry = [reading, ...telemetry];
  if (sensor) {
    sensor.lastSeen = reading.recordedAt;
    sensor.readingsToday += 1;
    if (sensor.status === "offline") sensor.status = "online";
    activeAlertKeys.delete(`sensor-offline:${sensor.id}`);
  }
  if (reading.quality === "warning") {
    const alertKey = `telemetry-warning:${reading.sensorId}:${reading.metric.toLowerCase()}`;
    if (!activeAlertKeys.has(alertKey)) {
      activeAlertKeys.add(alertKey);
      activity = [
        {
          id: `activity-${Date.now()}`,
          title: "Telemetry needs review",
          detail: `${reading.metric} from ${reading.sensorLabel} crossed a warning condition.`,
          tone: "warning" as const,
          occurredAt: now(),
        },
        ...activity,
      ];
    }
  } else {
    activeAlertKeys.delete(`telemetry-warning:${reading.sensorId}:${reading.metric.toLowerCase()}`);
  }
  activity = [
    {
      id: `activity-${Date.now()}`,
      title: "Telemetry accepted",
      detail: `${reading.metric} from ${reading.sensorLabel} passed gateway validation.`,
      tone: validation.warnings.length > 0 ? ("warning" as const) : ("success" as const),
      occurredAt: now(),
    },
    ...activity,
  ];
  updateRecommendations();
  res.status(202).json(IngestTelemetryResponse.parse({ accepted: true, reading, validation }));
});

router.get("/activity", (_req, res): void => {
  res.json(ListActivityResponse.parse(activity.slice(0, 10)));
});

router.get("/devices", (_req, res): void => {
  res.json(ListDevicesResponse.parse(devices));
});

router.get("/commands", (req, res): void => {
  const parsed = ListCommandsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { status, deviceId, search } = parsed.data;
  const query = search?.trim().toLowerCase();
  const filtered = commands.filter((command) => {
    if (status && command.status !== status) return false;
    if (deviceId && command.deviceId !== deviceId) return false;
    if (
      query &&
      !`${command.deviceLabel} ${command.action} ${command.deviceId} ${command.id}`
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return true;
  });
  res.json(ListCommandsResponse.parse(filtered));
});

router.post("/commands", (req, res): void => {
  const parsed = CreateCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const queued = queueCommand(parsed.data);
  if (!queued) {
    res.status(400).json({
      error: "The device is not registered or does not support this action.",
    });
    return;
  }
  if (queued.duplicate) {
    res.status(200).json(CreateCommandResponse.parse(queued.command));
    return;
  }
  res.status(202).json(CreateCommandResponse.parse(queued.command));
});

router.get("/commands/history", (_req, res): void => {
  res.json(ListCommandHistoryResponse.parse(commandHistory.slice().reverse()));
});

router.get("/searches", (req, res): void => {
  const parsed = ListSearchEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const newestFirst = searchEvents
    .slice()
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  res.json(ListSearchEventsResponse.parse(newestFirst.slice(0, parsed.data.limit ?? 20)));
});

router.post("/searches", (req, res): void => {
  const parsed = CreateSearchEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const query = parsed.data.query.trim();
  if (query.length < 2) {
    res.status(400).json({ error: "Search queries must contain at least two non-space characters." });
    return;
  }
  const deviceId = parsed.data.deviceId ?? null;
  if (deviceId && !devices.some((device) => device.id === deviceId)) {
    res.status(400).json({ error: "The searched device is not registered." });
    return;
  }
  const searchEvent = CreateSearchEventResponse.parse({
    id: `search-${Date.now()}`,
    query,
    deviceId,
    occurredAt: now(),
  });
  searchEvents.unshift(searchEvent);
  searchEvents.splice(100);
  updateRecommendations();
  res.status(201).json(searchEvent);
});

router.get("/recommendations", (_req, res): void => {
  updateRecommendations();
  res.json(ListRecommendationsResponse.parse(recommendations));
});

router.post("/recommendations/:recommendationId/resolve", (req, res): void => {
  const params = ResolveRecommendationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ResolveRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const recommendation = recommendations.find((item) => item.id === params.data.recommendationId);
  if (!recommendation) {
    res.status(404).json({ error: "Recommendation not found." });
    return;
  }
  if (recommendation.status !== "suggested") {
    res.status(409).json({ error: "This recommendation has already been resolved." });
    return;
  }

  let command: CommandRecord | null = null;
  if (parsed.data.decision === "apply") {
    const queued = queueCommand({
      deviceId: recommendation.deviceId,
      action: recommendation.suggestedAction,
      priority: "standard",
      idempotencyKey: `recommendation:${recommendation.id}`,
    });
    if (!queued) {
      res.status(400).json({ error: "The recommended device action is no longer available." });
      return;
    }
    command = queued.command;
    recommendation.status = "applied";
  } else {
    recommendation.status = "dismissed";
  }
  recommendation.createdAt = recommendation.createdAt || now();
  activity.unshift({
    id: `activity-${Date.now()}`,
    title: parsed.data.decision === "apply" ? "Recommendation accepted" : "Recommendation dismissed",
    detail: parsed.data.decision === "apply"
      ? `${recommendation.suggestedAction.replaceAll("_", " ")} was queued for ${recommendation.deviceLabel}.`
      : `${recommendation.title} was dismissed by the operator.`,
    tone: "info",
    occurredAt: now(),
  });
  res.json(
    ResolveRecommendationResponse.parse({
      recommendation,
      command,
    }),
  );
});

router.get("/engagement/check-ins", (_req, res): void => {
  res.json(getCheckInStatus());
});

router.post("/engagement/check-ins", (req, res): void => {
  const parsed = CreateEngagementCheckInBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const date = utcDate();
  if (checkInDateKeys.has(date)) {
    res.status(200).json(getCheckInStatus());
    return;
  }
  const checkIn: CheckInRecord = {
    id: `check-in-${Date.now()}`,
    date,
    checkedAt: now(),
  };
  checkInDateKeys.add(date);
  engagementCheckIns.unshift(checkIn);
  activity.unshift({
    id: `activity-${Date.now()}`,
    title: "Daily operator review completed",
    detail: parsed.data.note?.trim() || "The operator reviewed current mesh health and pending actions.",
    tone: "success",
    occurredAt: now(),
  });
  res.status(201).json(getCheckInStatus());
});

router.get("/engagement", (_req, res): void => {
  res.json(GetEngagementStrategyResponse.parse(engagementStrategy));
});

router.put("/engagement", (req, res): void => {
  const parsed = UpdateEngagementStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  engagementStrategy = {
    ...engagementStrategy,
    ...parsed.data,
    updatedAt: now(),
  };
  res.json(UpdateEngagementStrategyResponse.parse(engagementStrategy));
});

export default router;