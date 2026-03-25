using System.Text.Json.Serialization;

namespace LoolCLI.Launcher;

public sealed class LauncherSettings
{
    public string? ProjectRoot { get; set; }

    [JsonPropertyName("lastMode")]
    public string LastMode { get; set; } = "local";
}
