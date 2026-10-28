package cn.pawhope.app

import android.widget.EditText
import org.json.JSONObject

fun MainActivity.socialPage() {
    pageTitle("萌圈")
    val nav = card(head("看看"))
    nav.addView(quiet("能不能吃") { openScreen("food") })
    nav.addView(quiet("附近的宠友") { openScreen("friends") })
    nav.addView(button("发一条") {
        choose("类型", listOf("动态", "文章")) { type ->
            prompt(type, listOf("标题", "正文")) { v ->
                runAction {
                    PawApi.post(
                        "/api/v1/social/posts",
                        JSONObject()
                            .put("type", type)
                            .put("title", v.getOrElse(0) { "" })
                            .put("content", v.getOrElse(1) { "" })
                            .put("petTag", currentPet()?.optString("name") ?: "")
                    )
                }
            }
        }
    })
    pageHost.addView(nav)
    val posts = PawApi.state.arr("socialPosts").objects()
    if (posts.isEmpty()) pageHost.addView(card(line("还没有动态", 14, 0xFF8A918E.toInt())))
    posts.forEach { p ->
        pageHost.addView(card(
            line(p.optString("title"), 16, 0xFF24312E.toInt()),
            line("${p.optString("author")} · ${p.optString("authorBadge")} · ${p.optString("time")}", 12, 0xFF8A918E.toInt()),
            line(p.optString("petTag"), 12, 0xFF1F7A68.toInt()),
            line(p.optString("content"), 14, 0xFF24312E.toInt()),
            button(if (p.optBoolean("liked")) "取消赞 ${p.optInt("likes")}" else "赞 ${p.optInt("likes")}") {
                runAction { PawApi.patch("/api/v1/social/like", JSONObject().put("postId", p.optString("id"))) }
            }
        ))
    }
}

fun MainActivity.foodPage() {
    pageTitle("能不能吃")
    pageHost.addView(chips(listOf("全部", "能吃", "慎吃", "不能吃"), foodLevel) {
        foodLevel = it
        render()
    })
    val input = EditText(this).apply {
        hint = "搜食材"
        setText(foodQuery)
        setTextColor(0xFF24312E.toInt())
        setHintTextColor(0xFF8A918E.toInt())
    }
    pageHost.addView(card(input, button("查找") {
        foodQuery = input.text.toString().trim()
        render()
    }))
    val rows = PawApi.state.arr("foodRecipes").objects().filter { row ->
        val levelOk = foodLevel == "全部" || row.optString("safetyLevel") == foodLevel
        val q = foodQuery
        val text = row.optString("name") + row.optString("summary") + row.optString("category")
        levelOk && (q.isEmpty() || text.contains(q))
    }
    if (rows.isEmpty()) pageHost.addView(card(line("没有这种食材", 14, 0xFF8A918E.toInt())))
    rows.forEach { f ->
        val color = when (f.optString("safetyLevel")) {
            "能吃" -> 0xFF1F7A68.toInt()
            "不能吃" -> 0xFFC4483A.toInt()
            else -> 0xFFB86A12.toInt()
        }
        pageHost.addView(card(
            line("${f.optString("safetyLevel")}  ${f.optString("name")}", 16, color),
            line("${f.optString("category")} · ${f.optString("suitableFor")}", 12, 0xFF8A918E.toInt()),
            line(f.optString("summary"), 14, 0xFF24312E.toInt()),
            line(f.optString("detail"), 13, 0xFF5C6763.toInt())
        ))
    }
}

fun MainActivity.friendsPage() {
    pageTitle("宠友")
    val rows = PawApi.state.arr("petFriends").objects()
    if (rows.isEmpty()) pageHost.addView(card(line("附近还没有宠友", 14, 0xFF8A918E.toInt())))
    rows.forEach { f ->
        pageHost.addView(card(
            line("${f.optString("ownerName")} · ${f.optString("petName")}", 15, 0xFF24312E.toInt()),
            line(f.optString("distance"), 12, 0xFF8A918E.toInt()),
            line(f.optString("intro"), 13, 0xFF5C6763.toInt()),
            button(if (f.optBoolean("followed")) "取消关注" else "关注") {
                runAction { PawApi.patch("/api/v1/social/friend", JSONObject().put("friendId", f.optString("id"))) }
            }
        ))
    }
}
