package io.pocketcli.app.model

data class ServerConfig(
    val scheme: String = "http",
    val host: String = "10.0.2.2",
    val port: String = "3000",
    val basePath: String = "",
    val token: String = "",
    val connectTimeoutSeconds: String = "8",
    val readTimeoutSeconds: String = "30",
    val ignoreTlsErrors: Boolean = false,
    val languageTag: String = "system",
) {
    fun normalizedScheme(): String = if (scheme.equals("https", ignoreCase = true)) "https" else "http"

    fun normalizedBaseUrl(): String {
        val safeHost = host.trim()
        val safePort = port.trim()
        val safePath = basePath.trim().trim('/')
        val portSegment = if (safePort.isBlank()) "" else ":$safePort"
        val pathSegment = if (safePath.isBlank()) "" else "/$safePath"
        return "${normalizedScheme()}://$safeHost$portSegment$pathSegment"
    }

    fun terminalEntryUrl(): String = normalizedBaseUrl().trimEnd('/') + "/"
}

data class HealthResponse(
    val ok: Boolean,
    val host: String,
    val port: Int,
    val cwd: String,
    val authEnabled: Boolean,
)

data class TerminalLoadRequest(
    val url: String,
    val cookieBaseUrl: String,
    val token: String,
)

data class MainUiState(
    val serverConfig: ServerConfig = ServerConfig(),
    val statusMessage: String = "Ready.",
    val lastConnectionSummary: String = "",
    val isTestingConnection: Boolean = false,
    val isSettingsSheetVisible: Boolean = false,
    val requiresSetup: Boolean = false,
    val webUrl: String = "",
    val pendingWebUrl: String = "",
    val pendingLoadRequest: TerminalLoadRequest? = null,
    val pageTitle: String = "",
    val isPageLoading: Boolean = false,
    val loadingProgress: Int = 0,
    val hasLoadedOnce: Boolean = false,
)
