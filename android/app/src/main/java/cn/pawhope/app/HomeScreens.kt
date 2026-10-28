package cn.pawhope.app

import org.json.JSONObject

fun MainActivity.homePage() {
    val pet = currentPet()
    pageTitle(pet?.optString("name") ?: "首页")
    pageHost.addView(chips(petNames(), pet?.optString("name") ?: "") { name ->
        val id = petIdByName(name) ?: return@chips
        runAction { PawApi.post("/api/v1/pets/select", JSONObject().put("petId", id)) }
    })
    pageHost.addView(card(
        head(pet?.optString("name") ?: "还没有宠物"),
        line("${pet?.optString("breed").orEmpty()}  ${pet?.optString("gender").orEmpty()}", 13, 0xFF5C6763.toInt()),
        line(pet?.optString("dailyStatus") ?: "", 14, 0xFF24312E.toInt()),
        line("体重 ${pet?.opt("weightKg") ?: "-"} kg · 体温 ${pet?.opt("bodyTempC") ?: "-"} °C", 14, 0xFF24312E.toInt()),
        line("下次疫苗 ${pet?.optString("nextVaccineDate").orEmpty()} · 驱虫 ${pet?.optString("nextDewormDate").orEmpty()}", 12, 0xFF8A918E.toInt()),
        quiet("添加一只宠物") { addPet() }
    ))
    val shortcuts = card(head("档案"))
    listOf(
        "健康档案" to "health",
        "记账" to "ledger",
        "待办" to "reminders",
        "和它说话" to "chat",
        "医院与服务" to "services",
        "相册" to "album"
    ).forEach { (label, dest) ->
        shortcuts.addView(quiet(label) { openScreen(dest) })
    }
    pageHost.addView(shortcuts)
    pageHost.addView(head("还没做的事").apply { setPadding(dp(16), dp(12), dp(16), 0) })
    val rem = PawApi.state.arr("reminders").objects().filter { !it.optBoolean("done") && matchesPet(it) }
    if (rem.isEmpty()) pageHost.addView(card(line("没有未完成的待办", 14, 0xFF8A918E.toInt())))
    rem.take(4).forEach { r ->
        pageHost.addView(card(
            line(r.optString("title"), 15, 0xFF24312E.toInt()),
            line("${r.optString("time")} · ${r.optString("category")}", 12, 0xFF8A918E.toInt()),
            button("标成完成") {
                runAction { PawApi.patch("/api/v1/reminders/toggle", JSONObject().put("id", r.optString("id"))) }
            }
        ))
    }
}

fun MainActivity.healthPage() {
    pageTitle("健康档案")
    val pet = currentPet()
    pageHost.addView(card(
        line(pet?.optString("name") ?: "", 14, 0xFF5C6763.toInt()),
        line(pet?.optString("allergy") ?: "", 13, 0xFF24312E.toInt()),
        button("记一笔") { addHealth() }
    ))
    val rows = PawApi.state.arr("healthRecords").objects().filter { matchesPet(it) }
    if (rows.isEmpty()) pageHost.addView(card(line("还没有健康记录", 14, 0xFF8A918E.toInt())))
    rows.forEach { r ->
        pageHost.addView(card(
            line("${r.optString("category")} · ${r.optString("title")}", 15, 0xFF24312E.toInt()),
            line("${r.optString("date")}  ${r.optString("valueText")}", 13, 0xFF5C6763.toInt()),
            line("${r.optString("hospital")}  ${r.optString("doctor")}", 12, 0xFF8A918E.toInt()),
            line(r.optString("notes"), 12, 0xFF8A918E.toInt())
        ))
    }
}

