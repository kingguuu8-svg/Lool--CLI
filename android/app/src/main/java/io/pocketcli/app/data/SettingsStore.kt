package io.pocketcli.app.data

import android.content.Context
import io.pocketcli.app.MainActivity
import io.pocketcli.app.model.ServerConfig

class SettingsStore(context: Context) {
    private val preferences =
        context.getSharedPreferences(MainActivity.PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun loadServerConfig(): ServerConfig {
        return ServerConfig(
            scheme = preferences.getString(KEY_SCHEME, "http") ?: "http",
            host = preferences.getString(KEY_HOST, "10.0.2.2") ?: "10.0.2.2",
            port = preferences.getString(KEY_PORT, "3000") ?: "3000",
            basePath = preferences.getString(KEY_BASE_PATH, "") ?: "",
            token = preferences.getString(KEY_TOKEN, "") ?: "",
            connectTimeoutSeconds = preferences.getString(KEY_CONNECT_TIMEOUT, "8") ?: "8",
            readTimeoutSeconds = preferences.getString(KEY_READ_TIMEOUT, "30") ?: "30",
            ignoreTlsErrors = preferences.getBoolean(KEY_IGNORE_TLS_ERRORS, false),
            languageTag = preferences.getString(
                MainActivity.KEY_LANGUAGE_TAG,
                MainActivity.LANGUAGE_SYSTEM,
            ) ?: MainActivity.LANGUAGE_SYSTEM,
        )
    }

    fun saveServerConfig(config: ServerConfig) {
        preferences.edit()
            .putString(KEY_SCHEME, config.scheme)
            .putString(KEY_HOST, config.host)
            .putString(KEY_PORT, config.port)
            .putString(KEY_BASE_PATH, config.basePath)
            .putString(KEY_TOKEN, config.token)
            .putString(KEY_CONNECT_TIMEOUT, config.connectTimeoutSeconds)
            .putString(KEY_READ_TIMEOUT, config.readTimeoutSeconds)
            .putBoolean(KEY_IGNORE_TLS_ERRORS, config.ignoreTlsErrors)
            .putString(MainActivity.KEY_LANGUAGE_TAG, config.languageTag)
            .putBoolean(KEY_HAS_COMPLETED_SETUP, true)
            .apply()
    }

    fun hasCompletedSetup(): Boolean {
        return preferences.getBoolean(KEY_HAS_COMPLETED_SETUP, false)
    }

    companion object {
        private const val KEY_SCHEME = "scheme"
        private const val KEY_HOST = "host"
        private const val KEY_PORT = "port"
        private const val KEY_BASE_PATH = "base_path"
        private const val KEY_TOKEN = "token"
        private const val KEY_CONNECT_TIMEOUT = "connect_timeout"
        private const val KEY_READ_TIMEOUT = "read_timeout"
        private const val KEY_IGNORE_TLS_ERRORS = "ignore_tls_errors"
        private const val KEY_HAS_COMPLETED_SETUP = "has_completed_setup"
    }
}
