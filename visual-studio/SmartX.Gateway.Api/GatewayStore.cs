using System.Globalization;

namespace SmartX.Gateway.Api;

public sealed class GatewayStore
{
    private readonly object sync = new();
    private int sensorSequence = 4;
    private int readingSequence = 5;
    private int activitySequence = 3;
    private int commandSequence = 3;
    private int searchSequence = 3;
    private long prioritySequence;
    private string? processingCommandId;

    public Dictionary<string, Sensor> SensorsByMac { get; } =
        new(StringComparer.OrdinalIgnoreCase);

    public SortedDictionary<DateTimeOffset, List<TelemetryReading>> TelemetryByTime { get; } = new();

    public Dictionary<string, Device> Devices { get; } = new(StringComparer.OrdinalIgnoreCase);

    public Dictionary<string, DeviceCommand> Commands { get; } = new(StringComparer.Ordinal);

    public Queue<DeviceCommand> StandardCommandQueue { get; } = new();

    public PriorityQueue<DeviceCommand, (int Priority, long Sequence)> CriticalCommandQueue { get; } = new();

    public Stack<DeviceCommand> CommandHistory { get; } = new();

    public List<SearchEvent> SearchEvents { get; } = [];

    public Stack<EngagementCheckIn> CheckInHistory { get; } = new();

    public HashSet<string> CheckInDateKeys { get; } = new(StringComparer.Ordinal);

    public Dictionary<string, Recommendation> Recommendations { get; } = new(StringComparer.Ordinal);

    public HashSet<string> ActiveAlertKeys { get; } = new(StringComparer.OrdinalIgnoreCase);

    public HashSet<string> ProcessedIdempotencyKeys { get; } = new(StringComparer.Ordinal);

    public Dictionary<string, string> IdempotencyKeyToCommandId { get; } = new(StringComparer.Ordinal);

    public List<ActivityEvent> Activity { get; } = [];

    public EngagementStrategy Engagement { get; set; } =
        new("strategy-001", "Proactive operator alerts",
            "Surface threshold crossings, device disconnects, and validation warnings in the dashboard so operators can respond before data quality degrades.",
            true, EngagementTrigger.Threshold, EngagementDelivery.Dashboard, DateTimeOffset.UtcNow);

    public object SyncRoot => sync;

    public IReadOnlyList<Sensor> Sensors => SensorsByMac.Values.ToList();

    public IReadOnlyList<TelemetryReading> RecentTelemetry(int limit = 100) =>
        TelemetryByTime.Reverse()
            .SelectMany(pair => pair.Value.OrderByDescending(item => item.RecordedAt))
            .Take(limit)
            .ToList();

