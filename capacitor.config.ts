import type { CapacitorConfig } from "@capacitor/cli";

// App iOS do Control ALL (TestFlight). Carrega o site em produção dentro do app,
// então login e as server functions funcionam como no navegador.
const config: CapacitorConfig = {
  appId: "co.median.ios.nmlbjjq",
  appName: "Control ALL Finanças",
  webDir: "www",
  server: {
    url: "https://www.controlall.com.br",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#f5f9fc",
    allowsLinkPreview: false,
    scrollEnabled: true,
    preferredContentMode: "mobile",
  },
};

export default config;
