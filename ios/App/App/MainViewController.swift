import UIKit
import WebKit
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
    }

    @objc private func recarregar(_ controle: UIRefreshControl) {
        webView?.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { controle.endRefreshing() }
    }

    // MARK: - Tema claro/escuro vindo do site

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "temaApp", let valor = message.body as? String else { return }
        aplicarTema(escuro: valor == "escuro")
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
