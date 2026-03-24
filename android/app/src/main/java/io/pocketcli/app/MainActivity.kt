package io.pocketcli.app

import android.content.Context
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.content.Intent
import android.net.Uri
import io.pocketcli.app.ui.PocketCliApp
import io.pocketcli.app.ui.PocketCliTheme

class MainActivity : AppCompatActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun attachBaseContext(newBase: Context) {
        val preferences = newBase.getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
        val savedLanguage = preferences.getString(KEY_LANGUAGE_TAG, LANGUAGE_SYSTEM) ?: LANGUAGE_SYSTEM
        applyLanguage(savedLanguage)
        super.attachBaseContext(newBase)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val uiState = viewModel.uiState.collectAsStateWithLifecycle()

            PocketCliTheme {
                PocketCliApp(
                    uiState = uiState.value,
                    onOpenSettings = { viewModel.setSettingsSheetVisible(true) },
                    onCloseSettings = { viewModel.setSettingsSheetVisible(false) },
                    onServerConfigChanged = viewModel::updateServerConfig,
                    onSaveServerConfig = viewModel::saveServerConfig,
                    onTestConnection = viewModel::testConnection,
                    onReloadPage = viewModel::reloadCurrentPage,
                    onOpenExternal = { targetUrl ->
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl)))
                    },
                    onConsumePendingLoadRequest = viewModel::consumePendingLoadRequest,
                    onPageStarted = viewModel::onPageStarted,
                    onPageProgressChanged = viewModel::onPageProgressChanged,
                    onPageFinished = viewModel::onPageFinished,
                    onPageError = viewModel::onPageError,
                )
            }
        }
    }

    companion object {
        const val PREFERENCES_NAME = "pocketcli-native"
        const val KEY_LANGUAGE_TAG = "language_tag"
        const val LANGUAGE_SYSTEM = "system"

        fun applyLanguage(languageTag: String) {
            val locales = if (languageTag == LANGUAGE_SYSTEM) {
                LocaleListCompat.getEmptyLocaleList()
            } else {
                LocaleListCompat.forLanguageTags(languageTag)
            }
            AppCompatDelegate.setApplicationLocales(locales)
        }
    }
}
