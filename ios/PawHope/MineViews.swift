import SwiftUI
import UIKit

struct MineView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let user = store.state.obj("currentUser")
        let settings = user.obj("settings")
        PageHead(title: user.obj("nickname").str.isEmpty ? "我的" : user.obj("nickname").str)
        Card {
            Text(user.obj("nickname").str).font(.title3.bold())
            Text(user.obj("signature").str).font(.footnote)
            Text("\(user.obj("phoneMasked").str) · \(user.obj("city").str)").font(.footnote).foregroundColor(.muted)
            Text(user.obj("vipLevel").str).foregroundColor(.mint)
            Text("积分 \(user.obj("vipPoints").str) / \(user.obj("vipNextPoints").str) · 到期 \(user.obj("vipExpireDate").str)").font(.footnote).foregroundColor(.muted)
            QuietButton(title: "改资料") { store.open("profile") }
        }
        ForEach(Array(user.arr("vipBenefits").enumerated()), id: \.offset) { _, b in
            Card {
                Text(b.obj("title").str)
                Text(b.obj("desc").str).font(.footnote).foregroundColor(.muted)
            }
        }
        Card {
            Text("常用").font(.headline)
            QuietButton(title: "订单") { store.open("orders") }
            QuietButton(title: "收货地址") { store.open("address") }
            QuietButton(title: "共享宠物") { store.open("share") }
            QuietButton(title: "关于、协议和客服") { store.docKey = "about"; store.open("docs") }
        }
        Card {
            Text("提醒开关").font(.headline)
            Toggle("待办推送", isOn: binding(settings, "pushReminder"))
            Toggle("喂食提醒", isOn: binding(settings, "feedingAlert"))
            Toggle("围栏提醒", isOn: binding(settings, "fenceAlert"))
        }
    }
    func binding(_ settings: Box, _ key: String) -> Binding<Bool> {
        Binding(
            get: { settings.obj(key).bool },
            set: { checked in
                guard checked != settings.obj(key).bool else { return }
                Task { await store.patch("/api/v1/user/profile", ["settings": [key: checked]]) }
            }
        )
    }
}

struct OrdersView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        PageHead(title: "订单")
        let orders = store.state.arr("orders")
        if orders.isEmpty { Card { Text("还没有订单").foregroundColor(.muted) } }
        ForEach(Array(orders.enumerated()), id: \.offset) { _, o in
            Card {
                Text("\(o.obj("status").str)  \(o.obj("id").str)").foregroundColor(.mint)
                Text(o.obj("shopName").str)
                Text("¥\(o.obj("totalAmount").str) · \(o.obj("createdAt").str)").foregroundColor(.coral)
                Text(o.obj("note").str).font(.footnote).foregroundColor(.muted)
                ForEach(Array(o.arr("items").enumerated()), id: \.offset) { _, item in
                    Text("\(item.obj("title").str) \(item.obj("spec").str) × \(item.obj("qty").str)  ¥\(item.obj("price").str)")
                        .font(.footnote).foregroundColor(.muted)
                }
                if o.obj("status").str == "待付款" {
                    Text("支付通道还没接上，这笔订单保持待付款。").font(.footnote).foregroundColor(.warn)
                } else if o.obj("status").str == "待使用" {
                    MintButton(title: "确认完成") { order(o, "已完成") }
                    QuietButton(title: "申请退款") { order(o, "退款/售后") }
                } else if o.obj("status").str == "已完成" {
                    QuietButton(title: "申请售后") { order(o, "退款/售后") }
                }
            }
        }
    }
    func order(_ o: Box, _ next: String) {
        Task { await store.patch("/api/v1/orders/status", ["orderId": o.obj("id").str, "nextStatus": next]) }
    }
}

