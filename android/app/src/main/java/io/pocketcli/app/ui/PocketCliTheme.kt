package io.pocketcli.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF60A5FA),
    secondary = Color(0xFF34D399),
    background = Color(0xFF0B1220),
    surface = Color(0xFF111827),
    surfaceVariant = Color(0xFF172033),
    onPrimary = Color(0xFF08111E),
    onBackground = Color(0xFFE5E7EB),
    onSurface = Color(0xFFE5E7EB),
    onSurfaceVariant = Color(0xFF94A3B8),
    error = Color(0xFFF87171),
)

private val LightScheme = lightColorScheme(
    primary = Color(0xFF1D4ED8),
    secondary = Color(0xFF047857),
    background = Color(0xFFF8FAFC),
    surface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFFE2E8F0),
    onPrimary = Color.White,
    onBackground = Color(0xFF0F172A),
    onSurface = Color(0xFF0F172A),
    onSurfaceVariant = Color(0xFF475569),
    error = Color(0xFFB91C1C),
)

@Composable
fun PocketCliTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkScheme else LightScheme,
        content = content,
    )
}
