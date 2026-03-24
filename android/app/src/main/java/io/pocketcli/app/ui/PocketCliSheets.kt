package io.pocketcli.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.pocketcli.app.R
import io.pocketcli.app.model.ServerConfig

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsSheet(
    config: ServerConfig,
    serverUrlInput: String,
    lastConnectionSummary: String,
    isTestingConnection: Boolean,
    isInitialSetup: Boolean,
    onDismiss: () -> Unit,
    onServerUrlChanged: (String) -> Unit,
    onConfigChanged: ((ServerConfig) -> ServerConfig) -> Unit,
    onSave: () -> Unit,
    onTestConnection: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = {
            if (!isInitialSetup) {
                onDismiss()
            }
        },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(text = stringResource(R.string.settings), style = MaterialTheme.typography.headlineSmall)
            Text(
                text = if (isInitialSetup) {
                    stringResource(R.string.settings_subtitle_initial_setup)
                } else {
                    stringResource(R.string.settings_subtitle_webview)
                },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = serverUrlInput,
                onValueChange = onServerUrlChanged,
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.server_url)) },
                placeholder = { Text("http://139.224.230.204") },
                singleLine = true,
            )
            OutlinedTextField(
                value = config.token,
                onValueChange = { onConfigChanged { current -> current.copy(token = it) } },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.access_token_optional)) },
                singleLine = true,
            )
            Text(text = stringResource(R.string.language), style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = config.languageTag == "system",
                    onClick = { onConfigChanged { current -> current.copy(languageTag = "system") } },
                    label = { Text(stringResource(R.string.follow_system)) },
                )
                FilterChip(
                    selected = config.languageTag == "en",
                    onClick = { onConfigChanged { current -> current.copy(languageTag = "en") } },
                    label = { Text("English") },
                )
                FilterChip(
                    selected = config.languageTag == "zh-CN",
                    onClick = { onConfigChanged { current -> current.copy(languageTag = "zh-CN") } },
                    label = { Text("中文") },
                )
            }
            if (lastConnectionSummary.isNotBlank()) {
                Text(
                    text = lastConnectionSummary,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    onClick = onTestConnection,
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        text = if (isTestingConnection) {
                            stringResource(R.string.testing)
                        } else {
                            stringResource(R.string.test_connection)
                        },
                    )
                }
                Button(onClick = onSave, modifier = Modifier.weight(1f)) {
                    Text(text = stringResource(R.string.save_and_open))
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}
