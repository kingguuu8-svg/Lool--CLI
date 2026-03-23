package io.pocketcli.app.data

import io.pocketcli.app.model.HealthResponse
import io.pocketcli.app.model.ServerConfig
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

class PocketCliRepository {
    private val gson = Gson()

    suspend fun testConnection(config: ServerConfig): HealthResponse = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(config.normalizedBaseUrl().trimEnd('/') + "/api/health")
            .apply {
                if (config.token.isNotBlank()) {
                    header("x-access-token", config.token.trim())
                }
            }
            .build()

        createClient(config).newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException(parseError(response))
            }
            gson.fromJson(response.body?.charStream(), HealthResponse::class.java)
        }
    }

    private fun createClient(config: ServerConfig): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(config.connectTimeoutSeconds.toLongOrNull() ?: 8L, TimeUnit.SECONDS)
            .readTimeout(config.readTimeoutSeconds.toLongOrNull() ?: 30L, TimeUnit.SECONDS)
            .writeTimeout(config.readTimeoutSeconds.toLongOrNull() ?: 30L, TimeUnit.SECONDS)

        if (config.ignoreTlsErrors && config.normalizedScheme() == "https") {
            val trustManager = trustAllManager()
            val sslContext = SSLContext.getInstance("TLS")
            sslContext.init(null, arrayOf<TrustManager>(trustManager), SecureRandom())
            builder.sslSocketFactory(sslContext.socketFactory, trustManager)
            builder.hostnameVerifier(HostnameVerifier { _, _ -> true })
        }

        return builder.build()
    }

    private fun parseError(response: Response): String {
        val bodyText = response.body?.string().orEmpty()
        if (bodyText.isBlank()) {
            return "HTTP ${response.code}"
        }

        return runCatching {
            val json = gson.fromJson(bodyText, JsonObject::class.java)
            json.get("detail")?.asString
                ?: json.get("error")?.asString
                ?: bodyText
        }.getOrElse { bodyText }
    }

    private fun trustAllManager(): X509TrustManager {
        return object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit

            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }
    }
}
