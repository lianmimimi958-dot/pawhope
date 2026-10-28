package cn.pawhope.app

import org.json.JSONObject

fun MainActivity.mallPage() {
    pageTitle("商城")
    pageHost.addView(chips(listOf("全部", "猫", "狗", "异宠"), mallCat) {
        mallCat = it
        render()
    })
    val cartCount = PawApi.state.arr("cartItems").length()
    pageHost.addView(card(
        line("购物车 $cartCount 件", 14, 0xFF24312E.toInt()),
        button("打开购物车") { openScreen("cart") }
    ))
    val goods = PawApi.state.arr("mallProducts").objects().filter {
        mallCat == "全部" || it.optString("category") == mallCat
    }
    if (goods.isEmpty()) pageHost.addView(card(line("这个分类没有商品", 14, 0xFF8A918E.toInt())))
    goods.forEach { g ->
        val specs = g.optJSONArray("specs")
        val specText = if (specs == null) "" else (0 until specs.length()).joinToString(" / ") { specs.optString(it) }
        pageHost.addView(card(
            line(g.optString("badge"), 12, 0xFFEF8466.toInt()),
            line(g.optString("title"), 15, 0xFF24312E.toInt()),
            line(g.optString("subtitle"), 12, 0xFF5C6763.toInt()),
            line("¥${g.opt("price")}  ${g.optString("salesText")}", 14, 0xFFEF8466.toInt()),
            line(g.optString("shopName"), 12, 0xFF8A918E.toInt()),
            line(specText, 12, 0xFF8A918E.toInt()),
            button("加入购物车") {
                val options = if (specs == null || specs.length() == 0) listOf("") else (0 until specs.length()).map { specs.getString(it) }
                if (options.size <= 1) {
                    addCart(g.optString("id"), options.firstOrNull().orEmpty())
                } else {
                    choose("规格", options) { spec -> addCart(g.optString("id"), spec) }
                }
            }
        ))
    }
}

fun MainActivity.cartPage() {
    pageTitle("购物车")
    val items = PawApi.state.arr("cartItems").objects()
    if (items.isEmpty()) {
        pageHost.addView(card(line("购物车是空的", 14, 0xFF8A918E.toInt())))
        return
    }
    var raw = 0.0
    var checked = 0
    items.forEach { c ->
        if (c.optBoolean("checked")) {
            checked++
            raw += c.optDouble("price") * c.optInt("qty")
        }
    }
    val pay = kotlin.math.round(raw * 0.95 * 100) / 100.0
    pageHost.addView(card(
        line("已勾选 $checked 件，预估实付 ¥${"%.2f".format(pay)}（金卡 95 折，以服务器结算为准）", 13, 0xFF24312E.toInt()),
        quiet(if (checked == items.size) "取消全选" else "全选") {
            val all = checked != items.size
            runAction {
                PawApi.patch("/api/v1/mall/cart/update", JSONObject().put("action", "TOGGLE_ALL").put("checkedAll", all))
            }
        },
        button("结算") { runAction { PawApi.post("/api/v1/orders/checkout", JSONObject()) } }
    ))
    items.forEach { c ->
        pageHost.addView(card(
            line(c.optString("title"), 15, 0xFF24312E.toInt()),
            line("${c.optString("spec")} · ¥${c.opt("price")} × ${c.optInt("qty")}", 13, 0xFFEF8466.toInt()),
            line(c.optString("shopName"), 12, 0xFF8A918E.toInt()),
            button(if (c.optBoolean("checked")) "取消勾选" else "勾选") { cartAct(c, "TOGGLE") },
            quiet("加一件") { cartAct(c, "INC") },
            quiet("减一件") { cartAct(c, "DEC") },
            quiet("移出") { cartAct(c, "REMOVE") }
        ))
    }
}

private fun MainActivity.addCart(productId: String, spec: String) {
    runAction {
        PawApi.post("/api/v1/mall/cart/add", JSONObject().put("productId", productId).put("spec", spec))
    }
}

private fun MainActivity.cartAct(item: JSONObject, action: String) {
    runAction {
        PawApi.patch(
            "/api/v1/mall/cart/update",
            JSONObject().put("cartId", item.optString("id")).put("action", action)
        )
    }
}
