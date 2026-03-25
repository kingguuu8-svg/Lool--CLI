using System.Text.Json;

namespace LoolCLI.Launcher;

internal static class LauncherSettingsStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    private static readonly string AppDataRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "LoolCLI");

    private static readonly string SettingsPath = Path.Combine(AppDataRoot, "launcher.json");

    public static LauncherSettings Load()
    {
        try
        {
            if (!File.Exists(SettingsPath))
            {
                return new LauncherSettings();
            }

            var json = File.ReadAllText(SettingsPath);
            return JsonSerializer.Deserialize<LauncherSettings>(json, JsonOptions) ?? new LauncherSettings();
        }
        catch
        {
            return new LauncherSettings();
        }
    }

    public static void Save(LauncherSettings settings)
    {
        Directory.CreateDirectory(AppDataRoot);
        File.WriteAllText(SettingsPath, JsonSerializer.Serialize(settings, JsonOptions));
    }
}
