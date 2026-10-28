package cn.pawhope.app

import android.os.Handler
import android.os.Looper
import org.json.JSONArray

object WalkSession {
    var points = JSONArray()
    @Volatile var watching = false
    var onUpdate: (() -> Unit)? = null

    fun reset() {
        points = JSONArray()
    }

    fun add(lat: Double, lng: Double, timeMs: Long, acc: Int) {
        points.put(JSONArray().put(lat).put(lng).put(timeMs).put(acc))
        Handler(Looper.getMainLooper()).post { onUpdate?.invoke() }
    }

    fun copy(): JSONArray {
        val out = JSONArray()
        for (i in 0 until points.length()) out.put(points.getJSONArray(i))
        return out
    }
}
