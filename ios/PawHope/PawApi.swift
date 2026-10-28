import CryptoKit
import Foundation

struct Box {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    func obj(_ key: String) -> Box {
        Box(dict[key] ?? NSNull())
    }

    func arr(_ key: String) -> [Box] {
        Box(dict[key] ?? NSNull()).list
    }

    func has(_ key: String) -> Bool {
        guard let v = dict[key] else { return false }
        return !(v is NSNull)
    }

    var dict: [String: Any] {
        if let d = value as? [String: Any] { return d }
        if let d = value as? NSDictionary {
            var out: [String: Any] = [:]
            for key in d.allKeys {
                if let key = key as? String { out[key] = d[key] }
            }
            return out
        }
        return [:]
    }

    var list: [Box] {
        if let raw = value as? [Any] { return raw.map { Box($0) } }
        if let raw = value as? NSArray {
            return (0..<raw.count).map { Box(raw[$0]) }
        }
        return []
    }

    var str: String {
        switch value {
        case is NSNull:
            return ""
        case let s as String:
            return s
        case let n as NSNumber:
            if CFGetTypeID(n) == CFBooleanGetTypeID() { return n.boolValue ? "true" : "false" }
            let d = n.doubleValue
            if d == floor(d) && abs(d) < 1e15 { return String(Int(d)) }
            return String(format: "%g", d)
        default:
            return ""
        }
    }

    var bool: Bool { (value as? NSNumber)?.boolValue ?? false }
    var int: Int { (value as? NSNumber)?.intValue ?? 0 }
    var double: Double { (value as? NSNumber)?.doubleValue ?? Double(str) ?? 0 }
    var int64: Int64 { (value as? NSNumber)?.int64Value ?? 0 }
}

struct ApiResult {
    let http: Int
    let code: Int
    let message: String
    let body: Box
}

enum PawApi {
    static let origin = "https://pawhope.cn"

    static func bootstrap(secret: inout String, token: inout String) async throws -> Box {
        let res = try await raw(method: "GET", path: "/api/v1/bootstrap", body: nil, secret: "", token: "")
        if res.code != 0 { throw NSError(domain: "pawhope", code: res.code, userInfo: [NSLocalizedDescriptionKey: res.message]) }
        let data = res.body.obj("data")
        secret = data.obj("signSecret").str
        token = data.obj("authToken").str
        return data.obj("state")
    }

    static func send(method: String, path: String, payload: [String: Any], secret: String, token: String) async throws -> ApiResult {
        let data = try JSONSerialization.data(withJSONObject: payload, options: [])
        let text = String(data: data, encoding: .utf8) ?? "{}"
        return try await raw(method: method, path: path, body: text, secret: secret, token: token)
    }

    private static func raw(method: String, path: String, body: String?, secret: String, token: String) async throws -> ApiResult {
        var req = URLRequest(url: URL(string: origin + path)!)
        req.httpMethod = method
        req.timeoutInterval = 20
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if !token.isEmpty { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            let ts = String(Int(Date().timeIntervalSince1970 * 1000))
            let nonce = UUID().uuidString.replacingOccurrences(of: "-", with: "")
            let sig = hmac(secret, [method, path, ts, nonce, sha256(body)].joined(separator: "\n"))
            req.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
            req.setValue("PawHope-iOS/1.0.0", forHTTPHeaderField: "X-App-Client")
            req.setValue(ts, forHTTPHeaderField: "X-Timestamp")
            req.setValue(nonce, forHTTPHeaderField: "X-Nonce")
            req.setValue(sig, forHTTPHeaderField: "X-Signature")
            req.httpBody = Data(body.utf8)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let http = (response as? HTTPURLResponse)?.statusCode ?? 0
        let obj = (try? JSONSerialization.jsonObject(with: data)) ?? ["message": String(data: data, encoding: .utf8) ?? "服务器没有返回内容"]
        let box = Box(obj)
        let code: Int
        if box.obj("code").value is NSNull {
            code = (200...299).contains(http) ? 0 : http
        } else {
            code = box.obj("code").int
        }
        let message = box.obj("message").str.isEmpty ? "请求失败" : box.obj("message").str
        return ApiResult(http: http, code: code, message: message, body: box)
    }

    private static func sha256(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func hmac(_ secret: String, _ msg: String) -> String {
        let key = SymmetricKey(data: Data(secret.utf8))
        let mac = HMAC<SHA256>.authenticationCode(for: Data(msg.utf8), using: key)
        return Data(mac).map { String(format: "%02x", $0) }.joined()
    }
}

func mbText(_ bytes: Int64) -> String {
    String(format: "%.1f MB", Double(bytes) / 1048576.0)
}
