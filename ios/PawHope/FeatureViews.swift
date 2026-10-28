import SwiftUI
import UIKit

struct DeviceView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let dev = store.state.obj("devicesState")
        let feeder = dev.obj("feeder")
        let fountain = dev.obj("fountain")
        let collar = dev.obj("collar")
        PageHead(title: "设备")
        Card {
            Text(feeder.obj("name").str.isEmpty ? "食碗" : feeder.obj("name").str).font(.headline)
            Text(feeder.obj("online").bool ? "在线" : "离线").font(.footnote).foregroundColor(.mint)
            Text("碗里 \(feeder.obj("bowlRemainGrams").str) g · 今天吃了 \(feeder.obj("todayEatenGrams").str) g")
            Text("粮仓 \(feeder.obj("hopperRemainGrams").str) g · 已喂 \(feeder.obj("todayFedCount").str) 次 / \(feeder.obj("todayFedGrams").str) g · 上次 \(feeder.obj("lastFeedTime").str)")
                .font(.footnote).foregroundColor(.muted)
            ForEach(Array(feeder.arr("schedules").enumerated()), id: \.offset) { _, s in
                Text("\(s.obj("time").str) \(s.obj("label").str) \(s.obj("grams").str) g（\(s.obj("enabled").bool ? "开" : "关")）")
                    .font(.footnote).foregroundColor(.muted)
            }
            MintButton(title: "现在出粮") {
                store.ask("出粮", ["克数，5 到 100"]) { v in
                    let grams = Int(v.first ?? "") ?? 10
                    Task { await store.post("/api/v1/devices/command", ["command": "FEED_NOW", "grams": grams]) }
                }
            }
        }
        Card {
            Text(fountain.obj("name").str.isEmpty ? "饮水机" : fountain.obj("name").str).font(.headline)
            Text("水位 \(fountain.obj("waterLevelPercent").str)% · 滤芯 \(fountain.obj("filterLifePercent").str)% · \(fountain.obj("waterTempC").str) °C")
            Text("今天喝了 \(fountain.obj("todayDrinkCount").str) 次 / \(fountain.obj("todayDrinkMl").str) ml · \(fountain.obj("mode").str)")
                .font(.footnote).foregroundColor(.muted)
            MintButton(title: "换水冲刷") {
                Task { await store.post("/api/v1/devices/command", ["command": "WATER_FLUSH"]) }
            }
        }
        Card {
            Text(collar.obj("name").str.isEmpty ? "项圈" : collar.obj("name").str).font(.headline)
            Text("电量 \(collar.obj("batteryPercent").str)% · \(collar.obj("signalStrength").str)").font(.footnote)
            Text(collar.obj("locationName").str).font(.footnote)
            Text(collar.obj("cameraSnapshotTag").str).font(.footnote).foregroundColor(.muted)
            Text(collar.obj("inSafeFence").bool ? "在围栏内" : "已离开围栏").foregroundColor(.mint)
            MintButton(title: collar.obj("buzzerActive").bool ? "关闭寻宠" : "让项圈响") {
                Task { await store.post("/api/v1/devices/command", ["command": "LOCATE_BUZZ"]) }
            }
            QuietButton(title: "在地图里看位置") {
                let lat = collar.obj("lat").str
                let lng = collar.obj("lng").str
                if let url = URL(string: "http://maps.apple.com/?ll=\(lat),\(lng)") {
                    UIApplication.shared.open(url)
                }
            }
        }
        Card {
            Text("遛弯").font(.headline)
            Text(store.watching ? "记录中，\(store.trackCount) 个定位点" : "用手机 GPS 记录，不手填地点")
            MintButton(title: store.watching ? "结束并保存" : "开始遛弯") {
                if store.watching { Task { await store.stopWalk() } } else { store.startWalk() }
            }
        }
        ForEach(Array(dev.arr("walkRoutes").prefix(20).enumerated()), id: \.offset) { _, w in
            Card {
                Text("\(w.obj("petName").str)  \(w.obj("date").str)")
                Text("\(w.obj("distanceKm").str) km · \(w.obj("durationMin").str) 分钟 · \(w.obj("caloriesKcal").str) kcal").font(.footnote)
                Text(w.obj("routeSummary").str).font(.footnote).foregroundColor(.muted)
            }
        }
    }
}

