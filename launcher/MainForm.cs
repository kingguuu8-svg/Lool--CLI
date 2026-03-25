using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;

namespace LoolCLI.Launcher;

public sealed class MainForm : Form
{
    private readonly LauncherSettings _settings;
    private readonly Label _rootValueLabel;
    private readonly Label _statusLabel;
    private readonly Button _launchLastButton;
    private readonly Button _localButton;
    private readonly Button _lanButton;
    private readonly Button _vpsButton;
    private readonly Button _desktopButton;
    private readonly Button _stopButton;
    private readonly TextBox _rootTextBox;

    public MainForm()
    {
        _settings = LauncherSettingsStore.Load();

        Text = "Lool--CLI Launcher";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(780, 420);
        Font = new Font("Segoe UI", 10F);

        var titleLabel = new Label
        {
            Text = "Lool--CLI",
            AutoSize = true,
            Font = new Font(Font.FontFamily, 20F, FontStyle.Bold),
            Location = new Point(24, 20)
        };

        var subtitleLabel = new Label
        {
            Text = "One-click Windows launcher for local, LAN, VPS, and desktop modes.",
            AutoSize = true,
            Location = new Point(26, 58)
        };

        var rootLabel = new Label
        {
            Text = "Project root",
            AutoSize = true,
            Location = new Point(26, 102)
        };

        _rootTextBox = new TextBox
        {
            ReadOnly = true,
            Location = new Point(26, 126),
            Width = 610
        };

        var browseButton = new Button
        {
            Text = "Browse...",
            Location = new Point(650, 124),
            Width = 96
        };
        browseButton.Click += (_, _) => ChooseProjectRoot();

        _rootValueLabel = new Label
        {
            AutoSize = true,
            Location = new Point(26, 160),
            ForeColor = Color.DimGray
        };

        _launchLastButton = CreateActionButton("Launch Last Mode", 26, 202, 160, (_, _) => LaunchLastMode());
        _localButton = CreateActionButton("Local", 194, 202, 100, (_, _) => LaunchMode("local"));
        _lanButton = CreateActionButton("LAN", 302, 202, 100, (_, _) => LaunchMode("lan"));
        _vpsButton = CreateActionButton("VPS", 410, 202, 100, (_, _) => LaunchMode("vps"));
        _desktopButton = CreateActionButton("Desktop", 518, 202, 110, (_, _) => LaunchMode("desktop"));
        _stopButton = CreateActionButton("Stop Server", 636, 202, 110, (_, _) => LaunchMode("stop"));

        var openReadmeButton = CreateActionButton("Open README", 26, 252, 140, (_, _) => OpenReadme());
        var openRootButton = CreateActionButton("Open Project Folder", 174, 252, 160, (_, _) => OpenProjectFolder());
        var openApkButton = CreateActionButton("Open APK Folder", 342, 252, 150, (_, _) => OpenApkFolder());

        _statusLabel = new Label
        {
            AutoSize = false,
            Location = new Point(26, 312),
            Size = new Size(700, 56),
            ForeColor = Color.DimGray
        };

        Controls.AddRange(new Control[]
        {
            titleLabel,
            subtitleLabel,
            rootLabel,
            _rootTextBox,
            browseButton,
            _rootValueLabel,
            _launchLastButton,
            _localButton,
            _lanButton,
            _vpsButton,
            _desktopButton,
            _stopButton,
            openReadmeButton,
            openRootButton,
            openApkButton,
            _statusLabel
        });

        Shown += (_, _) => InitializeProjectRoot();
        UpdateButtons();
    }

    private static Button CreateActionButton(string text, int x, int y, int width, EventHandler onClick)
    {
        var button = new Button
        {
            Text = text,
            Location = new Point(x, y),
            Size = new Size(width, 34)
        };
        button.Click += onClick;
        return button;
    }

    private void InitializeProjectRoot()
    {
        if (TrySetProjectRoot(_settings.ProjectRoot, persist: false))
        {
            UpdateStatus("Loaded saved project root.");
            return;
        }

        var autoDetected = ProjectRootResolver.TryFindAutoDetectedRoot();
        if (TrySetProjectRoot(autoDetected, persist: true))
        {
            UpdateStatus("Auto-detected the project root from the launcher location.");
            return;
        }

        UpdateStatus("Pick the project root once. The launcher will remember it next time.");
        ChooseProjectRoot(forcePrompt: true);
    }

