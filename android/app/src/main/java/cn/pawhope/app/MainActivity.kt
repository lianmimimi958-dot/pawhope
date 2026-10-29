package cn.pawhope.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class MainActivity : AppCompatActivity() {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    lateinit var pageHost: LinearLayout
    lateinit var statusView: TextView
    private val tabButtons = mutableListOf<TextView>()
    var screen = "home"
    val stack = ArrayDeque<String>()
    var busy = false
    var foodLevel = "全部"
    var foodQuery = ""
    var mallCat = "全部"
    var docKey = "about"
    var pendingPhotoTitle = "手机相册"
    var pendingPhotoTag = "日常记录"

    private val pickImage = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@registerForActivityResult
        val len = contentResolver.openFileDescriptor(uri, "r")?.use { it.statSize } ?: 0L
        if (len <= 0L) {
            statusView.text = "没有读到这张照片"
            return@registerForActivityResult
        }
        val mb = ((len + 1048575L) / 1048576L).toInt().coerceIn(1, 200)
        val petId = currentPet()?.optString("id").orEmpty()
        runAction {
            PawApi.post(
                "/api/v1/album/upload",
                JSONObject()
                    .put("petId", petId)
                    .put("title", pendingPhotoTitle)
                    .put("tag", pendingPhotoTag)
                    .put("sizeMB", mb)
            )
        }
    }

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        intent.getStringExtra("origin")?.trimEnd('/')?.let { extra ->
            if (extra.startsWith("http://") || extra.startsWith("https://")) PawApi.origin = extra
        }
        WalkSession.onUpdate = {
            if (WalkSession.watching) {
                statusView.text = "正在记录轨迹，已收到 ${WalkSession.points.length()} 个点"
            }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (!goBack()) finish()
            }
        })
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFFF5F7F6.toInt())
        }
        statusView = line("正在连接 pawhope.cn", 13, 0xFF1F7A68.toInt()).apply {
            setPadding(dp(16), dp(12), dp(16), dp(4))
        }
        pageHost = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val scroll = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
            addView(pageHost)
        }
        root.addView(statusView)
        root.addView(scroll)
        root.addView(tabBar())
        setContentView(root)
        reload()
    }

    override fun onDestroy() {
        WalkSession.onUpdate = null
        scope.cancel()
        super.onDestroy()
    }

    private fun tabBar(): LinearLayout {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(0xFFFFFFFF.toInt())
            setPadding(0, dp(6), 0, dp(8))
        }
        listOf("首页", "设备", "萌圈", "商城", "我的").forEachIndexed { i, name ->
            val b = TextView(this).apply {
                text = name
                gravity = Gravity.CENTER
                textSize = 13f
                layoutParams = LinearLayout.LayoutParams(0, dp(48), 1f)
                setOnClickListener { selectTab(i) }
            }
            tabButtons += b
            bar.addView(b)
        }
        return bar
    }

    fun selectTab(i: Int) {
        stack.clear()
        screen = listOf("home", "device", "social", "mall", "mine")[i]
        render()
    }

    fun tabIndex(): Int = when (screen) {
        "device" -> 1
        "social", "food", "friends" -> 2
        "mall", "cart" -> 3
        "mine", "orders", "address", "profile", "docs", "share" -> 4
        else -> 0
    }

    fun openScreen(next: String) {
        stack.addLast(screen)
        screen = next
        render()
    }

    fun goBack(): Boolean {
        if (stack.isNotEmpty()) {
            screen = stack.removeLast()
            render()
            return true
        }
        val root = listOf("home", "device", "social", "mall", "mine")[tabIndex()]
        if (screen != root) {
            screen = root
            render()
            return true
        }
        return false
    }

    fun reload() {
        scope.launch {
            statusView.text = "正在读取你的数据"
            val err = withContext(Dispatchers.IO) {
                try {
                    PawApi.bootstrap()
                    null
                } catch (e: Exception) {
                    e.message ?: "连接失败"
                }
            }
            statusView.text = err ?: "已连接 ${PawApi.origin}"
            render()
        }
    }

    fun render() {
        if (!::pageHost.isInitialized) return
        tabButtons.forEachIndexed { i, b ->
            val on = i == tabIndex()
            b.setTextColor(if (on) 0xFF1F7A68.toInt() else 0xFF8A918E.toInt())
            b.setTypeface(null, if (on) Typeface.BOLD else Typeface.NORMAL)
        }
        pageHost.removeAllViews()
        if (!PawApi.state.has("pets")) {
            pageHost.addView(card(line(statusView.text.toString(), 15, 0xFF24312E.toInt())))
            return
        }
        when (screen) {
            "home" -> homePage()
            "health" -> healthPage()
            "ledger" -> ledgerPage()
            "reminders" -> remindersPage()
            "chat" -> chatPage()
            "services" -> servicesPage()
            "album" -> albumPage()
            "device" -> devicePage()
            "social" -> socialPage()
            "food" -> foodPage()
            "friends" -> friendsPage()
            "mall" -> mallPage()
            "cart" -> cartPage()
            "mine" -> minePage()
            "orders" -> ordersPage()
            "address" -> addressPage()
            "profile" -> profilePage()
            "docs" -> docsPage()
            "share" -> sharePage()
            else -> homePage()
        }
    }

    fun runAction(block: () -> ApiResult) {
        if (busy) return
        busy = true
        statusView.text = "处理中"
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                try {
                    block()
                } catch (e: Exception) {
                    ApiResult(0, -1, e.message ?: "网络失败", JSONObject())
                }
            }
            busy = false
            statusView.text = result.message
            Toast.makeText(this@MainActivity, result.message, Toast.LENGTH_LONG).show()
            render()
        }
    }

    fun currentPet(): JSONObject? {
        val id = PawApi.state.optString("currentPetId")
        val pets = PawApi.state.arr("pets")
        for (i in 0 until pets.length()) {
            val p = pets.getJSONObject(i)
            if (p.optString("id") == id) return p
        }
        return if (pets.length() > 0) pets.getJSONObject(0) else null
    }

    fun prompt(title: String, labels: List<String>, onOk: (List<String>) -> Unit) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), dp(4))
        }
        val edits = labels.map { label ->
            EditText(this).apply {
                hint = label
                setTextColor(0xFF24312E.toInt())
                setHintTextColor(0xFF8A918E.toInt())
            }.also { box.addView(it) }
        }
        AlertDialog.Builder(this)
            .setTitle(title)
            .setView(box)
            .setPositiveButton("确定") { _, _ -> onOk(edits.map { it.text.toString().trim() }) }
            .setNegativeButton("取消", null)
            .show()
    }

    fun choose(title: String, options: List<String>, onPick: (String) -> Unit) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setItems(options.toTypedArray()) { _, which -> onPick(options[which]) }
            .show()
    }

    fun pageTitle(title: String) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), dp(8), dp(12), dp(2))
        }
        if (screen !in listOf("home", "device", "social", "mall", "mine")) {
            row.addView(TextView(this).apply {
                text = "返回"
                setTextColor(0xFF1F7A68.toInt())
                textSize = 15f
                setPadding(dp(8), dp(8), dp(12), dp(8))
                setOnClickListener { goBack() }
            })
        }
        row.addView(TextView(this).apply {
            text = title
            textSize = 20f
            setTextColor(0xFF24312E.toInt())
            setTypeface(null, Typeface.BOLD)
        })
        pageHost.addView(row)
    }

    fun card(vararg children: View): LinearLayout {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = round(0xFFFFFFFF.toInt(), 16)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.setMargins(dp(12), dp(8), dp(12), 0)
            layoutParams = lp
        }
        children.forEach { box.addView(it) }
        return box
    }

    fun head(s: String) = line(s, 18, 0xFF24312E.toInt()).apply { setTypeface(null, Typeface.BOLD) }

    fun line(s: String, size: Int, color: Int) = TextView(this).apply {
        text = s
        textSize = size.toFloat()
        setTextColor(color)
        setPadding(0, dp(2), 0, dp(2))
    }

    fun button(label: String, click: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setTextColor(0xFFFFFFFF.toInt())
        background = round(0xFF3FB59D.toInt(), 12)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(8)
        }
        setOnClickListener { click() }
    }

    fun quiet(label: String, click: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setTextColor(0xFF1F7A68.toInt())
        background = GradientDrawable().apply {
            setColor(0xFFFFFFFF.toInt())
            cornerRadius = dp(12).toFloat()
            setStroke(dp(1), 0xFF3FB59D.toInt())
        }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(8)
        }
        setOnClickListener { click() }
    }

    fun chips(labels: List<String>, selected: String, onPick: (String) -> Unit): HorizontalScrollView {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(12), dp(6), dp(12), dp(2))
        }
        labels.forEach { name ->
            row.addView(TextView(this).apply {
                text = name
                textSize = 13f
                setPadding(dp(12), dp(6), dp(12), dp(6))
                val on = name == selected
                setTextColor(if (on) 0xFFFFFFFF.toInt() else 0xFF1F7A68.toInt())
                background = round(if (on) 0xFF3FB59D.toInt() else 0xFFFFFFFF.toInt(), 20)
                setOnClickListener { onPick(name) }
            })
        }
        return HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(row)
        }
    }

    fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun round(color: Int, radiusDp: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radiusDp).toFloat()
    }

    fun nowText(): String = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))

    fun dial(phone: String) {
        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
    }

    fun map(lat: Double, lng: Double) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng")))
    }

    fun pickPhoto() {
        pickImage.launch("image/*")
    }

    fun startWalk() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 21)
            statusView.text = "需要定位权限才能记录轨迹"
            return
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 22)
            statusView.text = "记录过程中会显示一条通知，需要允许通知"
            return
        }
        WalkSession.reset()
        ContextCompat.startForegroundService(this, Intent(this, WalkService::class.java))
        statusView.text = "遛弯已开始，请带着手机走"
        render()
    }

    fun stopWalk() {
        val points = WalkSession.copy()
        stopService(Intent(this, WalkService::class.java))
        if (points.length() < 2) {
            statusView.text = "定位点不够，这次没有保存"
            Toast.makeText(this, "至少要走出两个有效定位点", Toast.LENGTH_LONG).show()
            render()
            return
        }
        runAction {
            PawApi.post(
                "/api/v1/devices/command",
                JSONObject().put("command", "LOG_WALK").put("track", points).put("routeNote", "手机 App 记录")
            )
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED && (requestCode == 21 || requestCode == 22)) {
            startWalk()
        }
    }
}

fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

fun mbText(bytes: Long): String = String.format("%.1f MB", bytes / 1048576.0)
