import UIKit
import WebKit
import AVFoundation
import EventKit
import UserNotifications
import AuthenticationServices
import Capacitor

/// Controlador principal do app Control ALL.
/// Deixa a WebView com comportamento de app nativo:
/// - faixa sólida atrás da barra de status / Dynamic Island (o conteúdo não aparece por trás);
/// - gesto de voltar deslizando da borda esquerda;
/// - puxar para atualizar;
/// - cor da faixa e da barra de status acompanhando o tema claro/escuro do site;
/// - marca o documento com a classe `native-app` (o site usa isso para o modo app);
/// - downloads (blob/data) viram a folha de compartilhamento do iOS (Salvar imagem, Arquivos...).
class MainViewController: CAPBridgeViewController, WKScriptMessageHandler {

    private let corClara = UIColor(red: 248.0 / 255.0, green: 250.0 / 255.0, blue: 252.0 / 255.0, alpha: 1)
    private let corEscura = UIColor(red: 15.0 / 255.0, green: 21.0 / 255.0, blue: 32.0 / 255.0, alpha: 1)
    private let faixaStatus = UIView()
    private var temaEscuro = false
    private var alturaTeclado: CGFloat = 0
    // v2: inclui notificações (quem já respondeu câmera/microfone vê só o que falta).
    private let chavePermissoes = "controlall.permissoesIniciaisPedidas.v2"

    // Usados pelos recursos em RecursosNativos.swift.
    var controleAtualizar: UIRefreshControl?
    var sessaoLogin: ASWebAuthenticationSession?
    let abertura = UIView()
    var aberturaVisivel = false

    // MARK: - Configuração da WebView (antes de ela ser criada)

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        let conteudo = config.userContentController

