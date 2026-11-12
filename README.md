# RoomSense – lokales Datenbank-Dashboard

ASP.NET Core 10, C#, Microsoft.Data.SqlClient, HTML, CSS und JavaScript.
Zeigt Messwerte aus der bereits existierenden SQL-Server-Datenbank `IN25`.
**Es gibt nur SELECT-Abfragen; das Projekt schreibt nichts in die Datenbank.**

## Voraussetzungen
- Windows 11, .NET SDK 10
- SQL Server auf localhost, Datenbank `IN25`
- Windows-Konto darf die Tabellen lesen
- Netzwerkzugang zu NuGet nur beim ersten `dotnet restore`

## Start in VS Code
1. ZIP entpacken. Den enthaltenen Ordner `RoomSenseWeb` in VS Code öffnen.
2. Terminal → neues Terminal.
3. `dotnet restore`
4. `dotnet run`
5. Browser öffnen: <http://localhost:5080>

Alternativ kann man zuerst <http://localhost:5080/api/measurements> testen:
Hier sollte ein JSON-Array mit den Datenbankwerten erscheinen.

## Konfiguration
In `appsettings.json` steht die Verbindung:

```
Server=localhost;Database=IN25;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;
```

Für eine SQL-Express-Instanz z. B. `Server=localhost\\SQLEXPRESS` (in JSON müssen Backslashes verdoppelt werden).
`TrustServerCertificate=True` ist nur als lokale Testkonfiguration gedacht.

## Struktur
- `Program.cs`: Webserver und **nur lesender** API-Endpunkt `/api/measurements`
- `appsettings.json`: SQL-Server-Verbindung
- `wwwroot/index.html`: Website
- `wwwroot/css/style.css`: Styles
- `wwwroot/js/app.js`: API-Aufruf, Statistiken, Diagramme, Raumfilter

## Hinweise
- Die API liefert die **neuesten 2000 Messungen**. Für eure 47 Testdaten reicht das aus.
- Diagramme laufen ohne externe JS-Bibliotheken (auch offline nach NuGet-Restore).
- Die Website aktualisiert sich über den Button „Daten aktualisieren“, nicht automatisch.
- Grenzen stammen aus `MeasurementTypes.Min` und `.Max`.
- Ein neues Projekt in einem separaten Ordner verhindert Änderungen an `RoomSenseDbTest`.
- Der Webserver ist nur auf `localhost:5080` gebunden. Nicht öffentlich erreichbar.
- DB-Abfragen passieren serverseitig; der Browser hat keine SQL-Zugangsdaten.
- Für den produktiven Betrieb später Windows-Berechtigungen einschränken und SQL-Zertifikat korrekt konfigurieren.
