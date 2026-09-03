with open("frontend/src/pages/BasicFinance.tsx", "r") as f:
    content = f.read()

start_idx = content.find('  const dictionaryID = [')
end_idx = content.find('  const dictionaryEN = [')

if start_idx != -1 and end_idx != -1:
    new_dict = """  const dictionaryID = [
    {
      category: "Keuangan Umum",
      items: [
        { term: "Bank", definition: "Lembaga keuangan yang memiliki lisensi untuk menerima simpanan, memberikan pinjaman, dan bertindak sebagai perantara dalam perekonomian." },
        { term: "Kode Saham", definition: "Singkatan unik yang mengidentifikasi saham perusahaan terbuka di bursa efek." }
      ]
    },
    {
      category: "Neraca Keuangan",
      description: "Laporan keuangan yang menunjukkan aset, kewajiban, dan ekuitas bank pada titik waktu tertentu.",
      items: [
        { term: "Total Aset", definition: "Total nilai dari semua yang dimiliki bank, termasuk uang tunai, pinjaman yang diberikan, dan properti fisik." },
        { term: "Total Liabilitas", definition: "Total jumlah yang dihutang bank kepada pihak lain, utamanya simpanan nasabah dan dana pinjaman." },
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
      category: "Laporan Laba Rugi",
      description: "Laporan keuangan yang menunjukkan pendapatan dan pengeluaran bank, yang menghasilkan laba atau rugi selama suatu periode.",
      items: [
        { term: "Total Pendapatan", definition: "Semua manfaat ekonomi masuk yang dihasilkan dari bunga, biaya, dan operasi perbankan lainnya." },
        { term: "Laba Bersih", definition: "Keuntungan akhir yang tersisa setelah semua biaya operasional, pajak, dan provisi dikurangi." },
        { term: "Beban Operasional", definition: "Biaya harian untuk menjalankan bank, seperti gaji pegawai, sewa, dan biaya administrasi." },
        { term: "Laba Sebelum Pajak", definition: "Keuntungan murni bisnis yang dihasilkan oleh bank sebelum pajak pemerintah dikenakan." },
        { term: "Beban Pajak Penghasilan", definition: "Kewajiban finansial wajib yang dibayarkan kepada pemerintah berdasarkan keuntungan bank." },
        { term: "Laba Operasional", definition: "Keuntungan yang dihasilkan secara spesifik dari aktivitas operasional inti bank sebelum faktor luar." },
        { term: "Laba Kotor", definition: "Keuntungan yang tersisa setelah mengurangi biaya langsung layanan, sebelum biaya operasional umum." },
        { term: "Harga Pokok Penjualan", definition: "Biaya langsung yang terkait dengan menghasilkan pendapatan; biaya yang lebih tinggi mengikis laba kotor." },
        { term: "Pendapatan / Beban Lainnya", definition: "Hasil keuangan bersih dari aktivitas perbankan non-inti atau kejadian luar biasa." },
        { term: "Laba Komprehensif", definition: "Laba bersih ditambah keuntungan atau kerugian belum direalisasi lainnya, menunjukkan total perubahan ekuitas." },
        { term: "Saham Beredar", definition: "Total jumlah saham perusahaan yang saat ini dipegang oleh semua investor di pasar." },
        { term: "Laba per Saham (EPS)", definition: "Porsi laba bank yang dialokasikan untuk setiap lembar saham yang beredar." },
        { term: "Rasio Harga terhadap Laba (PER)", definition: "Rasio pasar yang mengukur harga saham relatif terhadap laba yang dihasilkannya." },
        { term: "Rasio Harga terhadap Penjualan (P/S)", definition: "Rasio valuasi yang membandingkan harga saham bank dengan total pendapatan yang dihasilkannya." },
        { term: "Tingkat Pengembalian Aset (ROA)", definition: "Rasio efisiensi yang menunjukkan seberapa baik bank menggunakan total asetnya untuk menghasilkan laba." },
        { term: "Tingkat Pengembalian Ekuitas (ROE)", definition: "Rasio efisiensi yang menunjukkan seberapa efektif bank menghasilkan laba menggunakan ekuitas pemegang saham." }
      ]
    },
    {
      category: "Laporan Arus Kas",
      description: "Laporan keuangan yang melacak uang tunai aktual yang masuk dan keluar dari bank, memastikan likuiditas jangka pendek.",
      items: [
        { term: "Arus Kas Operasional", definition: "Uang tunai aktual yang dihasilkan dari aktivitas bisnis inti bank, seperti bunga yang diterima." },
        { term: "Arus Kas Investasi", definition: "Kas bersih yang digunakan atau dihasilkan dari pembelian atau penjualan aset dan investasi jangka panjang." },
        { term: "Arus Kas Pendanaan", definition: "Pergerakan kas yang terkait dengan peminjaman, pembayaran utang, atau pembagian dividen kepada pemegang saham." },
        { term: "Arus Kas Bebas", definition: "Kas yang tersisa setelah bank membayar biaya operasional dan pengeluaran modalnya." },
        { term: "Arus Kas Bebas per Saham", definition: "Jumlah arus kas bebas yang dialokasikan untuk setiap lembar saham beredar." },
        { term: "Pengeluaran Modal", definition: "Uang yang dihabiskan oleh bank untuk membeli, memelihara, atau meningkatkan aset fisik jangka panjangnya." },
        { term: "Perubahan Bersih Kas", definition: "Total selisih antara kas yang masuk dan keluar dari bank selama tahun keuangan." },
        { term: "Saldo Kas Awal", definition: "Total jumlah kas likuid yang dipegang bank pada awal tahun keuangan." },
        { term: "Saldo Kas Akhir", definition: "Total jumlah kas likuid akhir yang dipegang bank pada akhir tahun keuangan." }
      ]
    }
  ];
"""
    content = content[:start_idx] + new_dict + "\n" + content[end_idx:]
    with open("frontend/src/pages/BasicFinance.tsx", "w") as f:
        f.write(content)
