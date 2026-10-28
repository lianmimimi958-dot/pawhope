import SwiftUI

extension Color {
    static let mint = Color(red: 0.247, green: 0.710, blue: 0.616)
    static let ink = Color(red: 0.141, green: 0.192, blue: 0.180)
    static let muted = Color(red: 0.541, green: 0.569, blue: 0.557)
    static let coral = Color(red: 0.937, green: 0.518, blue: 0.400)
    static let paper = Color(red: 0.961, green: 0.969, blue: 0.965)
    static let warn = Color(red: 0.722, green: 0.416, blue: 0.071)
    static let danger = Color(red: 0.769, green: 0.282, blue: 0.227)
}

struct PageHead: View {
    let title: String
    @EnvironmentObject var store: PawStore
    var body: some View {
        HStack {
            if !store.isRoot {
                Button("返回") { store.back() }.foregroundColor(.mint)
            }
            Text(title).font(.title2.bold()).foregroundColor(.ink)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

struct Card<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .cornerRadius(16)
        .padding(.horizontal, 12)
        .padding(.top, 8)
    }
}

struct MintButton: View {
    let title: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).foregroundColor(.white).frame(maxWidth: .infinity).padding(.vertical, 10)
        }
        .background(Color.mint)
        .cornerRadius(12)
    }
}

struct QuietButton: View {
    let title: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).foregroundColor(.mint).frame(maxWidth: .infinity).padding(.vertical, 10)
        }
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.mint, lineWidth: 1))
    }
}

struct ChipRow: View {
    let labels: [String]
    let selected: String
    let onPick: (String) -> Void
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(labels, id: \.self) { name in
                    Button(name) { onPick(name) }
                        .font(.subheadline)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(name == selected ? Color.mint : Color.white)
                        .foregroundColor(name == selected ? Color.white : Color.mint)
                        .cornerRadius(20)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 6)
        }
    }
}

struct FormSheet: View {
    let form: FormRequest
    @EnvironmentObject var store: PawStore
    @State private var values: [String]
    init(form: FormRequest) {
        self.form = form
        _values = State(initialValue: Array(repeating: "", count: form.labels.count))
    }
    var body: some View {
        NavigationStack {
            Form {
                ForEach(form.labels.indices, id: \.self) { i in
                    TextField(form.labels[i], text: $values[i])
                }
            }
            .navigationTitle(form.title)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { store.form = nil }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("确定") {
                        let text = values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                        form.submit(text)
                        store.form = nil
                    }
                }
            }
        }
    }
}

struct ChoiceSheet: View {
    let choice: ChoiceRequest
    @EnvironmentObject var store: PawStore
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(choice.title).font(.headline).padding(.top, 16)
            ForEach(choice.options, id: \.self) { opt in
                Button(opt) {
                    let submit = choice.submit
                    store.choice = nil
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
                        submit(opt)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 8)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .presentationDetents([.medium])
    }
}
