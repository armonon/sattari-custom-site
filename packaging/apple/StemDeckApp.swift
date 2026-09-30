import SwiftUI
import WebKit
#if os(macOS)
import AppKit
#else
import UIKit
#endif

// This intentionally uses the deployed HTTPS web engine, not the JUCE engine.
// Never inject a native file/system bridge into remotely supplied JavaScript.
enum StudioLocation {
    static let url = URL(string: "https://sattarimusic.com/studio?edition=apple")!
    static func trusted(_ url: URL?) -> Bool {
        url?.scheme == "https" && url?.host == "sattarimusic.com" && (url?.port == nil || url?.port == 443)
    }
}

@main
struct StemDeckApp: App {
    #if os(macOS)
    @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate
    #endif
    var body: some Scene {
        WindowGroup("STEMDECK Web") {
            StudioScreen()
                #if os(macOS)
                .frame(minWidth: 820, minHeight: 600)
                #endif
        }
        #if os(macOS)
        .defaultSize(width: 1440, height: 900)
        #endif
    }
}

#if os(macOS)
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        let alert = NSAlert()
        alert.messageText = "Quit STEMDECK?"
        alert.informativeText = "Stop recording and export any unsaved project or take before quitting."
        alert.addButton(withTitle: "Keep Open")
        alert.addButton(withTitle: "Quit")
        return alert.runModal() == .alertSecondButtonReturn ? .terminateNow : .terminateCancel
    }
}
#endif

struct StudioScreen: View {
    @StateObject private var session = WebSession()
    var body: some View {
        ZStack {
            Color(red: 0.06, green: 0.065, blue: 0.075).ignoresSafeArea()
            StudioWebView(session: session)
            if let error = session.error {
                VStack(spacing: 16) {
                    Text("STEMDECK").font(.title.bold())
                    Text(error).multilineTextAlignment(.center)
                    Button("Retry — reload workspace") { session.retry() }
                    Text("Reloading stops audio. This edition requires internet to open.")
                        .font(.caption).foregroundStyle(.secondary)
                }.padding(28).frame(maxWidth: 420).background(.regularMaterial).cornerRadius(16)
            } else if session.loading {
                ProgressView("Opening STEMDECK…").padding(24).background(.regularMaterial).cornerRadius(16)
            }
        }
        .preferredColorScheme(.dark)
    }
}

