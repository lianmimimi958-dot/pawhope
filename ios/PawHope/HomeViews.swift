import PhotosUI
import SwiftUI
import UIKit

struct HomeView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let pet = store.pet()
        PageHead(title: pet?.obj("name").str ?? "首页")
        ChipRow(labels: store.state.arr("pets").map { $0.obj("name").str }, selected: pet?.obj("name").str ?? "") { name in
            guard let id = store.state.arr("pets").first(where: { $0.obj("name").str == name })?.obj("id").str else { return }
            Task { await store.post("/api/v1/pets/select", ["petId": id]) }
        }
        Card {
            Text(pet?.obj("name").str ?? "还没有宠物").font(.title3.bold())
            Text("\(pet?.obj("breed").str ?? "")  \(pet?.obj("gender").str ?? "")").font(.footnote).foregroundColor(.muted)
            Text(pet?.obj("dailyStatus").str ?? "").foregroundColor(.ink)
            Text("体重 \(pet?.obj("weightKg").str ?? "-") kg · 体温 \(pet?.obj("bodyTempC").str ?? "-") °C")
            Text("下次疫苗 \(pet?.obj("nextVaccineDate").str ?? "") · 驱虫 \(pet?.obj("nextDewormDate").str ?? "")").font(.footnote).foregroundColor(.muted)
            QuietButton(title: "添加一只宠物") { addPet() }
        }
        Card {
            Text("档案").font(.headline)
            QuietButton(title: "健康档案") { store.open("health") }
            QuietButton(title: "记账") { store.open("ledger") }
            QuietButton(title: "待办") { store.open("reminders") }
            QuietButton(title: "和它说话") { store.open("chat") }
            QuietButton(title: "医院与服务") { store.open("services") }
            QuietButton(title: "相册") { store.open("album") }
        }
        let undone = store.state.arr("reminders").filter { store.matches($0) && !$0.obj("done").bool }
        Text("还没做的事").font(.headline).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.top, 12)
        if undone.isEmpty {
            Card { Text("没有未完成的待办").foregroundColor(.muted) }
        }
        ForEach(Array(undone.prefix(4).enumerated()), id: \.offset) { _, r in
            Card {
                Text(r.obj("title").str).font(.body.bold())
                Text("\(r.obj("time").str) · \(r.obj("category").str)").font(.footnote).foregroundColor(.muted)
                MintButton(title: "标成完成") {
                    Task { await store.patch("/api/v1/reminders/toggle", ["id": r.obj("id").str]) }
                }
            }
        }
    }

    func addPet() {
        store.pick("物种", ["猫", "狗", "异宠"]) { species in
            store.ask("新宠物", ["名字", "品种", "性别", "体重公斤"]) { v in
                guard !v[0].isEmpty, v.count > 1, !v[1].isEmpty else {
                    store.status = "名字和品种要填"
                    return
                }
                Task {
                    await store.post("/api/v1/pets", [
                        "name": v[0], "species": species, "breed": v[1],
                        "gender": v.count > 2 ? v[2] : "", "weightKg": v.count > 3 ? v[3] : ""
                    ])
                }
            }
        }
    }
}

struct HealthView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let pet = store.pet()
        let rows = store.state.arr("healthRecords").filter { store.matches($0) }
        PageHead(title: "健康档案")
        Card {
            Text(pet?.obj("name").str ?? "")
            Text(pet?.obj("allergy").str ?? "").font(.footnote)
            MintButton(title: "记一笔") { add() }
        }
        if rows.isEmpty { Card { Text("还没有健康记录").foregroundColor(.muted) } }
        ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
            Card {
                Text("\(r.obj("category").str) · \(r.obj("title").str)").font(.body.bold())
                Text("\(r.obj("date").str)  \(r.obj("valueText").str)").font(.footnote).foregroundColor(.muted)
                Text("\(r.obj("hospital").str)  \(r.obj("doctor").str)").font(.footnote).foregroundColor(.muted)
                Text(r.obj("notes").str).font(.footnote).foregroundColor(.muted)
            }
        }
    }
    func add() {
        store.pick("类型", ["疫苗", "驱虫", "体重", "体温", "看病"]) { cat in
            store.ask(cat, ["项目名称", "结果或数值", "医院或地点", "下次日期，可空", "备注"]) { v in
                guard !v[0].isEmpty else { store.status = "请填写项目名称"; return }
                Task {
                    await store.post("/api/v1/health/records", [
                        "petId": store.petId(), "category": cat, "title": v[0],
                        "valueText": v.count > 1 ? v[1] : "",
                        "hospital": v.count > 2 ? v[2] : "",
                        "nextDate": v.count > 3 ? v[3] : "",
                        "notes": v.count > 4 ? v[4] : ""
                    ])
                }
            }
        }
    }
}

