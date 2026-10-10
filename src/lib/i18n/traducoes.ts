import type { Idioma } from "./idiomas";

/**
 * Textos do site por idioma (2026-10-10).
 *
 * Cada chave guarda a frase nos idiomas disponíveis. O que ainda não foi
 * traduzido cai no português, então nenhuma tela quebra enquanto a tradução
 * avança. A tradução começou pelo que aparece em todas as telas (menu, áreas,
 * ações comuns, entrada e a tela "Para onde vai meu dinheiro").
 */
export type ChaveTraducao = keyof typeof TEXTOS;

type Entrada = Partial<Record<Idioma, string>> & { "pt-BR": string };

export const TEXTOS = {
  // Menu e áreas
  "nav.inicio": {
    "pt-BR": "Início", en: "Home", es: "Inicio", hi: "होम", fr: "Accueil", de: "Start", it: "Inizio", zh: "首页", ar: "الرئيسية",
  },
  "nav.dinheiro": {
    "pt-BR": "Dinheiro", en: "Money", es: "Dinero", hi: "पैसा", fr: "Argent", de: "Geld", it: "Denaro", zh: "资金", ar: "المال",
  },
  "nav.casa": {
    "pt-BR": "Casa e vida", en: "Home and life", es: "Casa y vida", hi: "घर और जीवन", fr: "Maison et vie", de: "Haus und Leben", it: "Casa e vita", zh: "家庭与生活", ar: "المنزل والحياة",
  },
  "nav.documentos": {
    "pt-BR": "Documentos", en: "Documents", es: "Documentos", hi: "दस्तावेज़", fr: "Documents", de: "Dokumente", it: "Documenti", zh: "文件", ar: "المستندات",
  },
  "nav.ferramentas": {
    "pt-BR": "Ferramentas", en: "Tools", es: "Herramientas", hi: "उपकरण", fr: "Outils", de: "Werkzeuge", it: "Strumenti", zh: "工具", ar: "الأدوات",
  },
  "nav.dashboard": {
    "pt-BR": "Dashboard", en: "Dashboard", es: "Panel", hi: "डैशबोर्ड", fr: "Tableau de bord", de: "Übersicht", it: "Cruscotto", zh: "仪表板", ar: "لوحة المعلومات",
  },
  "nav.receitas": {
    "pt-BR": "Receitas", en: "Income", es: "Ingresos", hi: "आय", fr: "Revenus", de: "Einnahmen", it: "Entrate", zh: "收入", ar: "الدخل",
  },
  "nav.despesas": {
    "pt-BR": "Despesas", en: "Expenses", es: "Gastos", hi: "खर्च", fr: "Dépenses", de: "Ausgaben", it: "Spese", zh: "支出", ar: "المصروفات",
  },
  "nav.cartoes": {
    "pt-BR": "Cartões", en: "Cards", es: "Tarjetas", hi: "कार्ड", fr: "Cartes", de: "Karten", it: "Carte", zh: "银行卡", ar: "البطاقات",
  },
  "nav.investimentos": {
    "pt-BR": "Investimentos", en: "Investments", es: "Inversiones", hi: "निवेश", fr: "Investissements", de: "Investitionen", it: "Investimenti", zh: "投资", ar: "الاستثمارات",
  },
  "nav.importar": {
    "pt-BR": "Importar faturas", en: "Import statements", es: "Importar facturas", hi: "विवरण आयात करें", fr: "Importer des relevés", de: "Abrechnungen importieren", it: "Importa estratti", zh: "导入账单", ar: "استيراد الفواتير",
  },
  "nav.paraOndeVai": {
    "pt-BR": "Para onde vai meu dinheiro", en: "Where my money goes", es: "Adónde va mi dinero", hi: "मेरा पैसा कहाँ जाता है", fr: "Où va mon argent", de: "Wohin mein Geld geht", it: "Dove vanno i miei soldi", zh: "我的钱去哪了", ar: "أين يذهب مالي",
  },
  "nav.lista": {
    "pt-BR": "Lista de compras", en: "Shopping list", es: "Lista de compras", hi: "खरीदारी सूची", fr: "Liste de courses", de: "Einkaufsliste", it: "Lista della spesa", zh: "购物清单", ar: "قائمة التسوق",
  },
  "nav.veiculo": {
    "pt-BR": "Veículo", en: "Vehicle", es: "Vehículo", hi: "वाहन", fr: "Véhicule", de: "Fahrzeug", it: "Veicolo", zh: "车辆", ar: "المركبة",
  },
  "nav.pet": {
    "pt-BR": "Pet", en: "Pet", es: "Mascota", hi: "पालतू", fr: "Animal", de: "Haustier", it: "Animale", zh: "宠物", ar: "الحيوان الأليف",
  },
  "nav.exames": {
    "pt-BR": "Exames", en: "Health records", es: "Exámenes", hi: "जाँच", fr: "Examens", de: "Untersuchungen", it: "Esami", zh: "体检", ar: "الفحوصات",
  },
  "nav.notas": {
    "pt-BR": "Notas fiscais", en: "Receipts", es: "Facturas", hi: "रसीदें", fr: "Factures", de: "Belege", it: "Ricevute", zh: "发票", ar: "الفواتير",
  },
  "nav.anotacoes": {
    "pt-BR": "Anotações", en: "Notes", es: "Notas", hi: "नोट्स", fr: "Notes", de: "Notizen", it: "Note", zh: "笔记", ar: "الملاحظات",
  },
  "nav.calculadora": {
    "pt-BR": "Calculadora", en: "Calculator", es: "Calculadora", hi: "कैलकुलेटर", fr: "Calculatrice", de: "Rechner", it: "Calcolatrice", zh: "计算器", ar: "الآلة الحاسبة",
  },
  "nav.configuracoes": {
    "pt-BR": "Configurações", en: "Settings", es: "Configuración", hi: "सेटिंग्स", fr: "Paramètres", de: "Einstellungen", it: "Impostazioni", zh: "设置", ar: "الإعدادات",
  },
  "nav.conta": {
    "pt-BR": "Minha conta", en: "My account", es: "Mi cuenta", hi: "मेरा खाता", fr: "Mon compte", de: "Mein Konto", it: "Il mio account", zh: "我的账户", ar: "حسابي",
  },
  "nav.sair": {
    "pt-BR": "Sair", en: "Sign out", es: "Salir", hi: "साइन आउट", fr: "Se déconnecter", de: "Abmelden", it: "Esci", zh: "退出", ar: "تسجيل الخروج",
  },
  "nav.voltar": {
    "pt-BR": "Voltar", en: "Back", es: "Volver", hi: "वापस", fr: "Retour", de: "Zurück", it: "Indietro", zh: "返回", ar: "رجوع",
  },

  // Ações comuns
  "acao.salvar": {
    "pt-BR": "Salvar", en: "Save", es: "Guardar", hi: "सहेजें", fr: "Enregistrer", de: "Speichern", it: "Salva", zh: "保存", ar: "حفظ",
  },
  "acao.cancelar": {
    "pt-BR": "Cancelar", en: "Cancel", es: "Cancelar", hi: "रद्द करें", fr: "Annuler", de: "Abbrechen", it: "Annulla", zh: "取消", ar: "إلغاء",
  },
  "acao.fechar": {
    "pt-BR": "Fechar", en: "Close", es: "Cerrar", hi: "बंद करें", fr: "Fermer", de: "Schließen", it: "Chiudi", zh: "关闭", ar: "إغلاق",
  },
  "acao.adicionar": {
    "pt-BR": "Adicionar", en: "Add", es: "Añadir", hi: "जोड़ें", fr: "Ajouter", de: "Hinzufügen", it: "Aggiungi", zh: "添加", ar: "إضافة",
  },
  "acao.remover": {
    "pt-BR": "Remover", en: "Remove", es: "Eliminar", hi: "हटाएँ", fr: "Supprimer", de: "Entfernen", it: "Rimuovi", zh: "删除", ar: "إزالة",
  },
  "acao.editar": {
    "pt-BR": "Editar", en: "Edit", es: "Editar", hi: "संपादित करें", fr: "Modifier", de: "Bearbeiten", it: "Modifica", zh: "编辑", ar: "تعديل",
  },
  "acao.buscar": {
    "pt-BR": "Buscar", en: "Search", es: "Buscar", hi: "खोजें", fr: "Rechercher", de: "Suchen", it: "Cerca", zh: "搜索", ar: "بحث",
  },
  "acao.carregando": {
    "pt-BR": "Carregando…", en: "Loading…", es: "Cargando…", hi: "लोड हो रहा है…", fr: "Chargement…", de: "Wird geladen…", it: "Caricamento…", zh: "加载中…", ar: "جارٍ التحميل…",
  },

  // Entrar
  "entrar.titulo": {
    "pt-BR": "Entrar", en: "Sign in", es: "Entrar", hi: "साइन इन", fr: "Connexion", de: "Anmelden", it: "Accedi", zh: "登录", ar: "تسجيل الدخول",
  },
  "entrar.email": {
    "pt-BR": "E-mail", en: "Email", es: "Correo electrónico", hi: "ईमेल", fr: "E-mail", de: "E-Mail", it: "E-mail", zh: "电子邮箱", ar: "البريد الإلكتروني",
  },
  "entrar.senha": {
    "pt-BR": "Senha", en: "Password", es: "Contraseña", hi: "पासवर्ड", fr: "Mot de passe", de: "Passwort", it: "Password", zh: "密码", ar: "كلمة المرور",
  },
  "entrar.esqueciSenha": {
    "pt-BR": "Esqueci minha senha", en: "I forgot my password", es: "Olvidé mi contraseña", hi: "मैं पासवर्ड भूल गया", fr: "Mot de passe oublié", de: "Passwort vergessen", it: "Ho dimenticato la password", zh: "忘记密码", ar: "نسيت كلمة المرور",
  },
  "entrar.comGoogle": {
    "pt-BR": "Entrar com Google", en: "Continue with Google", es: "Continuar con Google", hi: "Google से जारी रखें", fr: "Continuer avec Google", de: "Mit Google fortfahren", it: "Continua con Google", zh: "使用 Google 登录", ar: "المتابعة عبر Google",
  },

  // Para onde vai meu dinheiro
  "paraOndeVai.descricao": {
    "pt-BR": "Seus gastos por categoria, as cobranças que se repetem e o que já deixou de sair da sua conta.",
    en: "Your spending by category, the charges that repeat every month and what already stopped leaving your account.",
    es: "Tus gastos por categoría, los cobros que se repiten y lo que ya dejó de salir de tu cuenta.",
    hi: "श्रेणी के अनुसार आपके खर्च, हर महीने दोहराए जाने वाले शुल्क और जो अब आपके खाते से नहीं निकल रहा है।",
    fr: "Vos dépenses par catégorie, les prélèvements qui reviennent chaque mois et ce qui ne sort plus de votre compte.",
    de: "Ihre Ausgaben nach Kategorie, die monatlich wiederkehrenden Abbuchungen und was Ihr Konto nicht mehr verlässt.",
    it: "Le tue spese per categoria, gli addebiti che si ripetono ogni mese e ciò che non esce più dal tuo conto.",
    zh: "按类别查看支出、每月重复的扣款，以及已经不再从账户扣走的费用。",
    ar: "مصروفاتك حسب الفئة، والرسوم التي تتكرر كل شهر، وما لم يعد يخرج من حسابك.",
  },
  "paraOndeVai.ondeFoiParar": {
    "pt-BR": "Onde o dinheiro foi parar", en: "Where the money went", es: "Adónde fue el dinero", hi: "पैसा कहाँ गया", fr: "Où est passé l'argent", de: "Wohin das Geld ging", it: "Dove sono finiti i soldi", zh: "钱去了哪里", ar: "أين ذهب المال",
  },
  "paraOndeVai.mesAMes": {
    "pt-BR": "Mês a mês", en: "Month by month", es: "Mes a mes", hi: "महीने दर महीने", fr: "Mois par mois", de: "Monat für Monat", it: "Mese per mese", zh: "逐月", ar: "شهراً بشهر",
  },
  "paraOndeVai.recorrentes": {
    "pt-BR": "Cobranças que se repetem", en: "Charges that repeat", es: "Cobros que se repiten", hi: "दोहराए जाने वाले शुल्क", fr: "Prélèvements récurrents", de: "Wiederkehrende Abbuchungen", it: "Addebiti ricorrenti", zh: "重复扣款", ar: "الرسوم المتكررة",
  },
  "paraOndeVai.economia": {
    "pt-BR": "Economia que já aconteceu", en: "Savings that already happened", es: "Ahorro que ya ocurrió", hi: "पहले से हुई बचत", fr: "Économies déjà réalisées", de: "Bereits erzielte Ersparnis", it: "Risparmio già ottenuto", zh: "已经节省的钱", ar: "التوفير الذي تحقق بالفعل",
  },
  "paraOndeVai.querocancelar": {
    "pt-BR": "Quero cancelar", en: "I want to cancel", es: "Quiero cancelar", hi: "मैं रद्द करना चाहता हूँ", fr: "Je veux annuler", de: "Ich möchte kündigen", it: "Voglio disdire", zh: "我想取消", ar: "أريد الإلغاء",
  },
  "paraOndeVai.categorias": {
    "pt-BR": "Categorias em números", en: "Categories in numbers", es: "Categorías en números", hi: "श्रेणियाँ संख्या में", fr: "Catégories en chiffres", de: "Kategorien in Zahlen", it: "Categorie in numeri", zh: "分类数据", ar: "الفئات بالأرقام",
  },

  // Idioma
  "idioma.titulo": {
    "pt-BR": "Idioma", en: "Language", es: "Idioma", hi: "भाषा", fr: "Langue", de: "Sprache", it: "Lingua", zh: "语言", ar: "اللغة",
  },
  "idioma.escolher": {
    "pt-BR": "Escolher idioma", en: "Choose language", es: "Elegir idioma", hi: "भाषा चुनें", fr: "Choisir la langue", de: "Sprache wählen", it: "Scegli la lingua", zh: "选择语言", ar: "اختر اللغة",
  },
  "idioma.salvo": {
    "pt-BR": "Idioma salvo na sua conta.", en: "Language saved to your account.", es: "Idioma guardado en tu cuenta.", hi: "भाषा आपके खाते में सहेजी गई।", fr: "Langue enregistrée dans votre compte.", de: "Sprache in Ihrem Konto gespeichert.", it: "Lingua salvata nel tuo account.", zh: "语言已保存到您的账户。", ar: "تم حفظ اللغة في حسابك.",
  },
  "idioma.parcial": {
    "pt-BR": "A tradução está avançando por tela. O que ainda não foi traduzido aparece em português.",
    en: "Translation is rolling out screen by screen. Anything not translated yet shows in Portuguese.",
    es: "La traducción avanza pantalla por pantalla. Lo que aún no está traducido aparece en portugués.",
    hi: "अनुवाद स्क्रीन दर स्क्रीन आगे बढ़ रहा है। जो अभी अनुवादित नहीं है वह पुर्तगाली में दिखेगा।",
    fr: "La traduction avance écran par écran. Ce qui n'est pas encore traduit s'affiche en portugais.",
    de: "Die Übersetzung erfolgt Bildschirm für Bildschirm. Noch nicht Übersetztes erscheint auf Portugiesisch.",
    it: "La traduzione procede schermata per schermata. Ciò che non è ancora tradotto appare in portoghese.",
    zh: "翻译正在逐屏进行。尚未翻译的内容以葡萄牙语显示。",
    ar: "تتم الترجمة شاشة تلو الأخرى. ما لم يُترجم بعد يظهر بالبرتغالية.",
  },
} satisfies Record<string, Entrada>;

export function traduzir(chave: ChaveTraducao, idioma: Idioma): string {
  const entrada = TEXTOS[chave] as Entrada;
  return entrada[idioma] ?? entrada["pt-BR"];
}
