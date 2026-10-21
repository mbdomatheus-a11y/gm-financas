import UIKit
import WebKit
import UserNotifications
import AuthenticationServices

/// Recursos nativos do app Control ALL (usados pelo MainViewController):
/// abertura animada, tela de login travada, login social pelo iOS e notificações locais.
extension MainViewController: ASWebAuthenticationPresentationContextProviding, UNUserNotificationCenterDelegate {

    // MARK: - Abertura animada

    /// Mostra o logo (mesma imagem da tela de abertura do iOS, então a passagem é contínua),
    /// com entrada suave e "respiração" até a primeira página carregar.
    func mostrarAbertura() {
        guard let webView = webView, !aberturaVisivel else { return }
        aberturaVisivel = true
        abertura.frame = webView.bounds
        abertura.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        abertura.backgroundColor = UIColor(red: 248.0 / 255.0, green: 250.0 / 255.0, blue: 252.0 / 255.0, alpha: 1)
        abertura.isUserInteractionEnabled = true

        let logo = UIImageView(image: UIImage(named: "Splash"))
        logo.contentMode = .scaleAspectFill
        logo.frame = abertura.bounds
        logo.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        logo.tag = 7001
        abertura.addSubview(logo)
        webView.addSubview(abertura)

        // Respira levemente enquanto carrega.
        UIView.animate(withDuration: 0.9, delay: 0.15, options: [.autoreverse, .repeat, .curveEaseInOut, .allowUserInteraction]) {
            logo.transform = CGAffineTransform(scaleX: 0.93, y: 0.93)
        }
        // Segurança: nunca prende o usuário na abertura (rede lenta, erro de carregamento).
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in self?.esconderAbertura() }
    }

    /// Sai com um "zoom" para frente e desaparecendo, como nos apps modernos.
    func esconderAbertura() {
        guard aberturaVisivel else { return }
        aberturaVisivel = false
        let logo = abertura.viewWithTag(7001)
        logo?.layer.removeAllAnimations()
        UIView.animate(withDuration: 0.5, delay: 0.1, usingSpringWithDamping: 0.85, initialSpringVelocity: 0.4, options: [.curveEaseIn]) {
            logo?.transform = CGAffineTransform(scaleX: 1.35, y: 1.35)
            self.abertura.alpha = 0
        } completion: { _ in
            self.abertura.removeFromSuperview()
            self.abertura.alpha = 1
            logo?.removeFromSuperview()
        }
    }

    // MARK: - Tela de login travada

    /// Na tela de login (e telas de acesso) a página não rola nem "puxa para atualizar":
    /// fica fixa como uma tela de app. Nas demais, volta ao normal.
    func aplicarRota(_ rota: String) {
        guard let webView = webView else { return }
        // A página inicial do site (marketing) não existe no app: qualquer ida a "/" vira o Início
        // (que manda para Entrar/Criar conta se a pessoa não estiver logada).
        if rota == "/" || rota.isEmpty {
            webView.evaluateJavaScript("location.replace('/inicio')", completionHandler: nil)
            return
        }
        let telasDeAcesso = ["/entrar", "/esqueci-senha", "/redefinir-senha", "/nova-senha"]
        let travar = telasDeAcesso.contains { rota == $0 || rota.hasPrefix($0 + "/") }
        webView.scrollView.bounces = !travar
        webView.scrollView.refreshControl = travar ? nil : controleAtualizar
    }

    // MARK: - Login social (Google, Microsoft, Apple) dentro do app

    /// Abre a janela de login do iOS (a mesma que os apps de banco usam). Ao terminar, ela fecha
    /// sozinha e devolve o retorno (controlall://auth-callback...) para o site abrir a sessão.
    func iniciarLoginSocial(_ endereco: String) {
        guard let url = URL(string: endereco) else {
            responderSite(evento: "auth-app-resultado", ["ok": false, "erro": "Endereço de login inválido."])
            return
        }
        let sessao = ASWebAuthenticationSession(url: url, callbackURLScheme: "controlall") { [weak self] retorno, erro in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.sessaoLogin = nil
                if let retorno = retorno {
                    self.responderSite(evento: "auth-app-resultado", ["ok": true, "url": retorno.absoluteString])
                } else if let erro = erro as? ASWebAuthenticationSessionError, erro.code == .canceledLogin {
                    self.responderSite(evento: "auth-app-resultado", ["ok": false, "cancelado": true])
                } else {
                    self.responderSite(evento: "auth-app-resultado",
                                       ["ok": false, "erro": erro?.localizedDescription ?? "Não foi possível entrar."])
                }
            }
        }
        sessao.presentationContextProvider = self
        sessao.prefersEphemeralWebBrowserSession = false
        sessaoLogin = sessao
        if !sessao.start() {
            sessaoLogin = nil
            responderSite(evento: "auth-app-resultado", ["ok": false, "erro": "Não consegui abrir a janela de login."])
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return view.window ?? ASPresentationAnchor()
    }

    // MARK: - Notificações (tela de bloqueio)

    /// acao "testar": notificação em 5 segundos (bloqueie a tela para ver).
    /// acao "agendar": troca os lembretes agendados pelos vencimentos atuais enviados pelo site.
    func tratarNotificacoes(_ corpo: [String: Any]) {
        let centro = UNUserNotificationCenter.current()
        let acao = corpo["acao"] as? String

        if acao == "testar" {
            garantirPermissaoNotificacoes { [weak self] permitido in
                guard let self = self else { return }
                guard permitido else {
                    self.responderSite(evento: "notificacao-app-resultado", [
                        "ok": false,
                        "erro": "Notificações desligadas. Libere em Ajustes > Control ALL > Notificações.",
                    ])
                    return
                }
                let conteudo = UNMutableNotificationContent()
                conteudo.title = "Control ALL"
                conteudo.body = "Teste de alerta: as notificações estão funcionando na tela de bloqueio."
                conteudo.sound = .default
                conteudo.userInfo = ["destino": "/inicio"]
                let pedido = UNNotificationRequest(
                    identifier: "controlall.teste.\(Int(Date().timeIntervalSince1970))",
                    content: conteudo,
                    trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
                )
                centro.add(pedido) { erro in
                    DispatchQueue.main.async {
                        self.responderSite(evento: "notificacao-app-resultado",
                                           erro == nil ? ["ok": true] : ["ok": false, "erro": "Não consegui agendar o teste."])
                    }
                }
            }
            return
        }

        guard acao == "agendar" else { return }
        let itens = (corpo["itens"] as? [[String: Any]]) ?? []
        centro.getNotificationSettings { ajustes in
            // Não pergunta aqui: só agenda se o usuário já permitiu (na boas-vindas ou no teste).
            guard ajustes.authorizationStatus == .authorized || ajustes.authorizationStatus == .provisional else { return }
            centro.getPendingNotificationRequests { pendentes in
                let antigos = pendentes.map { $0.identifier }.filter { $0.hasPrefix("controlall.lembrete.") }
                centro.removePendingNotificationRequests(withIdentifiers: antigos)

                let formato = DateFormatter()
                formato.calendar = Calendar(identifier: .gregorian)
                formato.locale = Locale(identifier: "en_US_POSIX")
                formato.timeZone = TimeZone.current
                formato.dateFormat = "yyyy-MM-dd'T'HH:mm"
                let agora = Date()
                // O iOS guarda no máximo 64 notificações pendentes por app.
                for item in itens.prefix(60) {
                    guard let id = item["id"] as? String,
                          let titulo = item["titulo"] as? String,
                          let quandoTexto = item["quando"] as? String,
                          let quando = formato.date(from: quandoTexto), quando > agora
                    else { continue }
                    let conteudo = UNMutableNotificationContent()
                    conteudo.title = titulo
                    conteudo.body = (item["corpo"] as? String) ?? ""
                    conteudo.sound = .default
                    conteudo.userInfo = ["destino": (item["destino"] as? String) ?? "/inicio"]
                    let partes = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: quando)
                    let pedido = UNNotificationRequest(
                        identifier: "controlall.lembrete.\(id)",
                        content: conteudo,
                        trigger: UNCalendarNotificationTrigger(dateMatching: partes, repeats: false)
                    )
                    centro.add(pedido, withCompletionHandler: nil)
                }
            }
        }
    }

    private func garantirPermissaoNotificacoes(_ concluir: @escaping (Bool) -> Void) {
        let centro = UNUserNotificationCenter.current()
        centro.getNotificationSettings { ajustes in
            switch ajustes.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                DispatchQueue.main.async { concluir(true) }
            case .notDetermined:
                centro.requestAuthorization(options: [.alert, .sound, .badge]) { ok, _ in
                    DispatchQueue.main.async { concluir(ok) }
                }
            default:
                DispatchQueue.main.async { concluir(false) }
            }
        }
    }

    /// Com o app aberto, a notificação também aparece (banner).
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    /// Tocar na notificação abre a tela relacionada (despesas, cartões, notas...).
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let destino = (response.notification.request.content.userInfo["destino"] as? String) ?? "/inicio"
        if destino.hasPrefix("/"), let url = URL(string: "https://www.controlall.com.br" + destino) {
            DispatchQueue.main.async { [weak self] in self?.webView?.load(URLRequest(url: url)) }
        }
        completionHandler()
    }
}
