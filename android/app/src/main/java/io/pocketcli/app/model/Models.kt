package io.pocketcli.app.model

import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

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

    fun launcherUrl(): String = normalizedBaseUrl()

    fun terminalEntryUrl(): String {
        return normalizedBaseUrl().trimEnd('/') + "/"
    }

    fun mobileEntryUrl(): String {
        return normalizedBaseUrl().trimEnd('/') + "/m"
    }

    fun mobileEntryUrlWithBootstrapToken(): String {
        val baseUrl = mobileEntryUrl()
        val safeToken = token.trim()
        if (safeToken.isBlank()) {
            return baseUrl
        }
        val encoded = URLEncoder.encode(safeToken, StandardCharsets.UTF_8.toString())
        val separator = if (baseUrl.contains("?")) "&" else "?"
        return "$baseUrl${separator}token=$encoded"
    }

    fun withLauncherUrl(rawInput: String): ServerConfig {
        val trimmed = rawInput.trim()
        if (trimmed.isBlank()) {
            return this
        }

        val normalizedInput = if (trimmed.contains("://")) trimmed else "http://$trimmed"
        val uri = URI(normalizedInput)
        val parsedScheme = uri.scheme?.lowercase()?.takeIf { it == "http" || it == "https" } ?: "http"
        val parsedHost = uri.host ?: ""
        val parsedPort = when {
            uri.port >= 0 -> uri.port.toString()
            parsedScheme == "https" -> "443"
            else -> "80"
        }
        val parsedPath = uri.path.orEmpty().trim().trim('/')

        return copy(
            scheme = parsedScheme,
            host = parsedHost,
            port = parsedPort,
            basePath = parsedPath,
        )
    }
}

data class HealthResponse(
    val ok: Boolean,
    val host: String,
    val port: Int,
    val cwd: String,
    val authEnabled: Boolean,
)

data class MainUiState(
    val serverConfig: ServerConfig = ServerConfig(),
    val serverUrlInput: String = serverConfig.launcherUrl(),
    val statusMessage: String = "Ready.",
    val lastConnectionSummary: String = "",
    val isTestingConnection: Boolean = false,
    val isSettingsSheetVisible: Boolean = false,
    val requiresSetup: Boolean = false,
    val webUrl: String = "",
    val reloadTick: Long = 0L,
    val pageTitle: String = "",
    val isPageLoading: Boolean = false,
    val loadingProgress: Int = 0,
    val hasLoadedOnce: Boolean = false,
)