struct LedgerView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let rows = store.state.arr("ledgerEntries").filter { store.matches($0) }
        let spend = rows.filter { $0.obj("type").str != "收入" }.reduce(0.0) { $0 + $1.obj("amount").double }
        let income = rows.filter { $0.obj("type").str == "收入" }.reduce(0.0) { $0 + $1.obj("amount").double }
        PageHead(title: "记账")
        Card {
            Text(String(format: "支出 ¥%.2f · 收入 ¥%.2f", spend, income))
            MintButton(title: "记一笔") { add() }
        }
        if rows.isEmpty { Card { Text("还没有流水").foregroundColor(.muted) } }
        ForEach(Array(rows.enumerated()), id: \.offset) { _, e in
            let sign = e.obj("type").str == "收入" ? "+" : "-"
            Card {
                Text("\(e.obj("title").str)  \(sign)¥\(e.obj("amount").str)")
                Text("\(e.obj("date").str) · \(e.obj("category").str) · \(e.obj("note").str)").font(.footnote).foregroundColor(.muted)
            }
        }
    }
    func add() {
        store.pick("收支", ["支出", "收入"]) { type in
            store.ask(type, ["摘要", "金额", "分类", "备注"]) { v in
                Task {
                    await store.post("/api/v1/ledger/entries", [
                        "petId": store.petId(), "type": type,
                        "title": v.first ?? "",
                        "amount": v.count > 1 ? v[1] : "",
                        "category": (v.count > 2 && !v[2].isEmpty) ? v[2] : "饮食口粮",
                        "note": v.count > 3 ? v[3] : ""
                    ])
                }
            }
        }
    }
}

struct RemindersView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let rows = store.state.arr("reminders").filter { store.matches($0) }
        PageHead(title: "待办")
        Card {
            MintButton(title: "加一条提醒") {
                store.ask("新提醒", ["要做的事", "时间，例如今日 20:00", "分类"]) { v in
                    Task {
                        await store.post("/api/v1/reminders", [
                            "petId": store.petId(),
                            "title": v.first ?? "",
                            "time": v.count > 1 ? v[1] : "",
                            "category": (v.count > 2 && !v[2].isEmpty) ? v[2] : "日常护理"
                        ])
                    }
                }
            }
        }
        if rows.isEmpty { Card { Text("没有提醒").foregroundColor(.muted) } }
        ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
            Card {
                Text(r.obj("title").str).foregroundColor(r.obj("done").bool ? .muted : .ink)
                Text("\(r.obj("time").str) · \(r.obj("cycle").str) · \(r.obj("done").bool ? "已完成" : "未完成")").font(.footnote).foregroundColor(.muted)
                MintButton(title: r.obj("done").bool ? "改回未完成" : "标成完成") {
                    Task { await store.patch("/api/v1/reminders/toggle", ["id": r.obj("id").str]) }
                }
            }
        }
    }
}

struct ChatView: View {
    @EnvironmentObject var store: PawStore
    @State private var text = ""
    var body: some View {
        let pet = store.pet()
        let hist = store.state.obj("aiChatHistories").arr(store.petId())
        PageHead(title: pet?.obj("name").str ?? "对话")
        if hist.isEmpty { Card { Text("还没有对话").foregroundColor(.muted) } }
        ForEach(Array(hist.suffix(30).enumerated()), id: \.offset) { _, m in
            let mine = m.obj("sender").str == "user"
            Card {
                Text(mine ? "我" : (pet?.obj("name").str ?? "它")).font(.footnote).foregroundColor(.muted)
                Text(m.obj("text").str)
                Text(m.obj("time").str).font(.caption).foregroundColor(.muted)
            }
        }
        Card {
            TextField("跟\(pet?.obj("name").str ?? "它")说一句", text: $text)
            MintButton(title: "发送") {
                let msg = text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !msg.isEmpty else { store.status = "先写一句话"; return }
                text = ""
                Task {
                    await store.post("/api/v1/ai/chat", [
                        "petId": store.petId(),
                        "personality": pet?.obj("personality").str ?? "",
                        "message": msg
                    ])
                }
            }
        }
    }
}