        // Marca o modo app o mais cedo possível e manda o "/" (página de marketing) para o app.
        let inicio = """
        (function () {
          try {
            document.documentElement.classList.add('native-app');
            if (location.pathname === '/' || location.pathname === '') { location.replace('/inicio'); }
          } catch (e) {}
        })();
        """
        conteudo.addUserScript(WKUserScript(source: inicio, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        // Depois que a página carrega: sem zoom, tema para o nativo e downloads pelo compartilhar.
        let aposCarregar = """
        (function () {
          var raiz = document.documentElement;

          // Sem zoom de pinça nem zoom automático ao focar campos (comportamento de app).
          try {
            var vp = document.querySelector('meta[name="viewport"]');
            if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
            vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
          } catch (e) {}

          // Tema: avisa o app quando o site troca entre claro e escuro; mantém a classe native-app.
          var avisarTema = function () {
            try {
              if (!raiz.classList.contains('native-app')) { raiz.classList.add('native-app'); }
              window.webkit.messageHandlers.temaApp.postMessage(raiz.classList.contains('dark') ? 'escuro' : 'claro');
            } catch (e) {}
          };
          avisarTema();
          try { new MutationObserver(avisarTema).observe(raiz, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}

          // Direção da navegação: voltar anima entrando pela esquerda (CSS html[data-nav="voltar"]).
          window.addEventListener('popstate', function () {
            raiz.dataset.nav = 'voltar';
            setTimeout(function () { raiz.dataset.nav = 'ir'; }, 700);
          }, true);

          // Rota atual: o app trava a rolagem na tela de login e libera nas demais.
          try {
            var ultimaRota = null;
            var avisarRota = function () {
              if (location.pathname === ultimaRota) { return; }
              ultimaRota = location.pathname;
              try { window.webkit.messageHandlers.rotaApp.postMessage(location.pathname); } catch (e) {}
            };
            ['pushState', 'replaceState'].forEach(function (m) {
              var original = history[m];
              history[m] = function () { var r = original.apply(this, arguments); setTimeout(avisarRota, 0); return r; };
            });
            window.addEventListener('popstate', avisarRota);
            setInterval(avisarRota, 700);
            avisarRota();
          } catch (e) {}

          // Downloads: guarda os blobs criados para poder compartilhar na hora do clique.
          try {
            var blobs = {};
            var criarOriginal = URL.createObjectURL;
            URL.createObjectURL = function (obj) {
              var url = criarOriginal.apply(URL, arguments);
              try { if (obj instanceof Blob) { blobs[url] = obj; } } catch (e) {}
              return url;
            };
            var dataParaBlob = function (dataUrl) {
              var partes = dataUrl.split(',');
              var tipo = (partes[0].match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
              var base64 = partes[0].indexOf(';base64') >= 0;
              var bruto = base64 ? atob(partes[1]) : decodeURIComponent(partes[1]);
              var bytes = new Uint8Array(bruto.length);
              for (var i = 0; i < bruto.length; i++) { bytes[i] = bruto.charCodeAt(i); }
              return new Blob([bytes], { type: tipo });
            };
            var clicarOriginal = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function () {
              try {
                var href = this.href || '';
                if (this.hasAttribute('download') && navigator.share && (href.indexOf('blob:') === 0 || href.indexOf('data:') === 0)) {
                  var blob = href.indexOf('data:') === 0 ? dataParaBlob(href) : blobs[href];
                  if (blob) {
                    var nome = this.getAttribute('download') || 'arquivo';
                    var arquivo = new File([blob], nome, { type: blob.type || 'application/octet-stream' });
                    if (!navigator.canShare || navigator.canShare({ files: [arquivo] })) {
                      navigator.share({ files: [arquivo], title: nome }).catch(function () {});
                      return;
                    }
                  }
                }
              } catch (e) {}
              return clicarOriginal.apply(this, arguments);
            };
          } catch (e) {}
        })();
        """
        conteudo.addUserScript(WKUserScript(source: aposCarregar, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        conteudo.add(self, name: "temaApp")
        conteudo.add(self, name: "agendaApp")
        conteudo.add(self, name: "authApp")
        conteudo.add(self, name: "notificacoesApp")
        conteudo.add(self, name: "rotaApp")

        // Versão do app instalada (aparece no Menu do site dentro do app).
        let info = Bundle.main.infoDictionary
        let versao = (info?["CFBundleShortVersionString"] as? String) ?? "?"
        let build = (info?["CFBundleVersion"] as? String) ?? "?"
        // agendaVinculada: o site sincroniza a agenda sozinho e esconde o botão de vincular.
        let vinculada = agendaVinculada() ? "true" : "false"
        let versaoJS = "window.__controlAllApp = { plataforma: 'ios', versao: '\(versao)', build: '\(build)', agendaVinculada: \(vinculada) };"
        conteudo.addUserScript(WKUserScript(source: versaoJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        return config
    }

    // MARK: - Ajustes depois que a WebView existe

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView = self.webView else { return }

        // Gesto de voltar/avançar deslizando da borda, como em app nativo.
        webView.allowsBackForwardNavigationGestures = true

        // Puxar para atualizar.
        let atualizar = UIRefreshControl()
        atualizar.addTarget(self, action: #selector(recarregar(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = atualizar
        controleAtualizar = atualizar

        // Notificações locais: mostra mesmo com o app aberto e abre a tela certa ao tocar.
        UNUserNotificationCenter.current().delegate = self

        // Faixa sólida atrás da barra de status / Dynamic Island.
        faixaStatus.translatesAutoresizingMaskIntoConstraints = false
        faixaStatus.isUserInteractionEnabled = false
        webView.addSubview(faixaStatus)
        NSLayoutConstraint.activate([
            faixaStatus.topAnchor.constraint(equalTo: webView.topAnchor),
            faixaStatus.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
            faixaStatus.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
            faixaStatus.bottomAnchor.constraint(equalTo: webView.safeAreaLayoutGuide.topAnchor),
        ])
        aplicarTema(escuro: false)

        // Teclado: a WebView encolhe para caber acima dele (nada fica "atrás" do teclado
        // e a tela não pula), e o site esconde a barra de baixo enquanto ele está aberto.
        let centro = NotificationCenter.default
        centro.addObserver(self, selector: #selector(tecladoMudou(_:)),
                           name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        centro.addObserver(self, selector: #selector(tecladoSumiu(_:)),
                           name: UIResponder.keyboardWillHideNotification, object: nil)

        // Abertura animada (por cima de tudo, até a primeira página carregar).
        mostrarAbertura()
    }

    // MARK: - Primeira abertura: pedir câmera e microfone

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !UserDefaults.standard.bool(forKey: chavePermissoes) else { return }
        // Espera a primeira tela aparecer antes de perguntar.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in self?.pedirPermissoesIniciais() }
    }

    private func pedirPermissoesIniciais() {
        guard view.window != nil, presentedViewController == nil else { return }
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] ajustes in
            DispatchQueue.main.async {
                self?.mostrarBoasVindas(precisaNotificacoes: ajustes.authorizationStatus == .notDetermined)
            }
        }
    }

    private func mostrarBoasVindas(precisaNotificacoes: Bool) {
        guard view.window != nil, presentedViewController == nil else { return }
        UserDefaults.standard.set(true, forKey: chavePermissoes)
        let precisaCamera = AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined
        let precisaMicrofone = AVCaptureDevice.authorizationStatus(for: .audio) == .notDetermined
        guard precisaCamera || precisaMicrofone || precisaNotificacoes else { return }

        var usos: [String] = []
        if precisaCamera { usos.append("a câmera para fotografar notas fiscais e comprovantes") }
        if precisaMicrofone { usos.append("o microfone para lançar despesas falando") }
        if precisaNotificacoes { usos.append("as notificações para avisar vencimentos na tela de bloqueio") }
        let alerta = UIAlertController(
            title: "Bem-vindo ao Control ALL",
            message: "Para funcionar completo, o app usa " + usos.joined(separator: ", ")
                + ". Você pode mudar isso depois em Ajustes.",
            preferredStyle: .alert
        )
        alerta.addAction(UIAlertAction(title: "Agora não", style: .cancel))
        alerta.addAction(UIAlertAction(title: "Permitir", style: .default) { _ in
            // Um pedido do sistema por vez, na ordem: câmera, microfone, notificações.
            let pedirNotificacoes = {
                guard precisaNotificacoes else { return }
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
            }
            let pedirMicrofone = {
                guard precisaMicrofone else { pedirNotificacoes(); return }
                AVCaptureDevice.requestAccess(for: .audio) { _ in DispatchQueue.main.async { pedirNotificacoes() } }
            }
            if precisaCamera {
                AVCaptureDevice.requestAccess(for: .video) { _ in DispatchQueue.main.async { pedirMicrofone() } }
            } else {
                pedirMicrofone()
            }
        })
        present(alerta, animated: true)
    }

    // MARK: - Teclado

    @objc private func tecladoMudou(_ aviso: Notification) {
        guard let janela = webView?.window,
              let fim = (aviso.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue
        else { return }
        let fimNaJanela = janela.convert(fim, from: nil)
        aplicarTeclado(altura: max(0, janela.bounds.maxY - fimNaJanela.minY), aviso: aviso)
    }

    @objc private func tecladoSumiu(_ aviso: Notification) {
        aplicarTeclado(altura: 0, aviso: aviso)
    }

    private func aplicarTeclado(altura: CGFloat, aviso: Notification) {
        guard let webView = webView, let janela = webView.window, altura != alturaTeclado else { return }
        alturaTeclado = altura
        var quadro = janela.bounds
        quadro.size.height -= altura
        let duracao = (aviso.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25
        UIView.animate(withDuration: duracao) { webView.frame = quadro }
        webView.evaluateJavaScript(
            "document.documentElement.classList.toggle('teclado-aberto', \(altura > 0 ? "true" : "false"))",
            completionHandler: nil
        )
        atualizarAreasSeguras()
    }

    /// Passa para o site a altura real das áreas do sistema (barra de baixo / indicador de início).
    private func atualizarAreasSeguras() {
        guard let webView = webView else { return }
        let baixo = alturaTeclado > 0 ? 0 : view.safeAreaInsets.bottom
        let js = "document.documentElement.style.setProperty('--app-inset-bottom', '\(Int(baixo))px')"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    @objc private func recarregar(_ controle: UIRefreshControl) {
        webView?.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { controle.endRefreshing() }
    }

    // MARK: - Tema claro/escuro vindo do site

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "agendaApp":
            let corpo = message.body as? [String: Any]
            sincronizarAgenda(eventos: (corpo?["eventos"] as? [[String: Any]]) ?? [],
                              silencioso: (corpo?["silencioso"] as? Bool) ?? false)
            return
        case "authApp":
            if let corpo = message.body as? [String: Any], let endereco = corpo["url"] as? String {
                iniciarLoginSocial(endereco)
            }
            return
        case "notificacoesApp":
            tratarNotificacoes((message.body as? [String: Any]) ?? [:])
            return
        case "rotaApp":
            if let rota = message.body as? String { aplicarRota(rota) }
            return
        default:
            break
        }
        guard message.name == "temaApp", let valor = message.body as? String else { return }
        // A primeira página carregou: a abertura animada sai de cena.
        esconderAbertura()
        aplicarTema(escuro: valor == "escuro")
        // A cada página carregada (e troca de tema) reenvia as áreas seguras para o CSS.
        atualizarAreasSeguras()
    }

    // MARK: - Agenda do iPhone (calendário "Control ALL")

    private let agenda = EKEventStore()
    private let chaveCalendario = "controlall.calendarioId"

    private func pedirAcessoAgenda(_ concluir: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            agenda.requestFullAccessToEvents { ok, _ in DispatchQueue.main.async { concluir(ok) } }
        } else {
            agenda.requestAccess(to: .event) { ok, _ in DispatchQueue.main.async { concluir(ok) } }
        }
    }

    /// Calendário próprio do app: assim os vencimentos ficam separados e podem ser
    /// atualizados sem mexer nos outros compromissos do usuário.
    private func calendarioDoApp() throws -> EKCalendar {
        if let id = UserDefaults.standard.string(forKey: chaveCalendario), let existente = agenda.calendar(withIdentifier: id) {
            return existente
        }
        if let existente = agenda.calendars(for: .event).first(where: { $0.title == "Control ALL" && $0.allowsContentModifications }) {
            UserDefaults.standard.set(existente.calendarIdentifier, forKey: chaveCalendario)
            return existente
        }
        let novo = EKCalendar(for: .event, eventStore: agenda)
        novo.title = "Control ALL"
        novo.cgColor = UIColor(red: 47.0 / 255.0, green: 95.0 / 255.0, blue: 149.0 / 255.0, alpha: 1).cgColor
        novo.source = agenda.defaultCalendarForNewEvents?.source
            ?? agenda.sources.first(where: { $0.sourceType == .local })
            ?? agenda.sources.first
        try agenda.saveCalendar(novo, commit: true)
        UserDefaults.standard.set(novo.calendarIdentifier, forKey: chaveCalendario)
        return novo
    }

    /// Recria os vencimentos futuros no calendário do app (idempotente: sincronizar de novo
    /// atualiza valores e remove o que já foi pago ou excluído).
    private func sincronizarAgenda(eventos: [[String: Any]], silencioso: Bool = false) {
        pedirAcessoAgenda { [weak self] permitido in
            guard let self = self else { return }
            guard permitido else {
                self.responderAgenda(["ok": false, "erro": "Sem acesso à agenda. Libere em Ajustes > Control ALL > Calendários."], silencioso: silencioso)
                return
            }
            do {
                let calendario = try self.calendarioDoApp()
                let hoje = Calendar.current.startOfDay(for: Date())
                let inicio = Calendar.current.date(byAdding: .day, value: -1, to: hoje) ?? hoje
                let fim = Calendar.current.date(byAdding: .year, value: 2, to: hoje) ?? hoje
                let filtro = self.agenda.predicateForEvents(withStart: inicio, end: fim, calendars: [calendario])
                for antigo in self.agenda.events(matching: filtro) {
                    try self.agenda.remove(antigo, span: .thisEvent, commit: false)
                }
                let formato = DateFormatter()
                formato.calendar = Calendar(identifier: .gregorian)
                formato.locale = Locale(identifier: "en_US_POSIX")
                formato.timeZone = TimeZone.current
                formato.dateFormat = "yyyy-MM-dd"
                var total = 0
                for item in eventos {
                    guard let titulo = item["titulo"] as? String,
                          let texto = item["data"] as? String,
                          let dia = formato.date(from: texto), dia >= hoje
                    else { continue }
                    let evento = EKEvent(eventStore: self.agenda)
                    evento.calendar = calendario
                    evento.title = titulo
                    evento.isAllDay = true
                    evento.startDate = dia
                    evento.endDate = dia
                    evento.notes = item["notas"] as? String
                    evento.url = URL(string: "https://www.controlall.com.br/calendario")
                    evento.addAlarm(EKAlarm(relativeOffset: -15 * 3600)) // véspera, às 9h
                    try self.agenda.save(evento, span: .thisEvent, commit: false)
                    total += 1
                }
                try self.agenda.commit()
                self.responderAgenda(["ok": true, "total": total], silencioso: silencioso)
            } catch {
                self.agenda.reset()
                self.responderAgenda(["ok": false, "erro": "Não consegui gravar na agenda: \(error.localizedDescription)"], silencioso: silencioso)
            }
        }
    }

    private func responderAgenda(_ resultado: [String: Any], silencioso: Bool = false) {
        var dados = resultado
        dados["silencioso"] = silencioso
        let ok = (resultado["ok"] as? Bool) ?? false
        // Depois do primeiro vínculo, o site passa a sincronizar sozinho (e esconde o botão).
        webView?.evaluateJavaScript(
            "if (window.__controlAllApp) { window.__controlAllApp.agendaVinculada = \(ok ? "true" : "false"); }",
            completionHandler: nil
        )
        responderSite(evento: "agenda-app-resultado", dados)
    }

    /// Permissão de agenda concedida e calendário "Control ALL" já criado.
    func agendaVinculada() -> Bool {
        guard UserDefaults.standard.string(forKey: chaveCalendario) != nil else { return false }
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *) { return status == .fullAccess }
        return status == .authorized
    }

    /// Devolve um resultado para o site como evento do navegador (window.dispatchEvent).
    func responderSite(evento: String, _ resultado: [String: Any]) {
        guard let dados = try? JSONSerialization.data(withJSONObject: resultado),
              let json = String(data: dados, encoding: .utf8) else { return }
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('\(evento)', { detail: \(json) }))",
            completionHandler: nil
        )
    }

    private func aplicarTema(escuro: Bool) {
        temaEscuro = escuro
        let cor = escuro ? corEscura : corClara
        faixaStatus.backgroundColor = cor
        webView?.backgroundColor = cor
        webView?.scrollView.backgroundColor = cor
        // A barra de status "padrão" segue o estilo do controlador: texto escuro no claro e claro no escuro.
        overrideUserInterfaceStyle = escuro ? .dark : .light
        setNeedsStatusBarAppearanceUpdate()
    }
}