fun MainActivity.ledgerPage() {
    pageTitle("记账")
    var spend = 0.0
    var income = 0.0
    val rows = PawApi.state.arr("ledgerEntries").objects().filter { matchesPet(it) }
    rows.forEach {
        val n = it.optDouble("amount", 0.0)
        if (it.optString("type") == "收入") income += n else spend += n
    }
    pageHost.addView(card(
        line("支出 ¥${"%.2f".format(spend)} · 收入 ¥${"%.2f".format(income)}", 15, 0xFF24312E.toInt()),
        button("记一笔") { addLedger() }
    ))
    if (rows.isEmpty()) pageHost.addView(card(line("还没有流水", 14, 0xFF8A918E.toInt())))
    rows.forEach { e ->
        val sign = if (e.optString("type") == "收入") "+" else "-"
        pageHost.addView(card(
            line("${e.optString("title")}  $sign¥${e.opt("amount")}", 15, 0xFF24312E.toInt()),
            line("${e.optString("date")} · ${e.optString("category")} · ${e.optString("note")}", 12, 0xFF8A918E.toInt())
        ))
    }
}

fun MainActivity.remindersPage() {
    pageTitle("待办")
    pageHost.addView(card(button("加一条提醒") { addReminder() }))
    val rows = PawApi.state.arr("reminders").objects().filter { matchesPet(it) }
    if (rows.isEmpty()) pageHost.addView(card(line("没有提醒", 14, 0xFF8A918E.toInt())))
    rows.forEach { r ->
        val done = r.optBoolean("done")
        pageHost.addView(card(
            line(r.optString("title"), 15, if (done) 0xFF8A918E.toInt() else 0xFF24312E.toInt()),
            line("${r.optString("time")} · ${r.optString("cycle")} · ${if (done) "已完成" else "未完成"}", 12, 0xFF8A918E.toInt()),
            button(if (done) "改回未完成" else "标成完成") {
                runAction { PawApi.patch("/api/v1/reminders/toggle", JSONObject().put("id", r.optString("id"))) }
            }
        ))
    }
}

fun MainActivity.chatPage() {
    val pet = currentPet()
    pageTitle(pet?.optString("name") ?: "对话")
    val pid = pet?.optString("id").orEmpty()
    val hist = PawApi.state.optJSONObject("aiChatHistories")?.optJSONArray(pid)
    if (hist == null || hist.length() == 0) {
        pageHost.addView(card(line("还没有对话", 14, 0xFF8A918E.toInt())))
    } else {
        hist.objects().takeLast(30).forEach { m ->
            val mine = m.optString("sender") == "user"
            pageHost.addView(card(
                line(if (mine) "我" else pet?.optString("name") ?: "它", 12, 0xFF8A918E.toInt()),
                line(m.optString("text"), 15, 0xFF24312E.toInt()),
                line(m.optString("time"), 11, 0xFF8A918E.toInt())
            ))
        }
    }
    val input = android.widget.EditText(this).apply {
        hint = "跟${pet?.optString("name") ?: "它"}说一句"
        setTextColor(0xFF24312E.toInt())
        setHintTextColor(0xFF8A918E.toInt())
    }
    val box = card(input, button("发送") {
        val text = input.text.toString().trim()
        if (text.isEmpty()) {
            statusView.text = "先写一句话"
            return@button
        }
        runAction {
            PawApi.post(
                "/api/v1/ai/chat",
                JSONObject()
                    .put("petId", pid)
                    .put("personality", pet?.optString("personality") ?: "")
                    .put("message", text)
            )
        }
    })
    pageHost.addView(box)
}