struct ServicesView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let svc = store.state.obj("servicesData")
        PageHead(title: "医院与服务")
        section("医院")
        ForEach(Array(svc.arr("hospitals").enumerated()), id: \.offset) { _, h in
            Card {
                Text(h.obj("name").str).font(.body.bold())
                Text("\(h.obj("distance").str) · \(h.obj("rating").str) 分 · \(h.obj("status").str)").font(.footnote)
                Text(h.arr("tags").map { $0.str }.joined(separator: " · ")).font(.footnote).foregroundColor(.muted)
                Text(h.obj("address").str).font(.footnote).foregroundColor(.muted)
                QuietButton(title: "打电话") { call(h.obj("phone").str) }
            }
        }
        section("洗护和寄养")
        ForEach(Array(svc.arr("groomingBoarding").enumerated()), id: \.offset) { _, s in
            Card {
                Text(s.obj("title").str).font(.body.bold())
                Text("\(s.obj("shopName").str) · ¥\(s.obj("price").str) · \(s.obj("distance").str)").foregroundColor(.coral)
                Text(s.obj("highlights").str).font(.footnote).foregroundColor(.muted)
                MintButton(title: "提交预约") { book(s.obj("type").str, s.obj("title").str) }
            }
        }
        section("托运")
        ForEach(Array(svc.arr("transportPlans").enumerated()), id: \.offset) { _, s in
            Card {
                Text(s.obj("mode").str).font(.body.bold())
                Text("\(s.obj("route").str) · ¥\(s.obj("priceFrom").str) 起")
                Text(s.obj("includes").str).font(.footnote).foregroundColor(.muted)
                MintButton(title: "提交预约") { book("宠物托运", s.obj("mode").str) }
            }
        }
        section("问诊")
        ForEach(Array(svc.arr("onlineDoctors").enumerated()), id: \.offset) { _, d in
            Card {
                Text(d.obj("name").str).font(.body.bold())
                Text(d.obj("title").str).font(.footnote).foregroundColor(.muted)
                Text(d.obj("specialty").str).font(.footnote)
                Text("\(d.obj("replyTime").str) · \(d.obj("fee").str)").font(.footnote).foregroundColor(.muted)
                MintButton(title: "提交问诊") { book("线上问诊", d.obj("name").str) }
            }
        }
        section("保险")
        ForEach(Array(svc.arr("insurancePlans").enumerated()), id: \.offset) { _, p in
            Card {
                Text(p.obj("name").str).font(.body.bold())
                Text("\(p.obj("company").str) · ¥\(p.obj("monthlyPrice").str)/月 · 保额 \(p.obj("annualCoverage").str)").font(.footnote)
                Text(p.obj("reimburseRate").str).font(.footnote)
                Text(p.obj("policyStatus").str).font(.footnote).foregroundColor(.muted)
                MintButton(title: "提交投保申请") { book("保险", p.obj("name").str) }
            }
        }
        section("已提交的申请")
        if svc.arr("bookings").isEmpty { Card { Text("还没有申请").foregroundColor(.muted) } }
        ForEach(Array(svc.arr("bookings").enumerated()), id: \.offset) { _, b in
            Card {
                Text(b.obj("title").str)
                Text("\(b.obj("date").str) · \(b.obj("petName").str) · \(b.obj("status").str)").font(.footnote).foregroundColor(.muted)
            }
        }
    }
    func section(_ title: String) -> some View {
        Text(title).font(.headline).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.top, 12)
    }
    func book(_ type: String, _ title: String) {
        Task {
            await store.post("/api/v1/services/book", [
                "serviceType": type, "title": title,
                "petName": store.pet()?.obj("name").str ?? "",
                "date": store.nowText()
            ])
        }
    }
    func call(_ phone: String) {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        if let url = URL(string: "tel:\(digits)") { UIApplication.shared.open(url) }
    }
}

struct AlbumView: View {
    @EnvironmentObject var store: PawStore
    @State private var item: PhotosPickerItem?
    @State private var title = ""
    @State private var tag = ""
    var body: some View {
        let album = store.state.obj("albumState")
        let photos = album.arr("photos")
        let used = photos.reduce(Int64(0)) { $0 + $1.obj("sizeBytes").int64 }
        let quota = album.obj("freeQuotaBytes").int64 + album.obj("extraQuotaBytes").int64
        let mine = photos.filter { store.matches($0) }
        let show = mine.isEmpty ? photos : mine
        PageHead(title: "相册")
        Card {
            Text(album.obj("planName").str)
            Text("已用 \(mbText(used)) / \(mbText(quota))").font(.footnote).foregroundColor(.muted)
            TextField("标题", text: $title)
            TextField("标签，例如日常", text: $tag)
            PhotosPicker(selection: $item, matching: .images) {
                Text("从相册选一张").foregroundColor(.white).frame(maxWidth: .infinity).padding(.vertical, 10)
            }
            .background(Color.mint)
            .cornerRadius(12)
            QuietButton(title: "扩容 10GB / 50GB") {
                store.status = "支付还没开通，相册空间不会增加"
            }
        }
        .task(id: item) { await upload() }
        if show.isEmpty { Card { Text("相册是空的").foregroundColor(.muted) } }
        ForEach(Array(show.enumerated()), id: \.offset) { _, p in
            Card {
                Text(p.obj("title").str).font(.body.bold())
                Text("\(p.obj("date").str) · \(p.obj("tag").str) · \(mbText(p.obj("sizeBytes").int64))").font(.footnote).foregroundColor(.muted)
            }
        }
    }
    func upload() async {
        guard let item else { return }
        guard let data = try? await item.loadTransferable(type: Data.self), !data.isEmpty else {
            store.status = "没有读到这张照片"
            return
        }
        let mb = max(1, min(200, (data.count + 1024 * 1024 - 1) / (1024 * 1024)))
        await store.post("/api/v1/album/upload", [
            "petId": store.petId(),
            "title": title.isEmpty ? "手机相册" : title,
            "tag": tag.isEmpty ? "日常记录" : tag,
            "sizeMB": mb
        ])
    }
}
