package cn.pawhope.app

import android.widget.CompoundButton
import org.json.JSONArray
import org.json.JSONObject

fun MainActivity.minePage() {
    val user = PawApi.state.optJSONObject("currentUser") ?: JSONObject()
    pageTitle(user.optString("nickname", "我的"))
    pageHost.addView(card(
        head(user.optString("nickname")),
        line(user.optString("signature"), 13, 0xFF5C6763.toInt()),
        line("${user.optString("phoneMasked")} · ${user.optString("city")}", 13, 0xFF8A918E.toInt()),
        line(user.optString("vipLevel"), 14, 0xFF1F7A68.toInt()),
        line("积分 ${user.opt("vipPoints")} / ${user.opt("vipNextPoints")} · 到期 ${user.optString("vipExpireDate")}", 12, 0xFF8A918E.toInt()),
        quiet("改资料") { openScreen("profile") }
    ))
    user.arr("vipBenefits").objects().forEach { b ->
        pageHost.addView(card(
            line(b.optString("title"), 14, 0xFF24312E.toInt()),
            line(b.optString("desc"), 12, 0xFF8A918E.toInt())
        ))
    }
    val menu = card(head("常用"))
    menu.addView(quiet("订单") { openScreen("orders") })
    menu.addView(quiet("收货地址") { openScreen("address") })
    menu.addView(quiet("共享宠物") { openScreen("share") })
    menu.addView(quiet("关于、协议和客服") { docKey = "about"; openScreen("docs") })
    pageHost.addView(menu)
    val settings = user.optJSONObject("settings") ?: JSONObject()
    val box = card(head("提醒开关"))
    listOf(
        "pushReminder" to "待办推送",
        "feedingAlert" to "喂食提醒",
        "fenceAlert" to "围栏提醒"
    ).forEach { (key, label) ->
        val sw = android.widget.Switch(this).apply {
            text = label
            isChecked = settings.optBoolean(key)
            setOnCheckedChangeListener { _: CompoundButton, checked: Boolean ->
                if (checked == settings.optBoolean(key)) return@setOnCheckedChangeListener
                runAction {
                    PawApi.patch(
                        "/api/v1/user/profile",
                        JSONObject().put("settings", JSONObject().put(key, checked))
                    )
                }
            }
        }
        box.addView(sw)
    }
    pageHost.addView(box)
}

fun MainActivity.ordersPage() {
    pageTitle("订单")
    val orders = PawApi.state.arr("orders").objects()
    if (orders.isEmpty()) pageHost.addView(card(line("还没有订单", 14, 0xFF8A918E.toInt())))
    orders.forEach { o ->
        val box = card(
            line("${o.optString("status")}  ${o.optString("id")}", 14, 0xFF1F7A68.toInt()),
            line(o.optString("shopName"), 13, 0xFF24312E.toInt()),
            line("¥${o.opt("totalAmount")} · ${o.optString("createdAt")}", 13, 0xFFEF8466.toInt()),
            line(o.optString("note"), 12, 0xFF8A918E.toInt())
        )
        o.arr("items").objects().forEach { item ->
            box.addView(line("${item.optString("title")} ${item.optString("spec")} × ${item.optInt("qty")}  ¥${item.opt("price")}", 12, 0xFF5C6763.toInt()))
        }
        when (o.optString("status")) {
            "待付款" -> box.addView(line("支付通道还没接上，这笔订单保持待付款。", 13, 0xFFB86A12.toInt()))
            "待使用" -> {
                box.addView(button("确认完成") { orderTo(o, "已完成") })
                box.addView(quiet("申请退款") { orderTo(o, "退款/售后") })
            }
            "已完成" -> box.addView(quiet("申请售后") { orderTo(o, "退款/售后") })
        }
        pageHost.addView(box)
    }
}

fun MainActivity.addressPage() {
    pageTitle("收货地址")
    pageHost.addView(card(button("新增地址") {
        prompt("新地址", listOf("收货人", "电话", "地区", "详细地址", "标签，例如家")) { v ->
            runAction {
                PawApi.post(
                    "/api/v1/user/addresses",
                    JSONObject()
                        .put("name", v.getOrElse(0) { "" })
                        .put("phone", v.getOrElse(1) { "" })
                        .put("region", v.getOrElse(2) { "" })
                        .put("detail", v.getOrElse(3) { "" })
                        .put("tag", v.getOrElse(4) { "" }.ifBlank { "家" })
                        .put("isDefault", true)
                )
            }
        }
    }))
    PawApi.state.arr("addresses").objects().forEach { a ->
        pageHost.addView(card(
            line("${a.optString("name")}  ${a.optString("phone")}  ${a.optString("tag")}", 15, 0xFF24312E.toInt()),
            line("${a.optString("region")} ${a.optString("detail")}", 13, 0xFF5C6763.toInt()),
            line(if (a.optBoolean("isDefault")) "默认地址" else "", 12, 0xFF1F7A68.toInt())
        ))
    }
}

