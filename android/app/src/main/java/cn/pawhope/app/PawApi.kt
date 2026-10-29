package cn.pawhope.app

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object PawApi {
    var origin = "https://pawhope.cn"

    var signSecret: String = ""
    var authToken: String = ""
    var state: JSONObject = JSONObject()

    fun bootstrap() {
        val res = raw("GET", "/api/v1/bootstrap", null, signed = false)
        if (res.code != 0) error(res.message)
        val data = res.body.getJSONObject("data")
        signSecret = data.optString("signSecret")
        authToken = data.optString("authToken")
        state = data.getJSONObject("state")
    }

    fun post(path: String, payload: JSONObject): ApiResult {
        val res = raw("POST", path, payload.toString(), signed = true)
        if (res.code == 0) apply(res.body)
        return res
    }

    fun patch(path: String, payload: JSONObject): ApiResult {
        val res = raw("PATCH", path, payload.toString(), signed = true)
        if (res.code == 0) apply(res.body)
        return res
    }

    private fun apply(body: JSONObject) {
        val data = body.optJSONObject("data") ?: return
        val keys = listOf(
            "pets", "healthRecords", "ledgerEntries", "reminders", "devicesState",
            "socialPosts", "petFriends", "cartItems", "orders", "albumState",
            "currentUser", "addresses", "sharedMembers"
        )
        for (k in keys) {
            if (data.has(k)) state.put(k, data.get(k))
        }
        if (data.has("currentPetId")) state.put("currentPetId", data.getString("currentPetId"))
        if (data.has("bookings")) {
            val svc = state.optJSONObject("servicesData") ?: JSONObject()
            svc.put("bookings", data.getJSONArray("bookings"))
            state.put("servicesData", svc)
        }
        if (data.has("history") && data.has("petId")) {
            val chats = state.optJSONObject("aiChatHistories") ?: JSONObject()
            chats.put(data.getString("petId"), data.getJSONArray("history"))
            state.put("aiChatHistories", chats)
        }
    }

    private fun raw(method: String, path: String, rawBody: String?, signed: Boolean): ApiResult {
            val conn = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 20000
            setRequestProperty("Accept", "application/json")
            if (authToken.isNotEmpty()) setRequestProperty("Authorization", "Bearer $authToken")
            if (signed) {
                val body = rawBody ?: ""
                val ts = System.currentTimeMillis().toString()
                val nonce = UUID.randomUUID().toString().replace("-", "")
                val sig = hmac(signSecret, listOf(method, path, ts, nonce, sha256(body)).joinToString("\n"))
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("X-App-Client", "PawHope-Android/1.0.0")
                setRequestProperty("X-Timestamp", ts)
                setRequestProperty("X-Nonce", nonce)
                setRequestProperty("X-Signature", sig)
                doOutput = true
                outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
        }
        val code = conn.responseCode
        val text = (if (code in 200..299) conn.inputStream else conn.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        val json = if (text.startsWith("{")) JSONObject(text) else JSONObject().put("message", text.ifBlank { "服务器没有返回内容" })
        return ApiResult(
            http = code,
            code = json.optInt("code", if (code in 200..299) 0 else code),
            message = json.optString("message", "请求失败"),
            body = json
        )
    }

    private fun sha256(s: String): String {
        val d = MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8))
        return d.joinToString("") { "%02x".format(it) }
    }

    private fun hmac(secret: String, msg: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return mac.doFinal(msg.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}

data class ApiResult(val http: Int, val code: Int, val message: String, val body: JSONObject)

fun JSONObject.arr(name: String): JSONArray = optJSONArray(name) ?: JSONArray()