struct SocialView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        PageHead(title: "萌圈")
        Card {
            Text("看看").font(.headline)
            QuietButton(title: "能不能吃") { store.open("food") }
            QuietButton(title: "附近的宠友") { store.open("friends") }
            MintButton(title: "发一条") {
                store.pick("类型", ["动态", "文章"]) { type in
                    store.ask(type, ["标题", "正文"]) { v in
                        Task {
                            await store.post("/api/v1/social/posts", [
                                "type": type,
                                "title": v.first ?? "",
                                "content": v.count > 1 ? v[1] : "",
                                "petTag": store.pet()?.obj("name").str ?? ""
                            ])
                        }
                    }
                }
            }
        }
        let posts = store.state.arr("socialPosts")
        if posts.isEmpty { Card { Text("还没有动态").foregroundColor(.muted) } }
        ForEach(Array(posts.enumerated()), id: \.offset) { _, p in
            Card {
                Text(p.obj("title").str).font(.headline)
                Text("\(p.obj("author").str) · \(p.obj("authorBadge").str) · \(p.obj("time").str)").font(.footnote).foregroundColor(.muted)
                Text(p.obj("petTag").str).font(.footnote).foregroundColor(.mint)
                Text(p.obj("content").str)
                MintButton(title: p.obj("liked").bool ? "取消赞 \(p.obj("likes").str)" : "赞 \(p.obj("likes").str)") {
                    Task { await store.patch("/api/v1/social/like", ["postId": p.obj("id").str]) }
                }
            }
        }
    }
}

struct FoodView: View {
    @EnvironmentObject var store: PawStore
    @State private var draft = ""
    var body: some View {
        let rows = store.state.arr("foodRecipes").filter { row in
            let levelOk = store.foodLevel == "全部" || row.obj("safetyLevel").str == store.foodLevel
            let text = row.obj("name").str + row.obj("summary").str + row.obj("category").str
            return levelOk && (store.foodQuery.isEmpty || text.contains(store.foodQuery))
        }
        PageHead(title: "能不能吃")
        ChipRow(labels: ["全部", "能吃", "慎吃", "不能吃"], selected: store.foodLevel) { store.foodLevel = $0 }
        Card {
            TextField("搜食材", text: $draft)
            MintButton(title: "查找") { store.foodQuery = draft.trimmingCharacters(in: .whitespacesAndNewlines) }
        }
        .onAppear { draft = store.foodQuery }
        if rows.isEmpty { Card { Text("没有这种食材").foregroundColor(.muted) } }
        ForEach(Array(rows.enumerated()), id: \.offset) { _, f in
            let color: Color = f.obj("safetyLevel").str == "能吃" ? .mint : (f.obj("safetyLevel").str == "不能吃" ? .danger : .warn)
            Card {
                Text("\(f.obj("safetyLevel").str)  \(f.obj("name").str)").font(.headline).foregroundColor(color)
                Text("\(f.obj("category").str) · \(f.obj("suitableFor").str)").font(.footnote).foregroundColor(.muted)
                Text(f.obj("summary").str)
                Text(f.obj("detail").str).font(.footnote).foregroundColor(.muted)
            }
        }
    }
}

struct FriendsView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        PageHead(title: "宠友")
        let rows = store.state.arr("petFriends")
        if rows.isEmpty { Card { Text("附近还没有宠友").foregroundColor(.muted) } }
        ForEach(Array(rows.enumerated()), id: \.offset) { _, f in
            Card {
                Text("\(f.obj("ownerName").str) · \(f.obj("petName").str)").font(.body.bold())
                Text(f.obj("distance").str).font(.footnote).foregroundColor(.muted)
                Text(f.obj("intro").str).font(.footnote)
                MintButton(title: f.obj("followed").bool ? "取消关注" : "关注") {
                    Task { await store.patch("/api/v1/social/friend", ["friendId": f.obj("id").str]) }
                }
            }
        }
    }
}

