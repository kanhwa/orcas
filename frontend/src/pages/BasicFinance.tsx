import React, { useState, useEffect, useRef } from "react";
import { Card } from "../components/ui/Card";
import { User, BASE_URL } from "../services/api";

interface BasicFinanceProps {
  user?: User;
}

export default function BasicFinance({ user }: BasicFinanceProps) {
  const [inputValue, setInputValue] = useState("");
  const [glossaryLang, setGlossaryLang] = useState<"Indonesian" | "English">("Indonesian");
  const [openTerm, setOpenTerm] = useState<string | null>(null);

  // History state: 240 hours = 864000000 ms
  const [history, setHistory] = useState<{term: string; timestamp: number}[]>(() => {
    const saved = localStorage.getItem("orcas_search_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        return parsed.filter((item: any) => now - item.timestamp < 864000000);
      } catch { return []; }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("orcas_search_history", JSON.stringify(history));
  }, [history]);

  const saveToHistory = () => {
    const term = inputValue.trim();
    if (term && !history.some(h => h.term.toLowerCase() === term.toLowerCase())) {
      setHistory(prev => [{ term, timestamp: Date.now() }, ...prev]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveToHistory();
    }
  };

  const clearInput = () => {
    setInputValue("");
  };

  const removeHistoryItem = (term: string) => {
    setHistory(prev => prev.filter(h => h.term !== term));
  };

  const clearAllHistory = () => {
    setHistory([]);
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === highlight.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 text-yellow-900 font-bold px-0.5 rounded">{part}</span>
      ) : (
        part
      )
    );
  };


  const dictionaryID = [
    {
      category: "Keuangan Umum",
      items: [
        { term: "Bank", definition: "Lembaga keuangan yang memiliki lisensi untuk menerima simpanan, memberikan pinjaman, dan bertindak sebagai perantara dalam perekonomian." },
        { term: "Kode Saham (Ticker)", definition: "Singkatan unik yang mengidentifikasi saham perusahaan terbuka di bursa efek." }
      ]
    },
    {
      category: "Neraca Keuangan (Balance Sheet)",
      description: "Laporan keuangan yang menunjukkan aset, kewajiban, dan ekuitas bank pada titik waktu tertentu.",
      items: [
        { term: "Total Aset", definition: "Total nilai dari semua yang dimiliki bank, termasuk uang tunai, pinjaman yang diberikan, dan properti fisik." },
        { term: "Total Liabilitas", definition: "Total jumlah yang dihutangkan bank kepada pihak lain, utamanya simpanan nasabah dan dana pinjaman." },
        { term: "Total Ekuitas", definition: "Kekayaan bersih bank, yang mewakili sisa klaim pemilik setelah semua utang dibayar." },
        { term: "Simpanan Nasabah", definition: "Uang yang ditempatkan ke dalam bank oleh nasabah, yang bertindak sebagai sumber utama modal pinjaman." },
        { term: "Aset Tetap", definition: "Aset fisik jangka panjang seperti bangunan dan peralatan yang digunakan dalam operasi sehari-hari bank." },
        { term: "Kas dan Setara Kas", definition: "Aset paling likuid yang dipegang oleh bank untuk memenuhi permintaan penarikan jangka pendek." },
        { term: "Kredit yang Diberikan", definition: "Uang yang dipinjamkan kepada peminjam, menghasilkan pendapatan bunga utama bagi bank." },
        { term: "Pinjaman yang Diterima", definition: "Dana yang dipinjam bank dari institusi lain untuk mendukung aktivitas pinjamannya." },
        { term: "Penempatan pada Bank Indonesia", definition: "Dana yang sangat likuid dan aman yang diparkir di bank sentral untuk tujuan regulasi dan likuiditas." },
        { term: "Giro pada Bank Indonesia", definition: "Dana cadangan minimum wajib yang disimpan di bank sentral untuk memastikan likuiditas." },
        { term: "Perputaran Aset", definition: "Rasio yang mengukur seberapa efisien bank menggunakan asetnya untuk menghasilkan pendapatan operasional." },
        { term: "Rasio Harga terhadap Nilai Buku (PBV)", definition: "Rasio penilaian pasar yang membandingkan harga saham bank dengan nilai buku akuntansinya." },
        { term: "Nilai Buku per Saham (BVPS)", definition: "Nilai matematis dari satu saham jika bank melikuidasi semua aset dan membayar semua utangnya." },
        { term: "Nilai Buku Aset Berwujud per Saham (TBVPS)", definition: "Nilai buku per saham setelah mengurangi aset tak berwujud, menunjukkan nilai aset berwujud." }
      ]
    },
    {
      category: "Laporan Laba Rugi (Income Statement)",
      description: "Laporan keuangan yang menunjukkan pendapatan dan pengeluaran bank, yang menghasilkan laba atau rugi selama suatu periode.",
      items: [
        { term: "Total Pendapatan", definition: "Semua manfaat ekonomi masuk yang dihasilkan dari bunga, biaya, dan operasi perbankan lainnya." },
        { term: "Laba Bersih", definition: "Keuntungan akhir yang tersisa setelah semua biaya operasional, pajak, dan provisi dikurangi." },
        { term: "Laba Kotor", definition: "Keuntungan operasional inti sebelum dikurangi beban pajak dan non-operasional." },
        { term: "Beban Operasional", definition: "Biaya harian untuk menjalankan bank, seperti gaji pegawai, biaya IT, dan pemeliharaan cabang." },
        { term: "Pendapatan Bunga Bersih (NII)", definition: "Selisih antara bunga yang diperoleh dari peminjam dan bunga yang dibayarkan kepada nasabah penyimpan." },
        { term: "Penyisihan Kerugian Penurunan Nilai (CKPN)", definition: "Dana cadangan yang disiapkan sebagai bantalan jika peminjam gagal bayar (kredit macet)." },
        { term: "Laba per Saham (EPS)", definition: "Porsi laba bank yang dialokasikan untuk setiap lembar saham yang beredar." },
        { term: "Tingkat Pengembalian Aset (ROA)", definition: "Rasio profitabilitas yang menunjukkan seberapa banyak laba yang dihasilkan dari setiap rupiah aset yang dimiliki." },
        { term: "Tingkat Pengembalian Ekuitas (ROE)", definition: "Rasio profitabilitas yang menunjukkan seberapa efisien bank menggunakan uang pemegang saham untuk mencetak laba." },
        { term: "Margin Laba Bersih (NPM)", definition: "Persentase sisa pendapatan yang menjadi laba bersih setelah semua biaya operasional dibayar." },
        { term: "Margin Laba Kotor (GPM)", definition: "Persentase pendapatan kotor yang tersisa setelah mengurangi beban operasional langsung." },
        { term: "Rasio Beban Operasional terhadap Pendapatan Operasional (BOPO)", definition: "Rasio krusial yang mengukur seberapa efisien pengeluaran bank dibandingkan dengan pendapatannya." },
        { term: "Rasio Biaya terhadap Pendapatan (CIR)", definition: "Serupa dengan BOPO, rasio ini mengukur efisiensi operasional dengan membandingkan biaya dengan pendapatan operasional inti." }
      ]
    },
    {
      category: "Laporan Arus Kas (Cash Flow Statement)",
      description: "Laporan keuangan yang menunjukkan pergerakan masuk dan keluarnya uang tunai, menyoroti likuiditas bank.",
      items: [
        { term: "Arus Kas Operasional", definition: "Uang tunai murni yang dihasilkan dari bisnis inti bank sehari-hari (pinjaman dan simpanan)." },
        { term: "Arus Kas Investasi", definition: "Uang tunai yang digunakan untuk atau dihasilkan dari investasi jangka panjang, seperti membeli obligasi atau properti." },
        { term: "Arus Kas Pendanaan", definition: "Uang tunai yang terkait dengan pembiayaan bank, seperti menerbitkan saham, membagikan dividen, atau mengambil utang besar." },
        { term: "Kenaikan/Penurunan Kas Bersih", definition: "Total gabungan arus kas operasional, investasi, dan pendanaan, yang menunjukkan likuiditas akhir bank." }
      ]
    }
  ];

  const dictionaryEN = [
    {
      category: "General Finance",
      items: [
        { term: "Bank", definition: "A financial institution licensed to receive deposits, provide loans, and act as an intermediary in the economy." },
        { term: "Ticker", definition: "A unique abbreviation identifying a publicly traded company's shares on the stock exchange." }
      ]
    },
    {
      category: "Balance Sheet",
      description: "A financial statement showing a bank's assets, liabilities, and equity at a specific point in time.",
      items: [
        { term: "Total Assets", definition: "The total value of everything the bank owns, including cash, loans given, and physical property." },
        { term: "Total Liabilities", definition: "The total amount the bank owes to others, primarily customer deposits and borrowed funds." },
        { term: "Total Equity", definition: "The net worth of the bank, representing the owners' residual claim after debts are paid." },
        { term: "Customer Deposits", definition: "Money placed into the bank by customers, acting as the primary source of lending capital." },
        { term: "Fixed Assets", definition: "Long-term physical assets like buildings and equipment used in the bank's daily operations." },
        { term: "Cash and Cash Equivalents", definition: "The most liquid assets held by the bank to meet short-term withdrawal demands." },
        { term: "Loans Given", definition: "Money lent out to borrowers, generating the primary interest income for the bank." },
        { term: "Loans Received", definition: "Funds the bank has borrowed from other institutions to support its lending activities." },
        { term: "Placements with Bank Indonesia", definition: "Highly liquid and safe funds parked at the central bank for regulatory and liquidity purposes." },
        { term: "Giro at Bank Indonesia", definition: "Mandatory minimum reserve funds kept at the central bank to ensure liquidity." },
        { term: "Asset Turnover", definition: "A ratio measuring how efficiently the bank uses its assets to generate operational revenue." },
        { term: "Price to Book Value (PBV)", definition: "A market valuation ratio comparing the bank's stock price to its accounting book value." },
        { term: "Book Value Per Share (BVPS)", definition: "The mathematical value of a single share if the bank liquidated all assets and paid all debts." },
        { term: "Tangible Book Value Per Share", definition: "The book value per share after subtracting intangible assets, showing hard asset value." },
      ]
    },
    {
      category: "Income Statement",
      description: "A financial statement showing the bank's revenues and expenses, resulting in profit or loss over a period.",
      items: [
        { term: "Total Revenue", definition: "All incoming economic benefits generated from interest, fees, and other banking operations." },
        { term: "Net Income", definition: "The final profit remaining after all operating expenses, taxes, and provisions have been deducted." },
        { term: "Operating Expense", definition: "The day-to-day costs of running the bank, including salaries, rent, and administrative fees." },
        { term: "Income Before Tax", definition: "The pure business profit generated by the bank before government taxes are applied." },
        { term: "Income Tax Expense", definition: "The mandatory financial obligation paid to the government based on the bank's taxable profit." },
        { term: "Operating Income", definition: "Profit generated specifically from the bank's core operational activities before outside factors." },
        { term: "Gross Profit", definition: "The profit left after subtracting the direct costs of services, before general operating expenses." },
        { term: "Cost of Goods Sold", definition: "The direct costs associated with generating revenue; a higher cost erodes gross profit." },
        { term: "Other Income / Expense", definition: "Net financial results from non-core banking activities or extraordinary one-time events." },
        { term: "Comprehensive Income", definition: "Net income plus other unrealized gains or losses, showing total change in equity." },
        { term: "Outstanding Shares", definition: "The total number of company shares currently held by all investors in the market." },
        { term: "Earnings Per Share (EPS)", definition: "The portion of a bank's profit allocated to each individual outstanding share of stock." },
        { term: "Price to Earnings Ratio (PER)", definition: "A market ratio measuring the stock price relative to its generated earnings." },
        { term: "Price to Sales (P/S)", definition: "A valuation ratio comparing the bank's stock price to its total revenue generated." },
        { term: "Return on Assets (ROA)", definition: "An efficiency ratio showing how well the bank uses its total assets to generate profit." },
        { term: "Return on Equity (ROE)", definition: "An efficiency ratio showing how effectively the bank generates profit using shareholders' equity." },
      ]
    },
    {
      category: "Cash Flow Statement",
      description: "A financial statement tracking the actual cash entering and leaving the bank, ensuring short-term liquidity.",
      items: [
        { term: "Operating Cash Flow", definition: "Actual cash generated from the bank's core business activities, like interest received." },
        { term: "Investing Cash Flow", definition: "Net cash used or generated from buying or selling long-term assets and investments." },
        { term: "Financing Cash Flow", definition: "Cash movements related to borrowing, paying off debt, or distributing dividends to shareholders." },
        { term: "Free Cash Flow", definition: "The cash remaining after the bank has paid for its operating expenses and capital expenditures." },
        { term: "Free Cash Flow Per Share", definition: "The amount of free cash flow allocated to every single outstanding share." },
        { term: "Capital Expenditure", definition: "Money spent by the bank to buy, maintain, or improve its physical long-term assets." },
        { term: "Net Change in Cash", definition: "The total difference between cash entering and leaving the bank during the financial year." },
        { term: "Beginning Cash Balance", definition: "The total amount of liquid cash the bank holds at the very start of the financial year." },
        { term: "Ending Cash Balance", definition: "The final amount of liquid cash the bank holds at the end of the financial year." },
      ]
    }
  ];

  const dictionary = glossaryLang === "Indonesian" ? dictionaryID : dictionaryEN;


  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [chatLanguage, setChatLanguage] = useState<'English' | 'Indonesia' | null>(() => {
    const saved = sessionStorage.getItem("orcas_chat_lang");
    return saved ? (saved as 'English' | 'Indonesia') : null;
  });
  const [chatMessages, setChatMessages] = useState<{role: 'bot' | 'user', content: string}[]>(() => {
    const saved = sessionStorage.getItem("orcas_chat_msgs");
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });
  
  useEffect(() => {
    if (chatLanguage) sessionStorage.setItem("orcas_chat_lang", chatLanguage);
    else sessionStorage.removeItem("orcas_chat_lang");
  }, [chatLanguage]);
  
  useEffect(() => {
    sessionStorage.setItem("orcas_chat_msgs", JSON.stringify(chatMessages));
  }, [chatMessages]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Orcas is thinking...");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
    }
  }, [chatMessages, isChatOpen]);

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const clearChat = () => {
    if (!chatLanguage) {
      setIsChatOpen(false);
      return;
    }
    setShowCloseConfirm(true);
  };
  
  const confirmClearChat = () => {
    setChatLanguage(null);
    setChatMessages([]);
    setShowCloseConfirm(false);
    setIsChatOpen(false);
  };
  
  const cancelClearChat = () => {
    setShowCloseConfirm(false);
  };

  const handleSelectLanguage = (lang: 'English' | 'Indonesia') => {
    setChatLanguage(lang);
    const greeting = lang === 'English' 
      ? `Hello, ${user?.username || 'user'}! What would you like to learn about finance today?`
      : `Halo, ${user?.username || 'user'}! Mau belajar apa tentang finansial hari ini?`;
    setChatMessages([{ role: 'bot', content: greeting }]);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);
    setLoadingText("Orcas is thinking...");
    const timer = setTimeout(() => setLoadingText("Orcas is typing..."), 2000);

    try {
      const res = await fetch(`${BASE_URL}/api/ai/ask-glossary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: userMsg, 
          history: chatMessages.slice(1).map(m => m.content),
          language: chatLanguage || 'English'
        })
      });
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'bot', content: data.answer }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'bot', content: chatLanguage === 'English' ? 'Sorry, there was an error connecting to the server.' : 'Maaf, terjadi kesalahan saat menghubungi server.' }]);
    } finally {
      clearTimeout(timer);
      setIsChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex justify-end mb-4">
        <select 
          value={glossaryLang}
          onChange={(e) => setGlossaryLang(e.target.value as "Indonesian" | "English")}
          className="border border-[rgb(var(--color-primary))]/50 rounded-lg px-4 py-2 bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] font-medium focus:outline-none"
        >
          <option value="Indonesian">Indonesian</option>
          <option value="English">English</option>
        </select>
      </div>
      <style>{`
        @keyframes walk-across {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-farm-walk {
          display: flex;
          width: max-content;
          animation: walk-across 60s linear infinite;
        }
      `}</style>
      <div className="flex flex-col gap-2">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Type a term and press Enter to save to history..." 
            className="w-full p-3 pr-12 border border-[rgb(var(--color-primary))]/50 rounded-full bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))]"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {inputValue.trim().length > 0 && (
            <button 
              onClick={clearInput}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-bold"
              aria-label="Clear Search"
            >
              ✕
            </button>
          )}
        </div>
        
        {/* Search History */}
        {history.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-[rgb(var(--color-text-subtle))] mr-1">History:</span>
            {history.map((h, i) => (
              <div key={i} className="flex items-center bg-[rgb(var(--color-surface-hover))] border border-[rgb(var(--color-primary))]/50 rounded-full px-3 py-1 text-xs text-[rgb(var(--color-text))] shadow-sm">
                <span className="cursor-pointer hover:underline" onClick={() => setInputValue(h.term)}>{h.term}</span>
                <button onClick={() => removeHistoryItem(h.term)} className="ml-2 text-gray-500 hover:text-red-500 font-bold">✕</button>
              </div>
            ))}
            <button onClick={clearAllHistory} className="text-xs text-red-500 hover:underline ml-2 font-medium">Clear All</button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {dictionary.map((section, idx) => {
          const filteredItems = section.items.filter(item => 
            item.term.toLowerCase().includes(inputValue.toLowerCase()) || 
            item.definition.toLowerCase().includes(inputValue.toLowerCase())
          );

          if (filteredItems.length === 0) return null;

          return (
            <Card key={idx} className="p-4 rounded-2xl">
              <h3 className="text-lg font-bold text-[rgb(var(--color-primary))] mb-1">{section.category}</h3>
              {section.description && (
                <p className="text-sm text-[rgb(var(--color-text-subtle))] mb-4">{section.description}</p>
              )}
              <div className="space-y-2">
                {filteredItems.map((item, itemIdx) => (
                  <details key={itemIdx} className="group border border-[rgb(var(--color-primary))]/50 rounded-2xl overflow-hidden" open={inputValue.length > 0 || openTerm === item.term}
                    onClick={(e) => {
                      if (inputValue.length === 0) {
                        e.preventDefault();
                        setOpenTerm(openTerm === item.term ? null : item.term);
                      }
                    }}
                  >
                    <summary className="cursor-pointer p-3 font-medium text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface-hover))] list-none flex justify-between items-center">
                      <span>{highlightText(item.term, inputValue)}</span>
                      
                    </summary>
                    <div className="p-3 border-t border-[rgb(var(--color-primary))]/50 text-sm text-orange-600 bg-[rgb(var(--color-surface))] leading-relaxed">
                      {highlightText(item.definition, inputValue)}
                    </div>
                  </details>
                ))}
              </div>
            </Card>
          );
        })}
        
        {dictionary.every(section => 
          section.items.filter(item => 
            item.term.toLowerCase().includes(inputValue.toLowerCase()) || 
            item.definition.toLowerCase().includes(inputValue.toLowerCase())
          ).length === 0
        ) && (
          <div className="text-center p-8 text-[rgb(var(--color-text-subtle))]">
            No terms found matching "{inputValue}"
          </div>
        )}
      </div>

      {/* Floating Chatbot */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isChatOpen ? (
          <div className="w-[600px] h-[700px] bg-white border border-[rgb(var(--color-primary))]/50 rounded-lg shadow-xl flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-5 max-w-[90vw] max-h-[85vh]">
            {/* Header / Kop */}
            <div className="bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-action))] text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-lg">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1"><img src="/orca-logo.png" alt="Orcas" className="w-full h-full object-contain" /></div>
                Learn with Orcas
              </div>
              <div className="flex items-center gap-3">
                <button onClick={toggleChat} className="p-1 text-white hover:text-gray-200 transition-colors" title="Minimize" aria-label="Minimize chat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <button onClick={clearChat} className="p-1 text-white/80 hover:text-red-200 transition-colors" title="Close and Delete History" aria-label="Close and Delete chat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-4 text-base relative">
              {showCloseConfirm && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                  <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </div>
                  <h4 className="text-gray-900 font-bold text-lg mb-2">
                    {chatLanguage === 'Indonesia' ? 'Tutup Sesi Obrolan?' : 'Close Chat Session?'}
                  </h4>
                  <p className="text-gray-600 text-sm mb-6">
                    {chatLanguage === 'Indonesia' 
                      ? 'Apakah Anda yakin ingin menutup sesi ini? Seluruh riwayat obrolan akan dihapus secara permanen.' 
                      : 'Are you sure you want to close this session? All chat history will be permanently deleted.'}
                  </p>
                  <div className="flex gap-3 w-full max-w-xs">
                    <button onClick={cancelClearChat} className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors">
                      {chatLanguage === 'Indonesia' ? 'Batal' : 'Cancel'}
                    </button>
                    <button onClick={confirmClearChat} className="flex-1 py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                      {chatLanguage === 'Indonesia' ? 'Hapus & Tutup' : 'Close & Delete'}
                    </button>
                  </div>
                </div>
              )}
              {!chatLanguage ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <p className="text-gray-600 font-medium">Preferred response language:</p>
                  <div className="flex gap-4">
                    <button onClick={() => handleSelectLanguage('English')} className="px-6 py-2 bg-yellow-500 text-white font-medium rounded hover:bg-yellow-600 shadow-sm">English</button>
                    <button onClick={() => handleSelectLanguage('Indonesia')} className="px-6 py-2 bg-orange-500 text-white font-medium rounded hover:bg-orange-600 shadow-sm">Indonesia</button>
                  </div>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl p-3 shadow-sm ${msg.role === 'user' ? 'bg-[#B8D0D1] text-gray-800 rounded-br-none' : 'bg-[#D1B7D1] text-gray-800 rounded-bl-none'}`}>
                        <div className="text-xs opacity-75 mb-1 font-semibold">
                          {msg.role === 'user' ? (user?.username || 'user') : 'Orcas'}
                        </div>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-[#D1B7D1] rounded-xl p-3 text-gray-600 italic shadow-sm rounded-bl-none">
                        {loadingText}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            {chatLanguage && (
              <div className="border-t border-[rgb(var(--color-primary))]/50 p-3 bg-white flex gap-3">
                <input 
                  type="text" 
                  className="flex-1 border border-[rgb(var(--color-primary))]/50 rounded-full px-4 py-3 text-base focus:outline-none focus:border-[rgb(var(--color-primary))] bg-white text-black"
                  placeholder={chatLanguage === 'English' ? "Ask about finance..." : "Tanyakan apapun..."}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                />
                <button 
                  onClick={handleSendChat}
                  disabled={isChatLoading || !chatInput.trim()}
                  className="bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-action))] text-white p-3 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center shadow-sm"
                  aria-label="Send message"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={toggleChat}
            className="flex items-center gap-3 bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-action))] text-white py-2 px-5 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 font-bold text-lg"
          >
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1"><img src="/orca-logo.png" alt="Orcas" className="w-full h-full object-contain" /></div>
            Learn with Orcas
          </button>
        )}
      </div>

    </div>
  );
}