fun MainActivity.profilePage() {
    val user = PawApi.state.optJSONObject("currentUser") ?: JSONObject()
    pageTitle("资料")
    pageHost.addView(card(button("保存新资料") {
        prompt("资料", listOf("昵称", "签名", "城市")) { v ->
            runAction {
                PawApi.patch(
                    "/api/v1/user/profile",
                    JSONObject()
                        .put("nickname", v.getOrElse(0) { "" }.ifBlank { user.optString("nickname") })
                        .put("signature", v.getOrElse(1) { "" }.ifBlank { user.optString("signature") })
                        .put("city", v.getOrElse(2) { "" }.ifBlank { user.optString("city") })
                )
            }
        }
    }))
    pageHost.addView(card(
        line(user.optString("nickname"), 16, 0xFF24312E.toInt()),
        line(user.optString("signature"), 13, 0xFF5C6763.toInt()),
        line(user.optString("city"), 13, 0xFF8A918E.toInt())
    ))
}

fun MainActivity.sharePage() {
    pageTitle("共享宠物")
    pageHost.addView(card(button("加上一位亲友") {
        prompt("共享", listOf("对方昵称", "关系，例如家人")) { v ->
            runAction {
                PawApi.post(
                    "/api/v1/user/share-pet",
                    JSONObject().put("name", v.getOrElse(0) { "" }).put("role", v.getOrElse(1) { "" })
                )
            }
        }
    }))
    PawApi.state.arr("sharedMembers").objects().forEach { m ->
        val pets = m.optJSONArray("sharedPets")
        val names = if (pets == null) "" else (0 until pets.length()).joinToString("、") { pets.optString(it) }
        pageHost.addView(card(
            line("${m.optString("name")} · ${m.optString("role")}", 15, 0xFF24312E.toInt()),
            line(names, 13, 0xFF5C6763.toInt()),
            line(m.optString("permissions"), 12, 0xFF8A918E.toInt()),
            line(m.optString("joinedAt"), 12, 0xFF8A918E.toInt())
        ))
    }
}

fun MainActivity.docsPage() {
    pageTitle("说明")
    pageHost.addView(chips(listOf("关于", "协议", "客服", "公告"), docLabel(docKey)) {
        docKey = when (it) {
            "协议" -> "agreement"
            "客服" -> "service"
            "公告" -> "news"
            else -> "about"
        }
        render()
    })
    val docs = PawApi.state.optJSONObject("complianceDocs") ?: JSONObject()
    when (docKey) {
        "agreement" -> {
            val d = docs.optJSONObject("userAgreement") ?: JSONObject()
            pageHost.addView(card(head(d.optString("title")), line(d.optString("version"), 12, 0xFF8A918E.toInt()), line(d.optString("content"), 14, 0xFF24312E.toInt())))
        }
        "service" -> {
            val d = docs.optJSONObject("customerService") ?: JSONObject()
            val box = card(
                head(d.optString("title")),
                line(d.optString("hotline"), 14, 0xFF24312E.toInt()),
                line("微信 ${d.optString("wechat")}", 13, 0xFF5C6763.toInt()),
                quiet("拨打热线") {
                    val digits = d.optString("hotline").substringBefore(" ").replace("-", "")
                    dial(digits)
                }
            )
            val faq = d.optJSONArray("faq") ?: JSONArray()
            for (i in 0 until faq.length()) box.addView(line(faq.optString(i), 13, 0xFF24312E.toInt()))
            pageHost.addView(box)
        }
        "news" -> {
            docs.arr("announcements").objects().forEach { a ->
                pageHost.addView(card(
                    line(a.optString("date"), 12, 0xFF8A918E.toInt()),
                    line(a.optString("title"), 15, 0xFF24312E.toInt()),
                    line(a.optString("summary"), 13, 0xFF5C6763.toInt())
                ))
            }
        }
        else -> {
            val d = docs.optJSONObject("aboutUs") ?: JSONObject()
            pageHost.addView(card(head(d.optString("title")), line(d.optString("version"), 12, 0xFF8A918E.toInt()), line(d.optString("content"), 14, 0xFF24312E.toInt())))
        }
    }
}

private fun docLabel(key: String) = when (key) {
    "agreement" -> "协议"
    "service" -> "客服"
    "news" -> "公告"
    else -> "关于"
}

private fun MainActivity.orderTo(order: JSONObject, next: String) {
    runAction {
        PawApi.patch(
            "/api/v1/orders/status",
            JSONObject().put("orderId", order.optString("id")).put("nextStatus", next)
        )
    }
}