@MainActor
final class WebSession: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    @Published var error: String?
    @Published var loading = true
    let web: WKWebView
    private var destinations: [ObjectIdentifier: URL] = [:]

    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        #if os(iOS)
        config.allowsInlineMediaPlayback = true
        #endif
        web = WKWebView(frame: .zero, configuration: config)
        super.init()
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
        web.load(URLRequest(url: StudioLocation.url))
    }
    func retry() {
        error = nil
        loading = true
        web.load(URLRequest(url: StudioLocation.url))
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loading = false }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError failure: Error) {
        if (failure as NSError).code == NSURLErrorCancelled { return }
        loading = false
        error = "Could not open StemDeck. Check your internet connection, then retry."
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError failure: Error) {
        self.webView(webView, didFailProvisionalNavigation: navigation, withError: failure)
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loading = false
        error = "The audio workspace stopped. Unsaved audio may be lost. Reload only when ready; check recovered takes and exported backups."
        // No automatic reload during a performance or capture.
    }
    private func external(_ url: URL) {
        guard ["https", "http", "mailto"].contains(url.scheme ?? "") else { return }
        #if os(macOS)
        NSWorkspace.shared.open(url)
        #else
        UIApplication.shared.open(url)
        #endif
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload {
            decisionHandler(StudioLocation.trusted(url) || url.scheme == "blob" ? .download : .cancel)
        } else if StudioLocation.trusted(url) && (url.path == "/studio" || url.path == "/studio/") {
            decisionHandler(.allow)
        } else {
            // External pages never replace the running audio workspace.
            if action.navigationType == .linkActivated { external(url) }
            decisionHandler(.cancel)
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(response.canShowMIMEType ? .allow : .download)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { external(url) }
        return nil
    }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.protocol == "https" && origin.host == "sattarimusic.com" && type == .microphone ? .prompt : .deny)
    }
    #if os(macOS)
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        panel.begin { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    #endif
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        // Separate directory per export; never silently overwrite an existing take.
        do {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let filename = (suggestedFilename as NSString).lastPathComponent
            let url = directory.appendingPathComponent(filename.isEmpty || filename == "." || filename == ".." ? "StemDeck-export" : filename)
            destinations[ObjectIdentifier(download)] = url
            completionHandler(url)
        } catch { completionHandler(nil); report("Could not start export: \(error.localizedDescription)") }
    }
    func downloadDidFinish(_ download: WKDownload) {
        guard let url = destinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
        #if os(macOS)
        let panel = NSSavePanel()
        panel.nameFieldStringValue = url.lastPathComponent
        panel.begin { result in
            guard result == .OK, let target = panel.url else {
                NSWorkspace.shared.activateFileViewerSelecting([url])
                return
            }
            do {
                // The native save panel supplies the explicit overwrite confirmation.
                if FileManager.default.fileExists(atPath: target.path) {
                    _ = try FileManager.default.replaceItemAt(target, withItemAt: url)
                } else { try FileManager.default.moveItem(at: url, to: target) }
            } catch {
                self.report("Could not save export. Your temporary export is retained: \(url.path)")
            }
        }
        #else
        // Persist completed exports in Files even if the share sheet is dismissed.
        do {
            let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let directory = documents.appendingPathComponent("Export-\(UUID().uuidString.prefix(8))", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let saved = directory.appendingPathComponent(url.lastPathComponent)
            try FileManager.default.moveItem(at: url, to: saved)
            let sheet = UIActivityViewController(activityItems: [saved], applicationActivities: nil)
            if let presenter = presenter() {
                sheet.popoverPresentationController?.sourceView = presenter.view
                sheet.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
                presenter.present(sheet, animated: true)
            }
        } catch { report("Could not save export to Files: \(error.localizedDescription)") }
        #endif
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        destinations.removeValue(forKey: ObjectIdentifier(download))
        report("Export did not finish. Please retry: \(error.localizedDescription)")
    }
    private func report(_ message: String) {
        #if os(macOS)
        let alert = NSAlert(); alert.messageText = "STEMDECK"; alert.informativeText = message; alert.runModal()
        #else
        let alert = UIAlertController(title: "STEMDECK", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        presenter()?.present(alert, animated: true)
        #endif
    }
    #if os(iOS)
    private func presenter() -> UIViewController? {
        var current = web.window?.rootViewController
        while let presented = current?.presentedViewController { current = presented }
        return current
    }
    #endif
    // Browser confirm/alert/prompt drive destructive-edit and naming workflows.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        dialog(message, text: nil, confirm: false) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        dialog(message, text: nil, confirm: true) { completionHandler($0 != nil) }
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        dialog(prompt, text: defaultText ?? "", confirm: true, completion: completionHandler)
    }
    private func dialog(_ message: String, text: String?, confirm: Bool, completion: @escaping (String?) -> Void) {
        #if os(macOS)
        let alert = NSAlert(); alert.messageText = "STEMDECK"; alert.informativeText = message
        alert.addButton(withTitle: "OK")
        if confirm { alert.addButton(withTitle: "Cancel") }
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
        if let text { field.stringValue = text; alert.accessoryView = field }
        completion(alert.runModal() == .alertFirstButtonReturn ? (text == nil ? "" : field.stringValue) : nil)
        #else
        guard let presenter = presenter() else { completion(nil); return }
        let alert = UIAlertController(title: "STEMDECK", message: message, preferredStyle: .alert)
        if let text { alert.addTextField { $0.text = text } }
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completion(alert.textFields?.first?.text ?? "") })
        if confirm { alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completion(nil) }) }
        presenter.present(alert, animated: true)
        #endif
    }
}

#if os(macOS)
struct StudioWebView: NSViewRepresentable {
    let session: WebSession
    func makeNSView(context: Context) -> WKWebView { session.web }
    func updateNSView(_ web: WKWebView, context: Context) {}
}
#else
struct StudioWebView: UIViewRepresentable {
    let session: WebSession
    func makeUIView(context: Context) -> WKWebView { session.web }
    func updateUIView(_ web: WKWebView, context: Context) {}
}
#endif