struct MallView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let goods = store.state.arr("mallProducts").filter { store.mallCat == "全部" || $0.obj("category").str == store.mallCat }
        PageHead(title: "商城")
        ChipRow(labels: ["全部", "猫", "狗", "异宠"], selected: store.mallCat) { store.mallCat = $0 }
        Card {
            Text("购物车 \(store.state.arr("cartItems").count) 件")
            MintButton(title: "打开购物车") { store.open("cart") }
        }
        if goods.isEmpty { Card { Text("这个分类没有商品").foregroundColor(.muted) } }
        ForEach(Array(goods.enumerated()), id: \.offset) { _, g in
            Card {
                Text(g.obj("badge").str).font(.footnote).foregroundColor(.coral)
                Text(g.obj("title").str).font(.body.bold())
                Text(g.obj("subtitle").str).font(.footnote).foregroundColor(.muted)
                Text("¥\(g.obj("price").str)  \(g.obj("salesText").str)").foregroundColor(.coral)
                Text(g.obj("shopName").str).font(.footnote).foregroundColor(.muted)
                Text(g.arr("specs").map { $0.str }.joined(separator: " / ")).font(.footnote).foregroundColor(.muted)
                MintButton(title: "加入购物车") {
                    let options = g.arr("specs").map { $0.str }
                    if options.count <= 1 {
                        Task { await store.post("/api/v1/mall/cart/add", ["productId": g.obj("id").str, "spec": options.first ?? ""]) }
                    } else {
                        store.pick("规格", options) { spec in
                            Task { await store.post("/api/v1/mall/cart/add", ["productId": g.obj("id").str, "spec": spec]) }
                        }
                    }
                }
            }
        }
    }
}

struct CartView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let items = store.state.arr("cartItems")
        let checked = items.filter { $0.obj("checked").bool }
        let raw = checked.reduce(0.0) { $0 + $1.obj("price").double * Double($1.obj("qty").int) }
        let pay = (raw * 0.95 * 100).rounded() / 100
        PageHead(title: "购物车")
        if items.isEmpty {
            Card { Text("购物车是空的").foregroundColor(.muted) }
        } else {
            Card {
                Text(String(format: "已勾选 %d 件，预估实付 ¥%.2f（金卡 95 折，以服务器结算为准）", checked.count, pay)).font(.footnote)
                QuietButton(title: checked.count == items.count ? "取消全选" : "全选") {
                    Task { await store.patch("/api/v1/mall/cart/update", ["action": "TOGGLE_ALL", "checkedAll": checked.count != items.count]) }
                }
                MintButton(title: "结算") { Task { await store.post("/api/v1/orders/checkout", [:]) } }
            }
            ForEach(Array(items.enumerated()), id: \.offset) { _, c in
                Card {
                    Text(c.obj("title").str).font(.body.bold())
                    Text("\(c.obj("spec").str) · ¥\(c.obj("price").str) × \(c.obj("qty").str)").foregroundColor(.coral)
                    Text(c.obj("shopName").str).font(.footnote).foregroundColor(.muted)
                    MintButton(title: c.obj("checked").bool ? "取消勾选" : "勾选") { act(c, "TOGGLE") }
                    QuietButton(title: "加一件") { act(c, "INC") }
                    QuietButton(title: "减一件") { act(c, "DEC") }
                    QuietButton(title: "移出") { act(c, "REMOVE") }
                }
            }
        }
    }
    func act(_ item: Box, _ action: String) {
        Task { await store.patch("/api/v1/mall/cart/update", ["cartId": item.obj("id").str, "action": action]) }
    }
}
