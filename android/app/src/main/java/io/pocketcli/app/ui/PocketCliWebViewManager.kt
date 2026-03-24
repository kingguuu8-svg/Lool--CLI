package io.pocketcli.app.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

private const val WEBVIEW_LOG_TAG = "PocketCliWebView"

data class PocketCliWebViewCallbacks(
    val onPageStarted: (String) -> Unit,
    val onPageProgressChanged: (Int) -> Unit,
    val onPageFinished: (String, String?) -> Unit,
    val onPageError: (String) -> Unit,
)

/**
 * Adapted from screenlite/android-web-kiosk (MIT) for PocketCLI's immersive launcher.
 */
class PocketCliWebViewManager(
    private val callbacks: PocketCliWebViewCallbacks,
) {
    private var currentWebView: WebView? = null
    private var lastLoadedUrl: String? = null
    private var lastReloadTick: Long = -1L

    @SuppressLint("SetJavaScriptEnabled")
    fun create(context: android.content.Context): WebView {
        val webView = WebView(context).apply {
            layoutParams = android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(Color.BLACK)
            visibility = View.INVISIBLE

            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(this, false)

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                javaScriptCanOpenWindowsAutomatically = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                mediaPlaybackRequiresUserGesture = false
                setSupportMultipleWindows(true)
                cacheMode = WebSettings.LOAD_DEFAULT
                loadsImagesAutomatically = true
                useWideViewPort = true
                loadWithOverviewMode = true
                displayZoomControls = false
                builtInZoomControls = false
                setSupportZoom(false)
            }

            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            isScrollbarFadingEnabled = false
            scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
            overScrollMode = View.OVER_SCROLL_NEVER

            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    if (!url.isNullOrBlank()) {
                        Log.d(WEBVIEW_LOG_TAG, "pageStarted: $url")
                        callbacks.onPageStarted(url)
                    }
                    visibility = View.INVISIBLE
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.d(
                        WEBVIEW_LOG_TAG,
                        "pageFinished: ${url.orEmpty()} title=${view?.title.orEmpty()} progress=${view?.progress}",
                    )
                    postDelayed({
                        visibility = View.VISIBLE
                        callbacks.onPageFinished(url.orEmpty(), view?.title)
                    }, 250)
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?,
                ) {
                    if (request?.isForMainFrame == true) {
                        Log.e(
                            WEBVIEW_LOG_TAG,
                            "mainFrameError: url=${request.url} code=${error?.errorCode} desc=${error?.description}",
                        )
                        callbacks.onPageError(error?.description?.toString() ?: "Failed to load terminal page.")
                    }
                }

                override fun onReceivedHttpError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    errorResponse: WebResourceResponse?,
                ) {
                    if (request?.isForMainFrame == true) {
                        Log.e(
                            WEBVIEW_LOG_TAG,
                            "mainFrameHttpError: url=${request.url} status=${errorResponse?.statusCode} reason=${errorResponse?.reasonPhrase}",
                        )
                        callbacks.onPageError(
                            "HTTP ${errorResponse?.statusCode ?: 0}: ${errorResponse?.reasonPhrase ?: "Page load failed."}",
                        )
                    }
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    Log.d(
                        WEBVIEW_LOG_TAG,
                        "progress: $newProgress title=${view?.title.orEmpty()} url=${view?.url.orEmpty()}",
                    )
                    callbacks.onPageProgressChanged(newProgress)
                }

                override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                    Log.d(
                        WEBVIEW_LOG_TAG,
                        "console ${consoleMessage.messageLevel()} ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()} ${consoleMessage.message()}",
                    )
                    return true
                }
            }
        }

        currentWebView = webView
        return webView
    }

    fun syncAndLoad(
        url: String,
        cookieBaseUrl: String,
        token: String,
        reloadTick: Long,
    ) {
        val webView = currentWebView ?: return
        val shouldReload = reloadTick != lastReloadTick
        val shouldLoad = lastLoadedUrl != url || webView.url != url

        syncAuthCookie(cookieBaseUrl = cookieBaseUrl, token = token) {
            webView.post {
                when {
                    shouldLoad -> {
                        lastLoadedUrl = url
                        lastReloadTick = reloadTick
                        webView.loadUrl(url)
                    }

                    shouldReload -> {
                        lastReloadTick = reloadTick
                        webView.reload()
                    }
                }
            }
        }
    }

    private fun syncAuthCookie(
        cookieBaseUrl: String,
        token: String,
        onDone: () -> Unit,
    ) {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setCookie(
            cookieBaseUrl,
            buildAuthCookieValue(token),
            ValueCallback {
                cookieManager.flush()
                onDone()
            },
        )
    }

    private fun buildAuthCookieValue(token: String): String {
        return if (token.isBlank()) {
            "pocketcli_token=; Path=/; Max-Age=0"
        } else {
            "pocketcli_token=${Uri.encode(token.trim())}; Path=/; SameSite=Lax"
        }
    }
}