    private void ChooseProjectRoot(bool forcePrompt = false)
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "Select the Lool--CLI project root folder.",
            UseDescriptionForTitle = true,
            ShowNewFolderButton = false,
            SelectedPath = _settings.ProjectRoot ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)
        };

        if (!forcePrompt && !string.IsNullOrWhiteSpace(_settings.ProjectRoot))
        {
            dialog.SelectedPath = _settings.ProjectRoot!;
        }

        if (dialog.ShowDialog(this) != DialogResult.OK)
        {
            return;
        }

        var normalized = ProjectRootResolver.NormalizeSelectedRoot(dialog.SelectedPath);
        if (normalized is null)
        {
            MessageBox.Show(
                this,
                "That folder does not look like the project root. Please select the folder that contains start-local-app.bat.",
                "Invalid folder",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        if (TrySetProjectRoot(normalized, persist: true))
        {
            UpdateStatus("Project root saved. You can launch modes now.");
        }
    }

    private bool TrySetProjectRoot(string? root, bool persist)
    {
        if (string.IsNullOrWhiteSpace(root))
        {
            return false;
        }

        var normalized = Path.GetFullPath(root);
        if (!File.Exists(Path.Combine(normalized, "start-local-app.bat")))
        {
            return false;
        }

        _settings.ProjectRoot = normalized;
        _rootTextBox.Text = normalized;
        _rootValueLabel.Text = $"Found scripts in: {normalized}";

        if (persist)
        {
            LauncherSettingsStore.Save(_settings);
        }

        UpdateButtons();
        return true;
    }

    private string RequireProjectRoot()
    {
        if (!string.IsNullOrWhiteSpace(_settings.ProjectRoot) && File.Exists(Path.Combine(_settings.ProjectRoot, "start-local-app.bat")))
        {
            return _settings.ProjectRoot!;
        }

        MessageBox.Show(
            this,
            "Project root is not set yet. Please choose the folder that contains start-local-app.bat.",
            "Project root needed",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information);
        ChooseProjectRoot(forcePrompt: true);
        return _settings.ProjectRoot ?? string.Empty;
    }

    private void LaunchLastMode()
    {
        var lastMode = string.IsNullOrWhiteSpace(_settings.LastMode) ? "local" : _settings.LastMode;
        LaunchMode(lastMode);
    }

    private void LaunchMode(string mode)
    {
        var root = RequireProjectRoot();
        if (string.IsNullOrWhiteSpace(root))
        {
            return;
        }

        var scriptName = mode switch
        {
            "local" => "start-local-app.bat",
            "lan" => "start-lan.bat",
            "vps" => "start-vps-app.bat",
            "desktop" => "start-desktop.bat",
            "stop" => "stop-server.bat",
            _ => null
        };

        if (scriptName is null)
        {
            MessageBox.Show(this, $"Unknown mode: {mode}", "Launcher", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        var scriptPath = Path.Combine(root, scriptName);
        if (!File.Exists(scriptPath))
        {
            MessageBox.Show(
                this,
                $"Missing script: {scriptName}",
                "Launcher",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = false,
                WindowStyle = ProcessWindowStyle.Normal
            };
            psi.ArgumentList.Add("/c");
            psi.ArgumentList.Add(scriptPath);

            Process.Start(psi);

            _settings.LastMode = mode;
            LauncherSettingsStore.Save(_settings);
            UpdateStatus($"Launched {mode} mode.");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Failed to launch", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void OpenReadme()
    {
        var root = RequireProjectRoot();
        if (string.IsNullOrWhiteSpace(root))
        {
            return;
        }

        OpenFileInShell(Path.Combine(root, "README.md"));
    }

    private void OpenProjectFolder()
    {
        var root = RequireProjectRoot();
        if (string.IsNullOrWhiteSpace(root))
        {
            return;
        }

        OpenFolderInExplorer(root);
    }

    private void OpenApkFolder()
    {
        var root = RequireProjectRoot();
        if (string.IsNullOrWhiteSpace(root))
        {
            return;
        }

        var apkFolder = Path.Combine(root, "dist", "android");
        if (!Directory.Exists(apkFolder))
        {
            MessageBox.Show(
                this,
                $"APK folder does not exist yet:\n{apkFolder}",
                "Launcher",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        OpenFolderInExplorer(apkFolder);
    }

    private static void OpenFolderInExplorer(string folderPath)
    {
        if (!Directory.Exists(folderPath))
        {
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = "explorer.exe",
            Arguments = folderPath,
            UseShellExecute = false
        });
    }

    private static void OpenFileInShell(string filePath)
    {
        if (!File.Exists(filePath))
        {
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = filePath,
            UseShellExecute = true
        });
    }

    private void UpdateStatus(string message)
    {
        _statusLabel.Text = $"{message}{Environment.NewLine}This launcher remembers the root folder and last mode in %AppData%\\LoolCLI\\launcher.json.";
    }

    private void UpdateButtons()
    {
        var enabled = !string.IsNullOrWhiteSpace(_settings.ProjectRoot);
        _launchLastButton.Enabled = enabled;
        _localButton.Enabled = enabled;
        _lanButton.Enabled = enabled;
        _vpsButton.Enabled = enabled;
        _desktopButton.Enabled = enabled;
        _stopButton.Enabled = enabled;
    }
}
