using System.Globalization;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

// Nur auf diesem Computer erreichbar, nicht aus dem lokalen Netzwerk.
builder.WebHost.UseUrls("http://localhost:5080");

var app = builder.Build();

// Startseite aus wwwroot/index.html bereitstellen.
app.UseDefaultFiles();
app.UseStaticFiles();

// Nur ein READ-ONLY-Endpunkt. Keine INSERT-, UPDATE- oder DELETE-Anweisungen.
app.MapGet("/api/measurements", async (IConfiguration configuration) =>
{
    string? connectionString = configuration.GetConnectionString("RoomSense");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem("ConnectionString 'RoomSense' fehlt in appsettings.json.", statusCode: 500);
    }

    const string sql = """
        SELECT TOP (2000)
            m.MeasurementID,
            mt.MeasurementTypeID,
            mt.MeasurementName,
            m.MeasurementValue,
            m.DeviceID,
            r.RoomID,
            r.RoomName,
            r.Building,
            m.[Timestamp],
            mt.[Min],
            mt.[Max]
        FROM dbo.Measurements AS m
        INNER JOIN dbo.MeasurementTypes AS mt
            ON m.MeasurementTypeID = mt.MeasurementTypeID
        INNER JOIN dbo.Devices AS d
            ON m.DeviceID = d.DeviceID
        INNER JOIN dbo.Room AS r
            ON d.RoomID = r.RoomID
        ORDER BY m.[Timestamp] DESC, m.MeasurementID DESC;
        """;

    try
    {
        var readings = new List<MeasurementDto>();

        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            readings.Add(new MeasurementDto(
                MeasurementId: reader.GetInt32(0),
                MeasurementTypeId: reader.GetInt32(1),
                MeasurementName: reader.GetString(2),
                Value: reader.IsDBNull(3) ? null : reader.GetDouble(3),
                DeviceId: reader.GetInt32(4),
                RoomId: reader.GetInt32(5),
                RoomName: reader.GetString(6),
                Building: reader.IsDBNull(7) ? null : reader.GetString(7),
                Timestamp: reader.GetDateTime(8).ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture),
                Min: reader.IsDBNull(9) ? null : reader.GetDouble(9),
                Max: reader.IsDBNull(10) ? null : reader.GetDouble(10)
            ));
        }

        return Results.Ok(readings);
    }
    catch (SqlException ex)
    {
        app.Logger.LogError(ex, "Fehler beim lesenden Zugriff auf die Datenbank IN25.");
        return Results.Problem(
            "SQL Server konnte nicht abgefragt werden. Prüfe Server, Datenbank und Windows-Berechtigungen. Details stehen im Terminal.",
            statusCode: 500);
    }
});

app.Run();

// JSON-Feldnamen werden von ASP.NET Core automatisch in camelCase ausgegeben.
public sealed record MeasurementDto(
    int MeasurementId,
    int MeasurementTypeId,
    string MeasurementName,
    double? Value,
    int DeviceId,
    int RoomId,
    string RoomName,
    string? Building,
    string Timestamp,
    double? Min,
    double? Max
);
