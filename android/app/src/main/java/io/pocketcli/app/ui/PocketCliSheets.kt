package io.pocketcli.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import io.pocketcli.app.R
import io.pocketcli.app.model.ServerConfig

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsSheet(
    config: ServerConfig,
    lastConnectionSummary: String,
    isTestingConnection: Boolean,
    isInitialSetup: Boolean,
    onDismiss: () -> Unit,
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
            Text(text = stringResource(R.string.scheme), style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = config.normalizedScheme() == "http",
                    onClick = { onConfigChanged { current -> current.copy(scheme = "http") } },
                    label = { Text("http") },
                )
                FilterChip(
                    selected = config.normalizedScheme() == "https",
                    onClick = { onConfigChanged { current -> current.copy(scheme = "https") } },
                    label = { Text("https") },
                )
            }
            OutlinedTextField(
                value = config.host,
                onValueChange = { onConfigChanged { current -> current.copy(host = it) } },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.host)) },
                singleLine = true,
            )
            OutlinedTextField(
                value = config.port,
                onValueChange = { onConfigChanged { current -> current.copy(port = it) } },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.port)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
            )
            OutlinedTextField(
                value = config.basePath,
                onValueChange = { onConfigChanged { current -> current.copy(basePath = it) } },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.base_path)) },
                placeholder = { Text("/optional-path") },
                singleLine = true,
            )
            OutlinedTextField(
                value = config.token,
                onValueChange = { onConfigChanged { current -> current.copy(token = it) } },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.access_token_optional)) },
                singleLine = true,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = config.connectTimeoutSeconds,
                    onValueChange = { onConfigChanged { current -> current.copy(connectTimeoutSeconds = it) } },
                    modifier = Modifier.weight(1f),
                    label = { Text(stringResource(R.string.connect_timeout)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = config.readTimeoutSeconds,
                    onValueChange = { onConfigChanged { current -> current.copy(readTimeoutSeconds = it) } },
                    modifier = Modifier.weight(1f),
                    label = { Text(stringResource(R.string.read_timeout)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                )
            }
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = stringResource(R.string.ignore_tls_errors))
                    Text(
                        text = stringResource(R.string.ignore_tls_errors_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(
                    checked = config.ignoreTlsErrors,
                    onCheckedChange = { enabled ->
                        onConfigChanged { current -> current.copy(ignoreTlsErrors = enabled) }
                    },
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
