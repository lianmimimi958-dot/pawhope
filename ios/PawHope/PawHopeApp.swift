import SwiftUI

@main
struct PawHopeApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

struct RootView: View {
    @StateObject private var store = PawStore()
    var body: some View {
        VStack(spacing: 0) {
            Text(store.status)
                .font(.footnote)
                .foregroundColor(.mint)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, 8)
            ScrollView {
                page.padding(.bottom, 20)
            }
            HStack {
                ForEach(Array(["首页", "设备", "萌圈", "商城", "我的"].enumerated()), id: \.offset) { i, name in
                    Button(name) { store.selectTab(i) }
                        .font(.system(size: 13, weight: store.tabIndex == i ? .bold : .regular))
                        .foregroundColor(store.tabIndex == i ? .mint : .muted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
            }
            .background(Color.white)
        }
        .background(Color.paper)
        .environmentObject(store)
        .task { await store.bootstrap() }
        .sheet(item: $store.form) { form in
            FormSheet(form: form).environmentObject(store)
        }
        .sheet(item: $store.choice) { choice in
            ChoiceSheet(choice: choice).environmentObject(store)
        }
    }

    @ViewBuilder var page: some View {
        if !store.ready {
            Card { Text(store.status).foregroundColor(.ink) }
        } else {
            switch store.screen {
            case "home": HomeView()
            case "health": HealthView()
            case "ledger": LedgerView()
            case "reminders": RemindersView()
            case "chat": ChatView()
            case "services": ServicesView()
            case "album": AlbumView()
            case "device": DeviceView()
            case "social": SocialView()
            case "food": FoodView()
            case "friends": FriendsView()
            case "mall": MallView()
            case "cart": CartView()
            case "mine": MineView()
            case "orders": OrdersView()
            case "address": AddressView()
            case "profile": ProfileView()
            case "share": ShareView()
            case "docs": DocsView()
            default: HomeView()
            }
        }
    }
}
