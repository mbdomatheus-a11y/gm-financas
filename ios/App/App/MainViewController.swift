import UIKit
import WebKit
import AVFoundation
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
    private let chavePermissoes = "controlall.permissoesIniciaisPedidas"

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
        UserDefaults.standard.set(true, forKey: chavePermissoes)
        let precisaCamera = AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined
        let precisaMicrofone = AVCaptureDevice.authorizationStatus(for: .audio) == .notDetermined
        guard precisaCamera || precisaMicrofone else { return }

        let alerta = UIAlertController(
            title: "Bem-vindo ao Control ALL",
            message: "Para fotografar notas fiscais e comprovantes, e para lançar despesas falando, "
                + "o app precisa da câmera e do microfone. Você pode mudar isso depois em Ajustes.",
            preferredStyle: .alert
        )
        alerta.addAction(UIAlertAction(title: "Agora não", style: .cancel))
        alerta.addAction(UIAlertAction(title: "Permitir", style: .default) { _ in
            let pedirMicrofone = {
                guard precisaMicrofone else { return }
                AVCaptureDevice.requestAccess(for: .audio) { _ in }
            }
            if precisaCamera {
                AVCaptureDevice.requestAccess(for: .video) { _ in
                    DispatchQueue.main.async { pedirMicrofone() }
                }
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
        guard message.name == "temaApp", let valor = message.body as? String else { return }
        aplicarTema(escuro: valor == "escuro")
        // A cada página carregada (e troca de tema) reenvia as áreas seguras para o CSS.
        atualizarAreasSeguras()
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
