namespace LoolCLI.Launcher;

internal static class ProjectRootResolver
{
    private static readonly string[] RootMarkers =
    {
        "start-local-app.bat",
        "start-server.bat",
        "README.md"
    };

    public static string? TryFindAutoDetectedRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (LooksLikeProjectRoot(current.FullName))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        return null;
    }

    public static string? NormalizeSelectedRoot(string candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return null;
        }

        var current = new DirectoryInfo(candidate);
        while (current != null)
        {
            if (LooksLikeProjectRoot(current.FullName))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        return null;
    }

    private static bool LooksLikeProjectRoot(string path)
    {
        return RootMarkers.All(marker => File.Exists(Path.Combine(path, marker)));
    }
}
