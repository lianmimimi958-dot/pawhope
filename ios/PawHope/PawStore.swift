import CoreLocation
import Foundation

struct FormRequest: Identifiable {
    let id = UUID()
    let title: String
    let labels: [String]
    let submit: ([String]) -> Void
}

struct ChoiceRequest: Identifiable {
    let id = UUID()
    let title: String
    let options: [String]
    let submit: (String) -> Void
}

final class WalkLocator: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private(set) var points: [[Double]] = []
    var onPoint: ((Int) -> Void)?
    var onDenied: (() -> Void)?

    func start() {
        points = []
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 3
        manager.requestWhenInUseAuthorization()
        if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted {
            onDenied?()
            return
        }
        manager.startUpdatingLocation()
    }

    func stop() -> [[Double]] {
        manager.stopUpdatingLocation()
        return points
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            manager.startUpdatingLocation()
        } else if status == .denied || status == .restricted {
            onDenied?()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for loc in locations {
            let acc = loc.horizontalAccuracy
            if acc < 0 || acc > 100 { continue }
            points.append([
                loc.coordinate.latitude,
                loc.coordinate.longitude,
                loc.timestamp.timeIntervalSince1970 * 1000,
                acc
            ])
        }
        let count = points.count
        DispatchQueue.main.async { self.onPoint?(count) }
    }
}

@MainActor
final class PawStore: ObservableObject {
    @Published var state = Box([String: Any]())
    @Published var status = "正在连接 pawhope.cn"
    @Published var screen = "home"
    @Published var busy = false
    @Published var watching = false
    @Published var trackCount = 0
    @Published var foodLevel = "全部"
    @Published var foodQuery = ""
    @Published var mallCat = "全部"
    @Published var docKey = "about"
    @Published var form: FormRequest?
    @Published var choice: ChoiceRequest?
    private var stack: [String] = []
    private var secret = ""
    private var token = ""
    let locator = WalkLocator()

    var ready: Bool { state.has("pets") }
    var isRoot: Bool { ["home", "device", "social", "mall", "mine"].contains(screen) }

    func bootstrap() async {
        applyPreviewOrigin()
        status = "正在读取你的数据"
        do {
            var s = ""
            var t = ""
            state = try await PawApi.bootstrap(secret: &s, token: &t)
            secret = s
            token = t
            status = "已连接 \(PawApi.origin)"
            applyScreenshotScreen()
        } catch {
            status = error.localizedDescription
        }
    }

    func post(_ path: String, _ payload: [String: Any]) async {
        await send("POST", path, payload)
    }

    func patch(_ path: String, _ payload: [String: Any]) async {
        await send("PATCH", path, payload)
    }

    private func send(_ method: String, _ path: String, _ payload: [String: Any]) async {
        if busy { return }
        busy = true
        status = "处理中"
        do {
            let res = try await PawApi.send(method: method, path: path, payload: payload, secret: secret, token: token)
            if res.code == 0 { apply(res.body) }
            status = res.message
        } catch {
            status = error.localizedDescription
        }
        busy = false
    }

    func ask(_ title: String, _ labels: [String], _ go: @escaping ([String]) -> Void) {
        form = FormRequest(title: title, labels: labels, submit: go)
    }

    func pick(_ title: String, _ options: [String], _ go: @escaping (String) -> Void) {
        choice = ChoiceRequest(title: title, options: options, submit: go)
    }

    func open(_ next: String) {
        stack.append(screen)
        screen = next
    }

    func back() {
        if let last = stack.popLast() {
            screen = last
            return
        }
        let root = ["home", "device", "social", "mall", "mine"][tabIndex]
        if screen != root { screen = root }
    }

    private func applyPreviewOrigin() {
        let args = ProcessInfo.processInfo.arguments
        guard let flag = args.firstIndex(of: "--origin"), flag + 1 < args.count else { return }
        let value = args[flag + 1]
        if value.hasPrefix("http://") || value.hasPrefix("https://") {
            PawApi.origin = value
        }
    }

    private func applyScreenshotScreen() {
        let args = ProcessInfo.processInfo.arguments
        guard let flag = args.firstIndex(of: "--screen"), flag + 1 < args.count else { return }
        let name = args[flag + 1]
        if ["home", "device", "social", "mall", "mine"].contains(name) {
            screen = name
        }
    }

    func selectTab(_ index: Int) {
        stack.removeAll()
        screen = ["home", "device", "social", "mall", "mine"][index]
    }

    var tabIndex: Int {
        switch screen {
        case "device": return 1
        case "social", "food", "friends": return 2
        case "mall", "cart": return 3
        case "mine", "orders", "address", "profile", "docs", "share": return 4
        default: return 0
        }
    }

    func pet() -> Box? {
        let id = state.obj("currentPetId").str
        let pets = state.arr("pets")
        return pets.first { $0.obj("id").str == id } ?? pets.first
    }

    func petId() -> String { pet()?.obj("id").str ?? "" }

    func matches(_ row: Box) -> Bool {
        let id = petId()
        let pid = row.obj("petId").str
        return pid.isEmpty || pid == id
    }

    func nowText() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f.string(from: Date())
    }

    func startWalk() {
        locator.onPoint = { [weak self] n in
            Task { @MainActor in
                self?.trackCount = n
                self?.status = "正在记录轨迹，已收到 \(n) 个点"
            }
        }
        locator.onDenied = { [weak self] in
            Task { @MainActor in
                self?.watching = false
                self?.status = "定位没有打开，这次不能记录"
            }
        }
        trackCount = 0
        watching = true
        locator.start()
        status = "遛弯已开始，请开着这个页面走"
    }

    func stopWalk() async {
        let points = locator.stop()
        watching = false
        trackCount = points.count
        if points.count < 2 {
            status = "定位点不够，这次没有保存"
            return
        }
        await post("/api/v1/devices/command", [
            "command": "LOG_WALK",
            "track": points,
            "routeNote": "手机 App 记录"
        ])
    }

    private func apply(_ body: Box) {
        let data = body.obj("data")
        var dict = state.dict
        for key in ["pets", "healthRecords", "ledgerEntries", "reminders", "devicesState", "socialPosts", "petFriends", "cartItems", "orders", "albumState", "currentUser", "addresses", "sharedMembers"] {
            if data.has(key), let v = data.dict[key] { dict[key] = v }
        }
        if data.has("currentPetId") { dict["currentPetId"] = data.obj("currentPetId").str }
        if data.has("bookings") {
            var svc = (dict["servicesData"] as? [String: Any]) ?? [:]
            svc["bookings"] = data.dict["bookings"] ?? []
            dict["servicesData"] = svc
        }
        if data.has("history"), data.has("petId") {
            var chats = (dict["aiChatHistories"] as? [String: Any]) ?? [:]
            chats[data.obj("petId").str] = data.dict["history"] ?? []
            dict["aiChatHistories"] = chats
        }
        state = Box(dict)
    }
}
