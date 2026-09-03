import re

with open("frontend/src/pages/BasicFinance.tsx", "r") as f:
    content = f.read()

dict_id = """
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
        { term: "Perputaran Aset (Asset Turnover)", definition: "Rasio yang mengukur seberapa efisien bank menggunakan asetnya untuk menghasilkan pendapatan operasional." },
        { term: "Price to Book Value (PBV)", definition: "Rasio penilaian pasar yang membandingkan harga saham bank dengan nilai buku akuntansinya." },
        { term: "Book Value Per Share (BVPS)", definition: "Nilai matematis dari satu saham jika bank melikuidasi semua aset dan membayar semua utangnya." },
        { term: "Tangible Book Value Per Share", definition: "Nilai buku per saham setelah mengurangi aset tak berwujud, menunjukkan nilai aset berwujud." }
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
        { term: "Return on Assets (ROA)", definition: "Rasio profitabilitas yang menunjukkan seberapa banyak laba yang dihasilkan dari setiap rupiah aset yang dimiliki." },
        { term: "Return on Equity (ROE)", definition: "Rasio profitabilitas yang menunjukkan seberapa efisien bank menggunakan uang pemegang saham untuk mencetak laba." },
        { term: "Net Profit Margin (NPM)", definition: "Persentase sisa pendapatan yang menjadi laba bersih setelah semua biaya operasional dibayar." },
        { term: "Gross Profit Margin (GPM)", definition: "Persentase pendapatan kotor yang tersisa setelah mengurangi beban operasional langsung." },
        { term: "Rasio Beban Operasional terhadap Pendapatan Operasional (BOPO)", definition: "Rasio krusial yang mengukur seberapa efisien pengeluaran bank dibandingkan dengan pendapatannya." },
        { term: "Cost to Income Ratio (CIR)", definition: "Serupa dengan BOPO, rasio ini mengukur efisiensi operasional dengan membandingkan biaya dengan pendapatan operasional inti." }
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
"""

dict_en = """
  const dictionary = glossaryLang === "Indonesian" ? dictionaryID : dictionaryEN;
"""

# Extract the existing dictionary as dictionaryEN
dict_match = re.search(r'(  const dictionary = \[\n.*?  \];)', content, re.DOTALL)
original_dict = dict_match.group(1)
dictionary_en_code = original_dict.replace("const dictionary = [", "const dictionaryEN = [")

# Replace dictionary in content
new_dict_code = dict_id + dictionary_en_code[22:] + "\n" + dict_en
content = content.replace(original_dict, new_dict_code)

# Add state for language
state_code = """  const [inputValue, setInputValue] = useState("");
  const [glossaryLang, setGlossaryLang] = useState<"Indonesian" | "English">("Indonesian");"""
content = content.replace('  const [inputValue, setInputValue] = useState("");', state_code)

# Add dropdown button
header_code = """        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-[rgb(var(--color-primary))] tracking-tight">Basic Finance</h1>
            <p className="text-[rgb(var(--color-text-subtle))] mt-2">Data dictionary and financial terms.</p>
          </div>
          <select 
            value={glossaryLang}
            onChange={(e) => setGlossaryLang(e.target.value as "Indonesian" | "English")}
            className="border border-[rgb(var(--color-primary))]/50 rounded-lg px-4 py-2 bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] font-medium focus:outline-none"
          >
            <option value="Indonesian">Indonesian</option>
            <option value="English">English</option>
          </select>
        </div>"""

# Replace the header div
content = re.sub(r'<div className="mb-8">.*?</div>', header_code, content, flags=re.DOTALL)

with open("frontend/src/pages/BasicFinance.tsx", "w") as f:
    f.write(content)