struct AddressView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        PageHead(title: "收货地址")
        Card {
            MintButton(title: "新增地址") {
                store.ask("新地址", ["收货人", "电话", "地区", "详细地址", "标签，例如家"]) { v in
                    Task {
                        await store.post("/api/v1/user/addresses", [
                            "name": v.first ?? "",
                            "phone": v.count > 1 ? v[1] : "",
                            "region": v.count > 2 ? v[2] : "",
                            "detail": v.count > 3 ? v[3] : "",
                            "tag": (v.count > 4 && !v[4].isEmpty) ? v[4] : "家",
                            "isDefault": true
                        ])
                    }
                }
            }
        }
        ForEach(Array(store.state.arr("addresses").enumerated()), id: \.offset) { _, a in
            Card {
                Text("\(a.obj("name").str)  \(a.obj("phone").str)  \(a.obj("tag").str)")
                Text("\(a.obj("region").str) \(a.obj("detail").str)").font(.footnote)
                if a.obj("isDefault").bool { Text("默认地址").font(.footnote).foregroundColor(.mint) }
            }
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let user = store.state.obj("currentUser")
        PageHead(title: "资料")
        Card {
            MintButton(title: "保存新资料") {
                store.ask("资料", ["昵称", "签名", "城市"]) { v in
                    Task {
                        await store.patch("/api/v1/user/profile", [
                            "nickname": (v.first ?? "").isEmpty ? user.obj("nickname").str : v[0],
                            "signature": (v.count > 1 && !v[1].isEmpty) ? v[1] : user.obj("signature").str,
                            "city": (v.count > 2 && !v[2].isEmpty) ? v[2] : user.obj("city").str
                        ])
                    }
                }
            }
        }
        Card {
            Text(user.obj("nickname").str).font(.title3.bold())
            Text(user.obj("signature").str)
            Text(user.obj("city").str).foregroundColor(.muted)
        }
    }
}

struct ShareView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        PageHead(title: "共享宠物")
        Card {
            MintButton(title: "加上一位亲友") {
                store.ask("共享", ["对方昵称", "关系，例如家人"]) { v in
                    Task { await store.post("/api/v1/user/share-pet", ["name": v.first ?? "", "role": v.count > 1 ? v[1] : ""]) }
                }
            }
        }
        ForEach(Array(store.state.arr("sharedMembers").enumerated()), id: \.offset) { _, m in
            Card {
                Text("\(m.obj("name").str) · \(m.obj("role").str)").font(.body.bold())
                Text(m.arr("sharedPets").map { $0.str }.joined(separator: "、")).font(.footnote)
                Text(m.obj("permissions").str).font(.footnote).foregroundColor(.muted)
                Text(m.obj("joinedAt").str).font(.footnote).foregroundColor(.muted)
            }
        }
    }
}

struct DocsView: View {
    @EnvironmentObject var store: PawStore
    var body: some View {
        let docs = store.state.obj("complianceDocs")
        PageHead(title: "说明")
        ChipRow(labels: ["关于", "协议", "客服", "公告"], selected: label(store.docKey)) { name in
            store.docKey = name == "协议" ? "agreement" : name == "客服" ? "service" : name == "公告" ? "news" : "about"
        }
        if store.docKey == "agreement" {
            let d = docs.obj("userAgreement")
            Card {
                Text(d.obj("title").str).font(.headline)
                Text(d.obj("version").str).font(.footnote).foregroundColor(.muted)
                Text(d.obj("content").str)
            }
        } else if store.docKey == "service" {
            let d = docs.obj("customerService")
            Card {
                Text(d.obj("title").str).font(.headline)
                Text(d.obj("hotline").str)
                Text("微信 \(d.obj("wechat").str)").font(.footnote)
                QuietButton(title: "拨打热线") {
                    let digits = d.obj("hotline").str.split(separator: " ").first.map(String.init) ?? ""
                    let phone = digits.replacingOccurrences(of: "-", with: "")
                    if let url = URL(string: "tel:\(phone)") { UIApplication.shared.open(url) }
                }
                ForEach(Array(d.arr("faq").enumerated()), id: \.offset) { _, q in
                    Text(q.str).font(.footnote)
                }
            }
        } else if store.docKey == "news" {
            ForEach(Array(docs.arr("announcements").enumerated()), id: \.offset) { _, a in
                Card {
                    Text(a.obj("date").str).font(.footnote).foregroundColor(.muted)
                    Text(a.obj("title").str).font(.body.bold())
                    Text(a.obj("summary").str).font(.footnote)
                }
            }
        } else {
            let d = docs.obj("aboutUs")
            Card {
                Text(d.obj("title").str).font(.headline)
                Text(d.obj("version").str).font(.footnote).foregroundColor(.muted)
                Text(d.obj("content").str)
            }
        }
    }
    func label(_ key: String) -> String {
        key == "agreement" ? "协议" : key == "service" ? "客服" : key == "news" ? "公告" : "关于"
    }
}
