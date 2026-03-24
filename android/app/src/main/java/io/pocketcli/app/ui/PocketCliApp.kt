@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package io.pocketcli.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ExitToApp
import androidx.compose.material.icons.rounded.OpenInBrowser
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import io.pocketcli.app.R
import io.pocketcli.app.model.MainUiState
import kotlinx.coroutines.launch

@Composable
fun PocketCliApp(
    uiState: MainUiState,
    onOpenSettings: () -> Unit,
    onCloseSettings: () -> Unit,
    onServerUrlChanged: (String) -> Unit,
    onServerConfigChanged: ((io.pocketcli.app.model.ServerConfig) -> io.pocketcli.app.model.ServerConfig) -> Unit,
    onSaveServerConfig: () -> Unit,
    onTestConnection: () -> Unit,
    onReloadPage: () -> Unit,
    onOpenExternal: (String) -> Unit,
    onExitApp: () -> Unit,
    onPageStarted: (String) -> Unit,
    onPageProgressChanged: (Int) -> Unit,
    onPageFinished: (String, String?) -> Unit,
    onPageError: (String) -> Unit,
) {
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val webViewManager = remember {
        PocketCliWebViewManager(
            callbacks = PocketCliWebViewCallbacks(
                onPageStarted = onPageStarted,
                onPageProgressChanged = onPageProgressChanged,
                onPageFinished = onPageFinished,
                onPageError = onPageError,
            ),
        )
    }

    BackHandler(enabled = !uiState.requiresSetup && !uiState.isSettingsSheetVisible) {
        scope.launch {
            if (drawerState.isClosed) {
                drawerState.open()
            } else {
                onExitApp()
            }
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = false,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = MaterialTheme.colorScheme.surface,
                drawerShape = RoundedCornerShape(topEnd = 20.dp, bottomEnd = 20.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 18.dp, vertical = 22.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text(
                        text = stringResource(R.string.app_name),
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    Text(
                        text = uiState.serverConfig.launcherUrl(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = uiState.statusMessage,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    if (uiState.lastConnectionSummary.isNotBlank()) {
                        Text(
                            text = uiState.lastConnectionSummary,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Divider()
                    DrawerAction(
                        icon = Icons.Rounded.Close,
                        label = stringResource(R.string.back_to_terminal),
                        onClick = {
                            scope.launch { drawerState.close() }
                        },
                    )
                    DrawerAction(
                        icon = Icons.Rounded.Refresh,
                        label = stringResource(R.string.reload),
                        onClick = {
                            scope.launch { drawerState.close() }
                            onReloadPage()
                        },
                    )
                    DrawerAction(
                        icon = Icons.Rounded.OpenInBrowser,
                        label = stringResource(R.string.open_in_browser),
                        onClick = {
                            scope.launch { drawerState.close() }
                            val target = uiState.webUrl.ifBlank { uiState.serverConfig.mobileEntryUrl() }
                            onOpenExternal(target)
                        },
                    )
                    DrawerAction(
                        icon = Icons.Rounded.Settings,
                        label = stringResource(R.string.settings),
                        onClick = {
                            scope.launch { drawerState.close() }
                            onOpenSettings()
                        },
                    )
                    DrawerAction(
                        icon = Icons.Rounded.ExitToApp,
                        label = stringResource(R.string.exit_app),
                        onClick = onExitApp,
                    )
                }
            }
        },
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    webViewManager.create(context)
                },
                update = {
                    if (uiState.webUrl.isNotBlank()) {
                        webViewManager.syncAndLoad(
                            url = uiState.webUrl,
                            cookieBaseUrl = uiState.serverConfig.normalizedBaseUrl(),
                            token = uiState.serverConfig.token,
                            reloadTick = uiState.reloadTick,
                        )
                    }
                },
            )

            if (uiState.isPageLoading) {
                LinearProgressIndicator(
                    progress = (uiState.loadingProgress.coerceIn(0, 100)) / 100f,
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter),
                )
            }

            if (!uiState.hasLoadedOnce || uiState.requiresSetup) {
                LoadingOverlay(
                    requiresSetup = uiState.requiresSetup,
                    isLoading = uiState.isPageLoading,
                    statusMessage = uiState.statusMessage,
                )
            }
        }
    }

    if (uiState.isSettingsSheetVisible) {
        SettingsSheet(
            config = uiState.serverConfig,
            serverUrlInput = uiState.serverUrlInput,
            lastConnectionSummary = uiState.lastConnectionSummary,
            isTestingConnection = uiState.isTestingConnection,
            isInitialSetup = uiState.requiresSetup,
            onDismiss = onCloseSettings,
            onServerUrlChanged = onServerUrlChanged,
            onConfigChanged = onServerConfigChanged,
            onSave = onSaveServerConfig,
            onTestConnection = onTestConnection,
        )
    }
}

@Composable
private fun DrawerAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                shape = RoundedCornerShape(16.dp),
            )
            .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(imageVector = icon, contentDescription = null)
            Text(text = label)
        }
        IconButton(onClick = onClick) {
            Icon(imageVector = icon, contentDescription = label)
        }
    }
}

@Composable
private fun LoadingOverlay(
    requiresSetup: Boolean,
    isLoading: Boolean,
    statusMessage: String,
) {
    if (!requiresSetup && !isLoading) {
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background.copy(alpha = 0.82f)),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(18.dp),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 22.dp, vertical = 18.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (requiresSetup) {
                    Icon(
                        imageVector = Icons.Rounded.Settings,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(30.dp),
                    )
                    Text(
                        text = stringResource(R.string.initial_setup_required),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = stringResource(R.string.initial_setup_required_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    CircularProgressIndicator()
                    Text(
                        text = stringResource(R.string.opening_terminal),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = statusMessage,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