    public GatewayStore()
    {
        AddSensorSeed(new Sensor("sensor-001", "A4:C1:38:7F:20:11", "Cape Town / Workshop",
            SensorCategory.Environmental, SensorStatus.Online, DateTimeOffset.UtcNow, 148));
        AddSensorSeed(new Sensor("sensor-002", "B8:27:EB:44:19:02", "Johannesburg / Rooftop",
            SensorCategory.Power, SensorStatus.Warning, DateTimeOffset.UtcNow.AddMinutes(-7), 96));
        AddSensorSeed(new Sensor("sensor-003", "D0:39:72:AA:03:8C", "Durban / Pump Room",
            SensorCategory.Actuator, SensorStatus.Online, DateTimeOffset.UtcNow.AddMinutes(-2), 83));
        AddSensorSeed(new Sensor("sensor-004", "58:BF:25:9E:77:41", "Pretoria / Loading Bay",
            SensorCategory.Environmental, SensorStatus.Offline, DateTimeOffset.UtcNow.AddMinutes(-48), 12));

        AddTelemetrySeed(new TelemetryReading("reading-001", "sensor-001", "Cape Town / Workshop",
            "Temperature", 23.4, "°C", DateTimeOffset.UtcNow.AddMinutes(-2), ReadingQuality.Valid));
        AddTelemetrySeed(new TelemetryReading("reading-002", "sensor-002", "Johannesburg / Rooftop",
            "Power draw", 4.82, "kW", DateTimeOffset.UtcNow.AddMinutes(-4), ReadingQuality.Warning));
        AddTelemetrySeed(new TelemetryReading("reading-003", "sensor-003", "Durban / Pump Room",
            "Flow rate", 18.7, "L/min", DateTimeOffset.UtcNow.AddMinutes(-5), ReadingQuality.Valid));
        AddTelemetrySeed(new TelemetryReading("reading-004", "sensor-001", "Cape Town / Workshop",
            "Humidity", 51, "%", DateTimeOffset.UtcNow.AddMinutes(-8), ReadingQuality.Valid));
        AddTelemetrySeed(new TelemetryReading("reading-005", "sensor-001", "Cape Town / Workshop",
            "Moisture", 18, "%", DateTimeOffset.UtcNow.AddMinutes(-14), ReadingQuality.Warning));

        AddActivitySeed(new ActivityEvent("activity-001", "Mesh heartbeat restored",
            "Durban / Pump Room is responding within the expected interval.", ActivityTone.Success,
            DateTimeOffset.UtcNow.AddMinutes(-3)));
        AddActivitySeed(new ActivityEvent("activity-002", "Power threshold crossed",
            "Johannesburg / Rooftop reported 4.82 kW against a 4.5 kW warning threshold.", ActivityTone.Warning,
            DateTimeOffset.UtcNow.AddMinutes(-7)));
        AddActivitySeed(new ActivityEvent("activity-003", "Telemetry batch accepted",
            "12 readings passed schema and range validation.", ActivityTone.Info,
            DateTimeOffset.UtcNow.AddMinutes(-12)));
        ActiveAlertKeys.Add("sensor-offline:sensor-004");
        ActiveAlertKeys.Add("power-threshold:sensor-002");

        Devices["pump-001"] = new Device("pump-001", "Durban / Water Pump", "water_pump",
            "paused", "sensor-003", "D0:39:72:AA:03:8C");
        Devices["relay-001"] = new Device("relay-001", "Cape Town / Smart Relay", "smart_relay",
            "on", null, "A4:C1:38:7F:20:12");

        SeedHistoricalCommand(1, DateTimeOffset.UtcNow.AddDays(-3));
        SeedHistoricalCommand(2, DateTimeOffset.UtcNow.AddDays(-2));
        SeedHistoricalCommand(3, DateTimeOffset.UtcNow.AddDays(-1));
        SeedSearchEvent(1, "water pump", "pump-001", DateTimeOffset.UtcNow.AddDays(-3));
        SeedSearchEvent(2, "pump irrigation", "pump-001", DateTimeOffset.UtcNow.AddDays(-2));
        SeedSearchEvent(3, "pump", "pump-001", DateTimeOffset.UtcNow.AddDays(-1));
        SeedCheckIn(2);
        SeedCheckIn(1);
        RefreshRecommendations();
    }

    public string NextSensorId() => $"sensor-{Interlocked.Increment(ref sensorSequence):000}";
    public string NextReadingId() => $"reading-{Interlocked.Increment(ref readingSequence):000}";
    public string NextActivityId() => $"activity-{Interlocked.Increment(ref activitySequence):000}";
    public string NextSearchId() => $"search-{Interlocked.Increment(ref searchSequence):000}";

    public bool AddSensor(Sensor sensor)
    {
        lock (sync)
        {
            if (SensorsByMac.ContainsKey(sensor.MacAddress)) return false;
            SensorsByMac.Add(sensor.MacAddress, sensor);
            AddActivity(new ActivityEvent(NextActivityId(), "Sensor registered",
                $"{sensor.Location} is now available to the gateway.", ActivityTone.Success,
                DateTimeOffset.UtcNow));
            return true;
        }
    }

    public Sensor? FindSensor(string sensorId)
    {
        lock (sync)
        {
            return SensorsByMac.Values.FirstOrDefault(sensor => sensor.Id == sensorId);
        }
    }

    public void AddTelemetry(TelemetryReading reading)
    {
        lock (sync)
        {
            AddTelemetrySeed(reading);
            var sensor = SensorsByMac.Values.FirstOrDefault(item => item.Id == reading.SensorId);
            if (sensor is not null)
            {
                SensorsByMac[sensor.MacAddress] = sensor with
                {
                    LastSeen = reading.RecordedAt,
                    ReadingsToday = sensor.ReadingsToday + 1,
                    Status = sensor.Status == SensorStatus.Offline ? SensorStatus.Online : sensor.Status
                };
                ActiveAlertKeys.Remove($"sensor-offline:{sensor.Id}");
            }

            if (reading.Quality == ReadingQuality.Warning)
            {
                var alertKey = $"telemetry-warning:{reading.SensorId}:{reading.Metric}";
                if (ActiveAlertKeys.Add(alertKey))
                {
                    AddActivity(new ActivityEvent(NextActivityId(), "Telemetry needs review",
                        $"{reading.Metric} from {reading.SensorLabel} crossed a warning condition.",
                        ActivityTone.Warning, DateTimeOffset.UtcNow));
                }
            }
            else
            {
                ActiveAlertKeys.Remove($"telemetry-warning:{reading.SensorId}:{reading.Metric}");
            }
            RefreshRecommendations();
        }
    }

