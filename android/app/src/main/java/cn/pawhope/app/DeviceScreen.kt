package cn.pawhope.app

import org.json.JSONObject

fun MainActivity.devicePage() {
    pageTitle("设备")
    val dev = PawApi.state.optJSONObject("devicesState") ?: JSONObject()
    val feeder = dev.optJSONObject("feeder") ?: JSONObject()
    val bowl = card(
        head(feeder.optString("name", "食碗")),
        line(if (feeder.optBoolean("online")) "在线" else "离线", 12, 0xFF1F7A68.toInt()),
        line("碗里 ${feeder.opt("bowlRemainGrams")} g · 今天吃了 ${feeder.opt("todayEatenGrams")} g", 14, 0xFF24312E.toInt()),
        line("粮仓 ${feeder.opt("hopperRemainGrams")} g · 已喂 ${feeder.opt("todayFedCount")} 次 / ${feeder.opt("todayFedGrams")} g · 上次 ${feeder.optString("lastFeedTime")}", 12, 0xFF8A918E.toInt())
    )
    feeder.arr("schedules").objects().forEach { s ->
        val on = if (s.optBoolean("enabled")) "开" else "关"
        bowl.addView(line("${s.optString("time")} ${s.optString("label")} ${s.opt("grams")} g（$on）", 13, 0xFF5C6763.toInt()))
    }
    bowl.addView(button("现在出粮") {
        prompt("出粮", listOf("克数，5 到 100")) { v ->
            val grams = v.getOrElse(0) { "10" }.toIntOrNull() ?: 10
            runAction {
                PawApi.post("/api/v1/devices/command", JSONObject().put("command", "FEED_NOW").put("grams", grams))
            }
        }
    })
    pageHost.addView(bowl)

    val fountain = dev.optJSONObject("fountain") ?: JSONObject()
    pageHost.addView(card(
        head(fountain.optString("name", "饮水机")),
        line("水位 ${fountain.opt("waterLevelPercent")}% · 滤芯 ${fountain.opt("filterLifePercent")}% · ${fountain.opt("waterTempC")} °C", 14, 0xFF24312E.toInt()),
        line("今天喝了 ${fountain.opt("todayDrinkCount")} 次 / ${fountain.opt("todayDrinkMl")} ml · ${fountain.optString("mode")}", 12, 0xFF8A918E.toInt()),
        button("换水冲刷") {
            runAction { PawApi.post("/api/v1/devices/command", JSONObject().put("command", "WATER_FLUSH")) }
        }
    ))

    val collar = dev.optJSONObject("collar") ?: JSONObject()
    pageHost.addView(card(
        head(collar.optString("name", "项圈")),
        line("电量 ${collar.opt("batteryPercent")}% · ${collar.optString("signalStrength")}", 13, 0xFF24312E.toInt()),
        line(collar.optString("locationName"), 13, 0xFF5C6763.toInt()),
        line(collar.optString("cameraSnapshotTag"), 12, 0xFF8A918E.toInt()),
        line(if (collar.optBoolean("inSafeFence")) "在围栏内" else "已离开围栏", 13, 0xFF1F7A68.toInt()),
        button(if (collar.optBoolean("buzzerActive")) "关闭寻宠" else "让项圈响") {
            runAction { PawApi.post("/api/v1/devices/command", JSONObject().put("command", "LOCATE_BUZZ")) }
        },
        quiet("在地图里看位置") { map(collar.optDouble("lat"), collar.optDouble("lng")) }
    ))

    pageHost.addView(card(
        head("遛弯"),
        line(if (WalkSession.watching) "记录中，${WalkSession.points.length()} 个定位点" else "用手机 GPS 记录，不手填地点", 14, 0xFF24312E.toInt()),
        button(if (WalkSession.watching) "结束并保存" else "开始遛弯") {
            if (WalkSession.watching) stopWalk() else startWalk()
        }
    ))
    dev.arr("walkRoutes").objects().take(20).forEach { w ->
        pageHost.addView(card(
            line("${w.optString("petName")}  ${w.optString("date")}", 14, 0xFF24312E.toInt()),
            line("${w.opt("distanceKm")} km · ${w.opt("durationMin")} 分钟 · ${w.opt("caloriesKcal")} kcal", 13, 0xFF5C6763.toInt()),
            line(w.optString("routeSummary"), 12, 0xFF8A918E.toInt())
        ))
    }
}
