package io.pocketcli.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import io.pocketcli.app.data.PocketCliRepository
import io.pocketcli.app.data.SettingsStore
import io.pocketcli.app.model.MainUiState
import io.pocketcli.app.model.ServerConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val settingsStore = SettingsStore(application)
    private val repository = PocketCliRepository()

    private val _uiState = MutableStateFlow(
        MainUiState(
            serverConfig = settingsStore.loadServerConfig(),
            requiresSetup = !settingsStore.hasCompletedSetup(),
        ),
    )
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        val config = _uiState.value.serverConfig
        MainActivity.applyLanguage(config.languageTag)
        if (_uiState.value.requiresSetup) {
            _uiState.update {
                it.copy(
                    isSettingsSheetVisible = true,
                    statusMessage = "Complete setup to start.",
                )
            }
        } else {
            loadSavedTarget()
        }
    }

    fun setSettingsSheetVisible(visible: Boolean) {
        if (_uiState.value.requiresSetup && !visible) {
            return
        }
        _uiState.update { it.copy(isSettingsSheetVisible = visible) }
    }

    fun updateServerConfig(transform: (ServerConfig) -> ServerConfig) {
        _uiState.update { state ->
            state.copy(serverConfig = transform(state.serverConfig))
        }
    }

    fun saveServerConfig() {
        val config = _uiState.value.serverConfig
        val validationError = validateConfig(config)
        if (validationError != null) {
            setStatus(validationError)
            return
        }

        settingsStore.saveServerConfig(config)
        MainActivity.applyLanguage(config.languageTag)
        val targetUrl = config.terminalEntryUrl()
        _uiState.update {
            it.copy(
                isSettingsSheetVisible = false,
                requiresSetup = false,
                statusMessage = "Configuration saved.",
                pendingWebUrl = targetUrl,
            )
        }
    }

    fun testConnection() {
        val config = _uiState.value.serverConfig
        val validationError = validateConfig(config)
        if (validationError != null) {
            setStatus(validationError)
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isTestingConnection = true, statusMessage = "Testing connection...") }
            runCatching {
                repository.testConnection(config)
            }.onSuccess { health ->
                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        lastConnectionSummary = "${health.host}:${health.port}  ${health.cwd}",
                        statusMessage = "Connection successful.",
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        statusMessage = error.message ?: "Connection failed.",
                    )
                }
            }
        }
    }

    fun reloadCurrentPage() {
        val current = _uiState.value.webUrl
        if (current.isBlank()) {
            if (!_uiState.value.requiresSetup) {
                loadSavedTarget()
            }
            return
        }
        _uiState.update { it.copy(pendingWebUrl = current, statusMessage = "Reloading...") }
    }

    fun consumePendingWebUrl(): String? {
        val pending = _uiState.value.pendingWebUrl
        if (pending.isBlank()) {
            return null
        }
        _uiState.update { it.copy(pendingWebUrl = "") }
        return pending
    }

    fun onPageStarted(url: String) {
        _uiState.update {
            it.copy(
                webUrl = url,
                isPageLoading = true,
                loadingProgress = 10,
                statusMessage = "Loading terminal...",
            )
        }
    }

    fun onPageProgressChanged(progress: Int) {
        _uiState.update {
            it.copy(
                isPageLoading = progress in 0..99,
                loadingProgress = progress.coerceIn(0, 100),
            )
        }
    }

    fun onPageFinished(url: String, title: String?) {
        _uiState.update {
            it.copy(
                webUrl = url,
                pageTitle = title?.takeIf(String::isNotBlank) ?: "PocketCLI",
                isPageLoading = false,
                loadingProgress = 100,
                hasLoadedOnce = true,
                statusMessage = "Connected.",
            )
        }
    }

    fun onPageError(message: String) {
        _uiState.update {
            it.copy(
                isPageLoading = false,
                statusMessage = message,
            )
        }
    }

    private fun loadSavedTarget() {
        val targetUrl = _uiState.value.serverConfig.terminalEntryUrl()
        _uiState.update {
            it.copy(
                pendingWebUrl = targetUrl,
                statusMessage = "Opening terminal...",
            )
        }
    }

    private fun validateConfig(config: ServerConfig): String? {
        if (config.host.isBlank()) {
            return "Host is required."
        }
        if (config.port.isBlank()) {
            return "Port is required."
        }
        if (config.port.toIntOrNull() == null) {
            return "Port must be a number."
        }
        if (config.connectTimeoutSeconds.toLongOrNull() == null) {
            return "Connect timeout must be a number."
        }
        if (config.readTimeoutSeconds.toLongOrNull() == null) {
            return "Read timeout must be a number."
        }
        return null
    }

    private fun setStatus(message: String) {
        _uiState.update { it.copy(statusMessage = message) }
    }
}