fun MainActivity.servicesPage() {
    pageTitle("医院与服务")
    val svc = PawApi.state.optJSONObject("servicesData") ?: JSONObject()
    pageHost.addView(head("医院").apply { setPadding(dp(16), dp(8), dp(16), 0) })
    svc.arr("hospitals").objects().forEach { h ->
        val tags = h.optJSONArray("tags")
        val tagText = if (tags == null) "" else (0 until tags.length()).joinToString(" · ") { tags.optString(it) }
        pageHost.addView(card(
            line(h.optString("name"), 15, 0xFF24312E.toInt()),
            line("${h.optString("distance")} · ${h.opt("rating")} 分 · ${h.optString("status")}", 12, 0xFF5C6763.toInt()),
            line(tagText, 12, 0xFF8A918E.toInt()),
            line(h.optString("address"), 12, 0xFF8A918E.toInt()),
            quiet("打电话") { dial(h.optString("phone")) }
        ))
    }
    pageHost.addView(head("洗护和寄养").apply { setPadding(dp(16), dp(10), dp(16), 0) })
    svc.arr("groomingBoarding").objects().forEach { s ->
        pageHost.addView(card(
            line(s.optString("title"), 15, 0xFF24312E.toInt()),
            line("${s.optString("shopName")} · ¥${s.opt("price")} · ${s.optString("distance")}", 13, 0xFFEF8466.toInt()),
            line(s.optString("highlights"), 12, 0xFF8A918E.toInt()),
            button("提交预约") { book(s.optString("type"), s.optString("title")) }
        ))
    }
    pageHost.addView(head("托运").apply { setPadding(dp(16), dp(10), dp(16), 0) })
    svc.arr("transportPlans").objects().forEach { s ->
        pageHost.addView(card(
            line(s.optString("mode"), 15, 0xFF24312E.toInt()),
            line("${s.optString("route")} · ¥${s.opt("priceFrom")} 起", 13, 0xFF5C6763.toInt()),
            line(s.optString("includes"), 12, 0xFF8A918E.toInt()),
            button("提交预约") { book("宠物托运", s.optString("mode")) }
        ))
    }
    pageHost.addView(head("问诊").apply { setPadding(dp(16), dp(10), dp(16), 0) })
    svc.arr("onlineDoctors").objects().forEach { d ->
        pageHost.addView(card(
            line(d.optString("name"), 15, 0xFF24312E.toInt()),
            line(d.optString("title"), 12, 0xFF5C6763.toInt()),
            line(d.optString("specialty"), 13, 0xFF24312E.toInt()),
            line("${d.optString("replyTime")} · ${d.optString("fee")}", 12, 0xFF8A918E.toInt()),
            button("提交问诊") { book("线上问诊", d.optString("name")) }
        ))
    }
    pageHost.addView(head("保险").apply { setPadding(dp(16), dp(10), dp(16), 0) })
    svc.arr("insurancePlans").objects().forEach { p ->
        pageHost.addView(card(
            line(p.optString("name"), 15, 0xFF24312E.toInt()),
            line("${p.optString("company")} · ¥${p.opt("monthlyPrice")}/月 · 保额 ${p.opt("annualCoverage")}", 13, 0xFF5C6763.toInt()),
            line(p.optString("reimburseRate"), 12, 0xFF24312E.toInt()),
            line(p.optString("policyStatus"), 12, 0xFF8A918E.toInt()),
            button("提交投保申请") { book("保险", p.optString("name")) }
        ))
    }
    pageHost.addView(head("已提交的申请").apply { setPadding(dp(16), dp(10), dp(16), 0) })
    val bookings = svc.arr("bookings").objects()
    if (bookings.isEmpty()) pageHost.addView(card(line("还没有申请", 14, 0xFF8A918E.toInt())))
    bookings.forEach { b ->
        pageHost.addView(card(
            line(b.optString("title"), 14, 0xFF24312E.toInt()),
            line("${b.optString("date")} · ${b.optString("petName")} · ${b.optString("status")}", 12, 0xFF8A918E.toInt())
        ))
    }
}

fun MainActivity.albumPage() {
    pageTitle("相册")
    val album = PawApi.state.optJSONObject("albumState") ?: JSONObject()
    val photos = album.arr("photos")
    var used = 0L
    for (i in 0 until photos.length()) used += photos.getJSONObject(i).optLong("sizeBytes")
    val quota = album.optLong("freeQuotaBytes") + album.optLong("extraQuotaBytes")
    pageHost.addView(card(
        line(album.optString("planName"), 14, 0xFF24312E.toInt()),
        line("已用 ${mbText(used)} / ${mbText(quota)}", 13, 0xFF5C6763.toInt()),
        button("从手机选一张照片") {
            prompt("照片标题", listOf("标题", "标签，例如日常")) { v ->
                pendingPhotoTitle = v.getOrElse(0) { "" }.ifBlank { "手机相册" }
                pendingPhotoTag = v.getOrElse(1) { "" }.ifBlank { "日常记录" }
                pickPhoto()
            }
        },
        quiet("扩容 10GB / 50GB") {
            android.widget.Toast.makeText(this, "支付还没开通，相册空间不会增加", android.widget.Toast.LENGTH_LONG).show()
            statusView.text = "支付还没开通，相册空间不会增加"
        }
    ))
    val mine = photos.objects().filter { matchesPet(it) }
    val show = if (mine.isEmpty()) photos.objects() else mine
    if (show.isEmpty()) pageHost.addView(card(line("相册是空的", 14, 0xFF8A918E.toInt())))
    show.forEach { p ->
        pageHost.addView(card(
            line(p.optString("title"), 15, 0xFF24312E.toInt()),
            line("${p.optString("date")} · ${p.optString("tag")} · ${mbText(p.optLong("sizeBytes"))}", 12, 0xFF8A918E.toInt())
        ))
    }
}

