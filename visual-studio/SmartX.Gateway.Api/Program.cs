using System.Text.Json;
using System.Text.Json.Serialization;
using SmartX.Gateway.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});
builder.Services.AddSingleton<GatewayStore>();
builder.Services.AddHostedService<CommandProcessor>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("SmartXClient", policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors("SmartXClient");

app.MapGet("/api/healthz", Health);
app.MapGet("/api/summary", GetSummary);
app.MapGet("/api/sensors", ListSensors);
app.MapPost("/api/sensors", RegisterSensor);
app.MapGet("/api/telemetry", ListTelemetry);
app.MapPost("/api/validation", ValidateTelemetry);
app.MapPost("/api/telemetry", IngestTelemetry);
app.MapGet("/api/activity", ListActivity);
app.MapGet("/api/devices", ListDevices);
app.MapGet("/api/commands", ListCommands);
app.MapPost("/api/commands", CreateCommand);
app.MapGet("/api/commands/history", ListCommandHistory);
app.MapGet("/api/searches", ListSearchEvents);
app.MapPost("/api/searches", RecordSearchEvent);
app.MapGet("/api/recommendations", ListRecommendations);
app.MapPost("/api/recommendations/{recommendationId}/resolve", ResolveRecommendation);
app.MapGet("/api/engagement", GetEngagement);
app.MapPut("/api/engagement", UpdateEngagement);
app.MapGet("/api/engagement/check-ins", GetCheckInStatus);
app.MapPost("/api/engagement/check-ins", CreateDailyCheckIn);
app.MapFallbackToFile("index.html");

app.Run();

static IResult Health() => Results.Ok(new { status = "ok" });

static IResult GetSummary(GatewayStore store)
{
    lock (store.SyncRoot)
    {
        var telemetry = store.RecentTelemetry(1000);
        var acceptedRate = telemetry.Count == 0
            ? 100
            : Math.Round(telemetry.Count(item => item.Quality != ReadingQuality.Rejected) * 100d / telemetry.Count, 1);
        var summary = new GatewaySummary(
            store.Sensors.Count,
            store.Sensors.Count(item => item.Status == SensorStatus.Online),
            store.Sensors.Sum(item => item.ReadingsToday),
            acceptedRate,
            store.ActiveAlertKeys.Count,
            telemetry.FirstOrDefault()?.RecordedAt ?? DateTimeOffset.UtcNow);
        return Results.Ok(summary);
    }
}

static IResult ListSensors(GatewayStore store)
{
    lock (store.SyncRoot)
    {
        return Results.Ok(store.Sensors);
    }
}

static IResult RegisterSensor(SensorInput input, GatewayStore store)
{
    if (string.IsNullOrWhiteSpace(input.MacAddress) || input.MacAddress.Length < 12 ||
        string.IsNullOrWhiteSpace(input.Location))
    {
        return Results.BadRequest(new { error = "MAC address and location are required." });
    }
    var sensor = new Sensor(store.NextSensorId(), input.MacAddress.Trim(), input.Location.Trim(),
        input.Category, SensorStatus.Online, DateTimeOffset.UtcNow, 0);
    return store.AddSensor(sensor)
        ? Results.Created($"/api/sensors/{sensor.Id}", sensor)
        : Results.Conflict(new { error = "A sensor with this MAC address is already registered." });
}

static IResult ListTelemetry(int? limit, GatewayStore store)
{
    lock (store.SyncRoot)
    {
        return Results.Ok(store.RecentTelemetry(Math.Clamp(limit ?? 20, 1, 100)));
    }
}

static IResult ValidateTelemetry(TelemetryInput input, GatewayStore store) =>
    Results.Ok(Validate(input, store));

static IResult IngestTelemetry(TelemetryInput input, GatewayStore store)
{
    var validation = Validate(input, store);
    if (!validation.Valid)
        return Results.Json(new IngestionResult(false, null, validation), statusCode: StatusCodes.Status202Accepted);

    var sensor = store.FindSensor(input.SensorId);
    if (sensor is null)
        return Results.Json(new IngestionResult(false, null,
            new ValidationResult(false, ["The sensor ID is not registered."], [])),
            statusCode: StatusCodes.Status202Accepted);

    var reading = new TelemetryReading(
        store.NextReadingId(),
        sensor.Id,
        sensor.Location,
        input.Metric,
        input.Value,
        input.Unit,
        input.RecordedAt ?? DateTimeOffset.UtcNow,
        validation.Warnings.Count > 0 ? ReadingQuality.Warning : ReadingQuality.Valid);
    store.AddTelemetry(reading);
    return Results.Json(new IngestionResult(true, reading, validation), statusCode: StatusCodes.Status202Accepted);
}

static IResult ListActivity(GatewayStore store)
{
    lock (store.SyncRoot)
    {
        return Results.Ok(store.Activity.Take(10).ToList());
    }
}

static IResult ListDevices(GatewayStore store)
{
    lock (store.SyncRoot)
    {
        return Results.Ok(store.Devices.Values.ToList());
    }
}

static IResult ListCommands(string? status, string? deviceId, string? search, GatewayStore store) =>
    Results.Ok(store.FilterCommands(status, deviceId, search));

static IResult CreateCommand(DeviceCommandInput input, GatewayStore store)
{
    if (string.IsNullOrWhiteSpace(input.DeviceId) || string.IsNullOrWhiteSpace(input.Action))
        return Results.BadRequest(new { error = "Device and action are required." });

    var result = store.QueueCommand(input);
    if (result.Command is null)
        return Results.BadRequest(new { error = result.Error ?? "Command could not be queued." });
    return result.Duplicate
        ? Results.Ok(result.Command)
        : Results.Json(result.Command, statusCode: StatusCodes.Status202Accepted);
}

static IResult ListCommandHistory(GatewayStore store) =>
    Results.Ok(store.GetCommandHistory());

static IResult ListSearchEvents(int? limit, GatewayStore store) =>
    Results.Ok(store.GetSearchEvents(Math.Clamp(limit ?? 20, 1, 100)));

static IResult RecordSearchEvent(SearchEventInput input, GatewayStore store)
{
    var query = input.Query?.Trim();
    if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
        return Results.BadRequest(new { error = "Search queries must contain at least two non-space characters." });

    var searchEvent = new SearchEvent(
        store.NextSearchId(),
        query,
        string.IsNullOrWhiteSpace(input.DeviceId) ? null : input.DeviceId.Trim(),
        DateTimeOffset.UtcNow);
    return store.AddSearchEvent(searchEvent)
        ? Results.Created("/api/searches", searchEvent)
        : Results.BadRequest(new { error = "The searched device is not registered." });
}

static IResult ListRecommendations(GatewayStore store) =>
    Results.Ok(store.GetRecommendations());

static IResult ResolveRecommendation(string recommendationId, RecommendationDecisionInput input, GatewayStore store)
{
    var result = store.ResolveRecommendation(recommendationId, input.Decision);
    if (result.Recommendation is null)
    {
        if (result.Error == "Recommendation not found.")
            return Results.NotFound(new { error = result.Error });
        if (result.Error == "This recommendation has already been resolved.")
            return Results.Conflict(new { error = result.Error });
        return Results.BadRequest(new { error = result.Error ?? "Recommendation could not be resolved." });
    }
    return Results.Ok(new RecommendationDecisionResult(result.Recommendation, result.Command));
}

static IResult GetEngagement(GatewayStore store)
{
    lock (store.SyncRoot)
    {
        return Results.Ok(store.Engagement);
    }
}

static IResult UpdateEngagement(EngagementStrategyInput input, GatewayStore store)
{
    if (string.IsNullOrWhiteSpace(input.Name) || string.IsNullOrWhiteSpace(input.Description))
        return Results.BadRequest(new { error = "Name and description are required." });
    lock (store.SyncRoot)
    {
        store.Engagement = store.Engagement with
        {
            Name = input.Name.Trim(),
            Description = input.Description.Trim(),
            Enabled = input.Enabled,
            Trigger = input.Trigger,
            Delivery = input.Delivery,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        return Results.Ok(store.Engagement);
    }
}

static IResult GetCheckInStatus(GatewayStore store) =>
    Results.Ok(store.GetCheckInStatus());

static IResult CreateDailyCheckIn(EngagementCheckInInput input, GatewayStore store)
{
    var note = input.Note?.Trim();
    if (note?.Length > 300)
        return Results.BadRequest(new { error = "The check-in note must be 300 characters or fewer." });

    var result = store.CompleteDailyCheckIn(note);
    return result.Created
        ? Results.Created("/api/engagement/check-ins", result.Status)
        : Results.Ok(result.Status);
}

static ValidationResult Validate(TelemetryInput input, GatewayStore store)
{
    var errors = new List<string>();
    var warnings = new List<string>();
    var sensor = store.FindSensor(input.SensorId);

    if (sensor is null) errors.Add("The sensor ID is not registered.");
    if (!double.IsFinite(input.Value)) errors.Add("The reading value must be numeric.");
    if (string.IsNullOrWhiteSpace(input.Metric) || input.Metric.Length < 2)
        errors.Add("The metric name is too short.");
    if (string.IsNullOrWhiteSpace(input.Unit)) errors.Add("The unit is required.");
    if (input.Metric.Contains("temperature", StringComparison.OrdinalIgnoreCase) &&
        (input.Value < -40 || input.Value > 85))
        warnings.Add("Temperature is outside the expected operating band of -40°C to 85°C.");
    if (input.Metric.Contains("power", StringComparison.OrdinalIgnoreCase) && input.Value > 4.5)
        warnings.Add("Power draw is above the configured warning threshold.");
    if (input.Metric.Contains("moisture", StringComparison.OrdinalIgnoreCase) && input.Value < 20)
        warnings.Add("Moisture is below the 20% operating threshold.");
    if (input.RecordedAt.HasValue && input.RecordedAt.Value > DateTimeOffset.UtcNow.AddMinutes(5))
        warnings.Add("The timestamp is in the future and should be reviewed.");

    return new ValidationResult(errors.Count == 0, errors, warnings);
}
