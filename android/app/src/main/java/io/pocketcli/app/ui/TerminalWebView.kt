package io.pocketcli.app.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import io.pocketcli.app.model.TerminalLoadRequest

fun applyAuthCookie(request: TerminalLoadRequest) {
    val cookieManager = CookieManager.getInstance()
    if (request.token.isBlank()) {
        cookieManager.setCookie(request.cookieBaseUrl, "pocketcli_token=; Path=/; Max-Age=0")
    } else {
        val encodedToken = android.net.Uri.encode(request.token)
        cookieManager.setCookie(
            request.cookieBaseUrl,
            "pocketcli_token=$encodedToken; Path=/",
        )
    }
    cookieManager.flush()
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TerminalWebView(
    modifier: Modifier = Modifier,
    onCreated: (WebView) -> Unit,
    onPageStarted: (String) -> Unit,
    onPageProgressChanged: (Int) -> Unit,
    onPageFinished: (String, String?) -> Unit,
    onPageError: (String) -> Unit,
) {
    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                settings.cacheMode = WebSettings.LOAD_DEFAULT
                settings.loadsImagesAutomatically = true
                settings.useWideViewPort = true
                settings.loadWithOverviewMode = true
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false

                webViewClient = object : WebViewClient() {
                    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                        if (!url.isNullOrBlank()) {
                            onPageStarted(url)
                        }
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        onPageFinished(url.orEmpty(), view?.title)
                    }

                    override fun onReceivedError(
                        view: WebView?,
                        request: WebResourceRequest?,
                        error: WebResourceError?,
                    ) {
                        if (request?.isForMainFrame == true) {
                            onPageError(error?.description?.toString() ?: "Failed to load terminal page.")
                        }
                    }
                }

                webChromeClient = object : WebChromeClient() {
                    override fun onProgressChanged(view: WebView?, newProgress: Int) {
                        onPageProgressChanged(newProgress)
                    }
                }

                onCreated(this)
            }
        },
    )
}