private fun MainActivity.addPet() {
    choose("物种", listOf("猫", "狗", "异宠")) { species ->
        prompt("新宠物", listOf("名字", "品种", "性别", "体重公斤")) { v ->
            if (v[0].isBlank() || v.getOrElse(1) { "" }.isBlank()) {
                statusView.text = "名字和品种要填"
                return@prompt
            }
            runAction {
                PawApi.post(
                    "/api/v1/pets",
                    JSONObject()
                        .put("name", v[0])
                        .put("species", species)
                        .put("breed", v[1])
                        .put("gender", v.getOrElse(2) { "" })
                        .put("weightKg", v.getOrElse(3) { "" })
                )
            }
        }
    }
}

private fun MainActivity.addHealth() {
    choose("类型", listOf("疫苗", "驱虫", "体重", "体温", "看病")) { cat ->
        prompt(cat, listOf("项目名称", "结果或数值", "医院或地点", "下次日期，可空", "备注")) { v ->
            if (v[0].isBlank()) {
                statusView.text = "请填写项目名称"
                return@prompt
            }
            runAction {
                PawApi.post(
                    "/api/v1/health/records",
                    JSONObject()
                        .put("petId", currentPet()?.optString("id"))
                        .put("category", cat)
                        .put("title", v[0])
                        .put("valueText", v.getOrElse(1) { "" })
                        .put("hospital", v.getOrElse(2) { "" })
                        .put("nextDate", v.getOrElse(3) { "" })
                        .put("notes", v.getOrElse(4) { "" })
                )
            }
        }
    }
}

private fun MainActivity.addLedger() {
    choose("收支", listOf("支出", "收入")) { type ->
        prompt(type, listOf("摘要", "金额", "分类", "备注")) { v ->
            runAction {
                PawApi.post(
                    "/api/v1/ledger/entries",
                    JSONObject()
                        .put("petId", currentPet()?.optString("id"))
                        .put("type", type)
                        .put("title", v.getOrElse(0) { "" })
                        .put("amount", v.getOrElse(1) { "" })
                        .put("category", v.getOrElse(2) { "" }.ifBlank { "饮食口粮" })
                        .put("note", v.getOrElse(3) { "" })
                )
            }
        }
    }
}

private fun MainActivity.addReminder() {
    prompt("新提醒", listOf("要做的事", "时间，例如今日 20:00", "分类")) { v ->
        runAction {
            PawApi.post(
                "/api/v1/reminders",
                JSONObject()
                    .put("petId", currentPet()?.optString("id"))
                    .put("title", v.getOrElse(0) { "" })
                    .put("time", v.getOrElse(1) { "" })
                    .put("category", v.getOrElse(2) { "" }.ifBlank { "日常护理" })
            )
        }
    }
}

private fun MainActivity.book(type: String, title: String) {
    runAction {
        PawApi.post(
            "/api/v1/services/book",
            JSONObject()
                .put("serviceType", type)
                .put("title", title)
                .put("petName", currentPet()?.optString("name") ?: "")
                .put("date", nowText())
        )
    }
}

private fun MainActivity.petNames(): List<String> =
    PawApi.state.arr("pets").objects().map { it.optString("name") }

private fun MainActivity.petIdByName(name: String): String? =
    PawApi.state.arr("pets").objects().firstOrNull { it.optString("name") == name }?.optString("id")

private fun MainActivity.matchesPet(row: JSONObject): Boolean {
    val id = currentPet()?.optString("id") ?: return true
    val pid = row.optString("petId")
    return pid.isEmpty() || pid == id
}