    public bool AddSearchEvent(SearchEvent searchEvent)
    {
        lock (sync)
        {
            if (searchEvent.DeviceId is not null && !Devices.ContainsKey(searchEvent.DeviceId))
                return false;
            SearchEvents.Insert(0, searchEvent);
            if (SearchEvents.Count > 100) SearchEvents.RemoveRange(100, SearchEvents.Count - 100);
            searchSequence++;
            RefreshRecommendations();
            return true;
        }
    }

    public IReadOnlyList<SearchEvent> GetSearchEvents(int limit)
    {
        lock (sync)
        {
            return SearchEvents.Take(Math.Clamp(limit, 1, 100)).ToList();
        }
    }

    public EngagementCheckInStatus GetCheckInStatus()
    {
        lock (sync)
        {
            var today = DateTime.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var todayComplete = CheckInDateKeys.Contains(today);
            var streakStart = DateOnly.FromDateTime(DateTime.UtcNow.Date);
            if (!todayComplete) streakStart = streakStart.AddDays(-1);

            var consecutiveDays = 0;
            while (CheckInDateKeys.Contains(streakStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)))
            {
                consecutiveDays++;
                streakStart = streakStart.AddDays(-1);
            }

            var weekAgo = DateTimeOffset.UtcNow.AddDays(-7);
            var history = CheckInHistory.Take(14).ToList();
            return new EngagementCheckInStatus(
                todayComplete,
                CheckInHistory.Count(item => item.CheckedAt >= weekAgo),
                consecutiveDays,
                history.FirstOrDefault()?.CheckedAt,
                history);
        }
    }

    public (EngagementCheckInStatus Status, bool Created) CompleteDailyCheckIn(string? note = null)
    {
        lock (sync)
        {
            var now = DateTimeOffset.UtcNow;
            var date = now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            if (!CheckInDateKeys.Add(date))
                return (GetCheckInStatus(), false);

            CheckInHistory.Push(new EngagementCheckIn(
                $"check-in-{now.ToUnixTimeMilliseconds()}",
                date,
                now));
            AddActivity(new ActivityEvent(NextActivityId(), "Daily operator review completed",
                string.IsNullOrWhiteSpace(note)
                    ? "The operator reviewed current mesh health and pending actions."
                    : note.Trim(),
                ActivityTone.Success, now));
            return (GetCheckInStatus(), true);
        }
    }

    public (DeviceCommand? Command, bool Duplicate, string? Error) QueueCommand(DeviceCommandInput input)
    {
        lock (sync)
        {
            if (!Devices.TryGetValue(input.DeviceId, out var device))
                return (null, false, "Device is not registered.");
            if (!IsActionCompatible(device, input.Action))
                return (null, false, "The selected device does not support this action.");
            if (input.Priority is not ("standard" or "critical"))
                return (null, false, "Priority must be standard or critical.");

            var idempotencyKey = string.IsNullOrWhiteSpace(input.IdempotencyKey)
                ? null
                : input.IdempotencyKey.Trim();
            if (idempotencyKey is not null && IdempotencyKeyToCommandId.TryGetValue(idempotencyKey, out var existingId))
            {
                return (Commands.GetValueOrDefault(existingId), true, null);
            }

            var command = new DeviceCommand(
                $"command-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Interlocked.Increment(ref commandSequence):000}",
                device.Id,
                device.Name,
                input.Action,
                input.Priority,
                "queued",
                DateTimeOffset.UtcNow,
                null,
                null,
                null,
                idempotencyKey);
            Commands[command.Id] = command;
            if (idempotencyKey is not null)
            {
                ProcessedIdempotencyKeys.Add(idempotencyKey);
                IdempotencyKeyToCommandId[idempotencyKey] = command.Id;
            }

            if (input.Priority == "critical")
                CriticalCommandQueue.Enqueue(command, (0, Interlocked.Increment(ref prioritySequence)));
            else
                StandardCommandQueue.Enqueue(command);
            return (command, false, null);
        }
    }

    public IReadOnlyList<DeviceCommand> FilterCommands(string? status, string? deviceId, string? search)
    {
        lock (sync)
        {
            var query = search?.Trim();
            return Commands.Values
                .Where(command => string.IsNullOrWhiteSpace(status) || command.Status == status)
                .Where(command => string.IsNullOrWhiteSpace(deviceId) || command.DeviceId == deviceId)
                .Where(command => string.IsNullOrWhiteSpace(query) ||
                    $"{command.DeviceLabel} {command.Action} {command.DeviceId} {command.Id}"
                        .Contains(query, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(command => command.QueuedAt)
                .ToList();
        }
    }

    public IReadOnlyList<DeviceCommand> GetCommandHistory()
    {
        lock (sync)
        {
            return CommandHistory.ToList();
        }
    }

    public bool TryStartNextCommand(out DeviceCommand? command)
    {
        lock (sync)
        {
            command = null;
            if (processingCommandId is not null) return false;

            DeviceCommand? queued;
            if (!CriticalCommandQueue.TryDequeue(out queued, out _) &&
                !StandardCommandQueue.TryDequeue(out queued))
            {
                return false;
            }
            if (queued is null) return false;

            command = queued with { Status = "processing", StartedAt = DateTimeOffset.UtcNow };
            Commands[command.Id] = command;
            processingCommandId = command.Id;
            return true;
        }
    }

    public void CompleteCommand(DeviceCommand startedCommand)
    {
        lock (sync)
        {
            if (!Commands.TryGetValue(startedCommand.Id, out var current)) return;
            if (!Devices.TryGetValue(current.DeviceId, out var device))
            {
                current = current with
                {
                    Status = "failed",
                    CompletedAt = DateTimeOffset.UtcNow,
                    Result = "Device is no longer registered."
                };
            }
            else
            {
                var newState = current.Action switch
                {
                    "pump_start" => "running",
                    "pump_stop" => "paused",
                    "relay_on" => "on",
                    "relay_off" => "off",
                    "relay_toggle" => device.State == "on" ? "off" : "on",
                    _ => device.State
                };
                Devices[device.Id] = device with { State = newState };
                current = current with
                {
                    Status = "completed",
                    CompletedAt = DateTimeOffset.UtcNow,
                    Result = $"Simulation: {current.Action.Replace('_', ' ')} completed for {device.Name}."
                };
            }

            Commands[current.Id] = current;
            CommandHistory.Push(current);
            processingCommandId = null;
            AddActivity(new ActivityEvent(NextActivityId(),
                current.Status == "completed" ? "Device command completed" : "Device command failed",
                current.Result ?? "Command processing failed.", current.Status == "completed"
                    ? ActivityTone.Success
                    : ActivityTone.Warning,
                DateTimeOffset.UtcNow));
            RefreshRecommendations();
        }
    }

    public IReadOnlyList<Recommendation> GetRecommendations()
    {
        lock (sync)
        {
            RefreshRecommendations();
            return Recommendations.Values.OrderByDescending(item => item.CreatedAt).ToList();
        }
    }

    public (Recommendation? Recommendation, DeviceCommand? Command, string? Error) ResolveRecommendation(
        string recommendationId,
        string decision)
    {
        lock (sync)
        {
            RefreshRecommendations();
            if (!Recommendations.TryGetValue(recommendationId, out var recommendation))
                return (null, null, "Recommendation not found.");
            if (recommendation.Status != "suggested")
                return (null, null, "This recommendation has already been resolved.");

            DeviceCommand? command = null;
            if (decision == "apply")
            {
                var queued = QueueCommand(new DeviceCommandInput(recommendation.DeviceId,
                    recommendation.SuggestedAction, "standard", $"recommendation:{recommendation.Id}"));
                if (queued.Command is null) return (null, null, queued.Error);
                command = queued.Command;
                recommendation = recommendation with { Status = "applied" };
            }
            else if (decision == "dismiss")
            {
                recommendation = recommendation with { Status = "dismissed" };
            }
            else
            {
                return (null, null, "Decision must be apply or dismiss.");
            }

            Recommendations[recommendation.Id] = recommendation;
            AddActivity(new ActivityEvent(NextActivityId(),
                decision == "apply" ? "Recommendation accepted" : "Recommendation dismissed",
                decision == "apply"
                    ? $"{recommendation.SuggestedAction.Replace('_', ' ')} was queued for {recommendation.DeviceLabel}."
                    : $"{recommendation.Title} was dismissed by the operator.",
                ActivityTone.Info, DateTimeOffset.UtcNow));
            return (recommendation, command, null);
        }
    }

    public void AddActivity(ActivityEvent item)
    {
        lock (sync)
        {
            Activity.Insert(0, item);
            if (Activity.Count > 100) Activity.RemoveRange(100, Activity.Count - 100);
        }
    }

    private void RefreshRecommendations()
    {
        var lowMoisture = RecentTelemetry()
            .FirstOrDefault(reading =>
                reading.Metric.Equals("Moisture", StringComparison.OrdinalIgnoreCase) &&
                reading.Value < 20);
        var pump = Devices.Values.FirstOrDefault(device => device.Type == "water_pump");
        if (lowMoisture is null || pump is null) return;

        var id = $"recommendation-moisture-{lowMoisture.SensorId}";
        var priorActions = CommandHistory.Count(command =>
            command.DeviceId == pump.Id &&
            command.Action == "pump_start" &&
            command.Status == "completed" &&
            DateTimeOffset.UtcNow - (command.CompletedAt ?? command.QueuedAt) < TimeSpan.FromDays(30));
        var matchingSearches = SearchEvents.Count(search =>
            (search.DeviceId == pump.Id || search.Query.Contains("pump", StringComparison.OrdinalIgnoreCase)) &&
            DateTimeOffset.UtcNow - search.OccurredAt < TimeSpan.FromDays(30));
        var confidence = Math.Min(0.95, 0.5 + priorActions * 0.05 + matchingSearches * 0.05);
        var previous = Recommendations.GetValueOrDefault(id);
        Recommendations[id] = new Recommendation(
            id,
            pump.Id,
            pump.Name,
            "Moisture is below the 20% threshold",
            $"The latest moisture reading is {lowMoisture.Value}{lowMoisture.Unit}. In the last 30 days, operators searched for this pump {matchingSearches} times and started it {priorActions} times after similar low readings. This is a transparent history-based heuristic, not a guarantee; review before applying.",
            confidence,
            "medium",
            "pump_start",
            previous?.CreatedAt ?? DateTimeOffset.UtcNow,
            previous?.Status ?? "suggested");
    }

    private void AddSensorSeed(Sensor sensor) => SensorsByMac[sensor.MacAddress] = sensor;

    private void AddTelemetrySeed(TelemetryReading reading)
    {
        if (!TelemetryByTime.TryGetValue(reading.RecordedAt, out var readingsAtTime))
        {
            readingsAtTime = [];
            TelemetryByTime.Add(reading.RecordedAt, readingsAtTime);
        }
        readingsAtTime.Add(reading);
    }

    private void AddActivitySeed(ActivityEvent item) => Activity.Add(item);

    private void SeedHistoricalCommand(int sequence, DateTimeOffset queuedAt)
    {
        var completedAt = queuedAt.AddMilliseconds(1200);
        var command = new DeviceCommand(
            $"cmd-history-{sequence:000}",
            "pump-001",
            "Durban / Water Pump",
            "pump_start",
            "standard",
            "completed",
            queuedAt,
            queuedAt.AddMilliseconds(500),
            completedAt,
            "Simulation: water pump started successfully.",
            null);
        Commands[command.Id] = command;
        CommandHistory.Push(command);
        commandSequence = Math.Max(commandSequence, sequence);
    }

    private void SeedSearchEvent(int sequence, string query, string deviceId, DateTimeOffset occurredAt)
    {
        SearchEvents.Insert(0, new SearchEvent(
            $"search-history-{sequence:000}",
            query,
            deviceId,
            occurredAt));
    }

    private void SeedCheckIn(int daysAgo)
    {
        var date = DateTime.UtcNow.Date.AddDays(-daysAgo).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var checkedAt = new DateTimeOffset(
            DateTime.UtcNow.Date.AddDays(-daysAgo).AddHours(10),
            TimeSpan.Zero);
        CheckInHistory.Push(new EngagementCheckIn(
            $"check-in-seed-{daysAgo}",
            date,
            checkedAt));
        CheckInDateKeys.Add(date);
    }

    private static bool IsActionCompatible(Device device, string action) =>
        device.Type switch
        {
            "water_pump" => action is "pump_start" or "pump_stop",
            "smart_relay" => action is "relay_on" or "relay_off" or "relay_toggle",
            _ => false
        };
}
