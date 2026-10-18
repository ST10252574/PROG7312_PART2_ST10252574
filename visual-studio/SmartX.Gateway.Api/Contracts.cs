namespace SmartX.Gateway.Api;

public enum SensorCategory
{
    Environmental,
    Power,
    Actuator
}

public enum SensorStatus
{
    Online,
    Warning,
    Offline
}

public enum ReadingQuality
{
    Valid,
    Warning,
    Rejected
}

public enum ActivityTone
{
    Success,
    Warning,
    Info
}

public enum EngagementTrigger
{
    Threshold,
    Disconnect,
    Anomaly
}

public enum EngagementDelivery
{
    Dashboard,
    Email,
    Webhook
}

public sealed record Sensor(
    string Id,
    string MacAddress,
    string Location,
    SensorCategory Category,
    SensorStatus Status,
    DateTimeOffset LastSeen,
    int ReadingsToday);

public sealed record SensorInput(
    string MacAddress,
    string Location,
    SensorCategory Category);

public sealed record TelemetryInput(
    string SensorId,
    string Metric,
    double Value,
    string Unit,
    DateTimeOffset? RecordedAt);

public sealed record TelemetryReading(
    string Id,
    string SensorId,
    string SensorLabel,
    string Metric,
    double Value,
    string Unit,
    DateTimeOffset RecordedAt,
    ReadingQuality Quality);

public sealed record ValidationResult(
    bool Valid,
    IReadOnlyList<string> Errors,
    IReadOnlyList<string> Warnings);

public sealed record IngestionResult(
    bool Accepted,
    TelemetryReading? Reading,
    ValidationResult Validation);

public sealed record ActivityEvent(
    string Id,
    string Title,
    string Detail,
    ActivityTone Tone,
    DateTimeOffset OccurredAt);

public sealed record GatewaySummary(
    int RegisteredSensors,
    int OnlineSensors,
    int ReadingsToday,
    double AcceptedRate,
    int Alerts,
    DateTimeOffset LastIngestedAt);

public sealed record EngagementStrategy(
    string Id,
    string Name,
    string Description,
    bool Enabled,
    EngagementTrigger Trigger,
    EngagementDelivery Delivery,
    DateTimeOffset UpdatedAt);

public sealed record EngagementStrategyInput(
    string Name,
    string Description,
    bool Enabled,
    EngagementTrigger Trigger,
    EngagementDelivery Delivery);

public sealed record Device(
    string Id,
    string Name,
    string Type,
    string State,
    string? SensorId,
    string? MacAddress);

public sealed record DeviceCommand(
    string Id,
    string DeviceId,
    string DeviceLabel,
    string Action,
    string Priority,
    string Status,
    DateTimeOffset QueuedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    string? Result,
    string? IdempotencyKey);

public sealed record DeviceCommandInput(
    string DeviceId,
    string Action,
    string Priority,
    string? IdempotencyKey);

public sealed record Recommendation(
    string Id,
    string DeviceId,
    string DeviceLabel,
    string Title,
    string Rationale,
    double Confidence,
    string Severity,
    string SuggestedAction,
    DateTimeOffset CreatedAt,
    string Status);

public sealed record RecommendationDecisionInput(string Decision);

public sealed record RecommendationDecisionResult(
    Recommendation Recommendation,
    DeviceCommand? Command);

public sealed record SearchEvent(
    string Id,
    string Query,
    string? DeviceId,
    DateTimeOffset OccurredAt);

public sealed record SearchEventInput(string Query, string? DeviceId);

public sealed record EngagementCheckIn(
    string Id,
    string Date,
    DateTimeOffset CheckedAt);

public sealed record EngagementCheckInInput(string? Note);

public sealed record EngagementCheckInStatus(
    bool TodayComplete,
    int CompletedThisWeek,
    int ConsecutiveDays,
    DateTimeOffset? LastCheckedInAt,
    IReadOnlyList<EngagementCheckIn> History);