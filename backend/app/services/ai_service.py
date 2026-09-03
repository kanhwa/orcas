import os
import json
import time
import itertools
from google import genai

ERROR_MSG_BUSY = "Sorry, Orcas is currently sleeping because the servers are busy. Please try again in a moment!"
ERROR_MSG_FAIL = "Sorry, Orcas failed to process the request. A system error occurred."

# --- API KEY LOAD BALANCER ---
# Load multiple API keys from GEMINI_API_KEYS (comma separated) or fallback to GEMINI_API_KEY
keys_str = os.getenv("GEMINI_API_KEYS") or os.getenv("GEMINI_API_KEY", "")
api_keys_list = [k.strip() for k in keys_str.split(",") if k.strip()]
if not api_keys_list:
    api_keys_list = [""]  # Placeholder if no keys found

# Create an infinite iterator that cycles through the available keys
api_key_cycle = itertools.cycle(api_keys_list)

def get_next_api_key():
    return next(api_key_cycle)
# -----------------------------

def handle_ai_retry(client_call, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client_call()
        except Exception as e:
            print(f"AI ERROR: {e}")
            if "503" in str(e) or "UNAVAILABLE" in str(e) or "429" in str(e) or "quota" in str(e).lower():
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
            return ERROR_MSG_BUSY
    return ERROR_MSG_BUSY

def get_client():
    api_key = get_next_api_key()
    if not api_key:
        raise ValueError("API Key Gemini tidak ditemukan.")
    return genai.Client(api_key=api_key)

def generate_scorecard_interpretation(payload: dict) -> str:
        
    scorecard_data = payload.get("scorecard", payload)
    language = payload.get("language", "Indonesian")
    
    # Slicing: Only Top 3 and Bottom 3 metrics
    metrics = scorecard_data.get("metrics", [])
    if metrics:
        metrics_sorted = sorted(metrics, key=lambda x: x.get("contribution", 0), reverse=True)
        top_3 = metrics_sorted[:3]
        bottom_3 = metrics_sorted[-3:] if len(metrics_sorted) > 3 else []
        def smart_format_contribution(val: float) -> str:
            if val == 0:
                return "0"
            is_neg = val < 0
            val_abs = abs(val)
            s = f"{val_abs:.15f}".rstrip('0')
            if "." not in s:
                return f"-{s}" if is_neg else s
            int_part, dec_part = s.split(".")
            if int(int_part) > 0:
                target_decimals = 2
            else:
                leading_zeros = 0
                for char in dec_part:
                    if char == '0':
                        leading_zeros += 1
                    else:
                        break
                target_decimals = leading_zeros + 2
            
            rounded_val = round(val_abs, target_decimals)
            formatted = f"{rounded_val:.{target_decimals}f}"
            return f"-{formatted}" if is_neg else formatted

        for m in top_3 + bottom_3:
            if "contribution" in m and isinstance(m["contribution"], (float, int)):
                m["contribution"] = smart_format_contribution(m["contribution"])
                
        scorecard_data["metrics"] = {"top_contributors": top_3, "bottom_contributors": bottom_3}

    prompt = f"""
Anda adalah analis fundamental spesialis sudut pandang makro. DILARANG KERAS berhalusinasi.
Tugas Anda adalah merangkum Scorecard menjadi 1 paragraf naratif padat dan 1 paragraf kesimpulan.

ATURAN MUTLAK:
- JANGAN menuliskan judul di awal teks (seperti 'Financial Interpretation:', 'Scorecard Analysis:', dll). Langsung ke isi paragraf.
- Gunakan istilah "bagian" (bukan "seksi").
- Sebutkan HANYA 2 metrik spesifik: (1) Metrik dengan "Contribution" tertinggi/terbesar (Sumbangsih positif terbesar). (2) Metrik dengan "Contribution" terendah/terburuk (Sumbangsih paling minim atau negatif).
- Nama metrik WAJIB IDENTIK 100% dengan "metric_name" yang ada di JSON. Jangan diterjemahkan.
- WAJIB menyebutkan angka nominal "contribution" secara persis/identik seperti string angka yang tertera di JSON.
- Sebutkan skor total (total_score) DENGAN 2 DIGIT DESIMAL saja. 
- Aturan Persentase (Coverage dan Bagian): Jika angkanya memiliki desimal .0 (misal 100.0% atau 41.0%), WAJIB buang desimalnya menjadi bulat (100% atau 41%). Jika desimalnya bukan .0 (misal 97.4%), biarkan 1 desimal.

ATURAN PARAGRAF KESIMPULAN:
Tulis 1 kalimat kesimpulan (dimulai dengan "Kesimpulannya, ..."). Anda WAJIB MEMILIH SALAH SATU dari 2 gaya kesimpulan berikut secara dinamis sesuai insting analis Anda terhadap kondisi data:
- Gaya A (Kekuatan Bagian): Menyoroti dan memuji dominasi bagian (Income/Balance/Cashflow) tertentu yang sukses menjadi tulang punggung mutlak penopang skor emiten tersebut.
- Gaya B (Efek Tarik-Tambang): Menyoroti efek "tarik-tambang" di mana performa metrik pahlawan penyumbang skor tertinggi harus beradu dengan beban dari metrik penyumbang skor terburuk.

CONTOH OUTPUT YANG HARUS DITIRU:
Pada evaluasi Scorecard BBCA tahun 2024, emiten sukses meraih skor total 0.59 (Peringkat 3) dengan tingkat coverage data yang sangat prima sebesar 97.4%. Secara struktur, bagian Income menjadi tulang punggung utama dengan porsi kontribusi tertinggi mencapai 41%. Secara spesifik, fondasi fundamental ini paling banyak ditopang oleh metrik "Laba Bersih Tahun Berjalan" yang memberikan sumbangsih skor individu terbesar yaitu 0.025604, sedangkan metrik "Beban Usaha" tercatat memberikan sumbangsih terburuk sebesar 0.000018 dibandingkan keseluruhan metrik lainnya.

Kesimpulannya, dominasi bagian Income dan kokohnya metrik Laba Bersih Tahun Berjalan terbukti menjadi pendorong utama skor positif emiten ini, meskipun tertahan sedikit oleh tingginya Beban Usaha.

Output harus dalam bahasa {language}.

Data Scorecard:
{json.dumps(payload, indent=2)}
"""
    
    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_ranking_interpretation(ranking_data: list, period: str, filter_type: str = "top", filter_count: int = 10, language: str = "Indonesian") -> str:

    
    n = len(ranking_data)
    if n > 4:
        sliced_ranking = [ranking_data[0], ranking_data[1], ranking_data[n//2], ranking_data[-1]]
    else:
        sliced_ranking = ranking_data
        
    filter_label = "terbaik" if filter_type == "top" else "terburuk"

    prompt = f"""
Anda adalah analis pemeringkat emiten perbankan. DILARANG KERAS berhalusinasi.

ATURAN MUTLAK:
- JANGAN menuliskan judul di awal teks (seperti 'Ranking Analysis:', 'Interpretasi:', dll). Langsung ke isi paragraf.
- Data yang Anda terima adalah data yang sudah disaring ({filter_count} emiten {filter_label}).
- WAJIB menyebutkan jenis saringan (misal: "daftar 15 emiten terbaik" atau "daftar 32 emiten terburuk") pada kalimat pengantar.
- Jika data <= 4 emiten: Sebutkan SEMUANYA berurutan.
- Jika data > 4 emiten: HANYA sebutkan 4 entitas ini secara berurutan: (1) Urutan pertama di data, (2) Urutan kedua di data, (3) Urutan di posisi tengah, dan (4) Urutan paling terakhir di data.
- WAJIB menyebutkan Peringkat asli (rank) dari masing-masing emiten.
- Skor WSM ditulis HANYA DENGAN 2 DIGIT DESIMAL (misal 0.71).
- Tulis 1 Paragraf Naratif dan 1 Paragraf Kesimpulan.

ATURAN PARAGRAF KESIMPULAN:
Tulis 1 kalimat kesimpulan (dimulai dengan "Kesimpulannya, ..."). Anda WAJIB MEMILIH SALAH SATU dari 3 gaya kesimpulan berikut secara dinamis sesuai kondisi data:
- Gaya 1 (Selisih/Jarak): Menyoroti jarak fundamental/selisih nilai antara emiten urutan teratas di tabel dan emiten urutan terbawah di tabel.
- Gaya 2 (Dominasi/Keketatan): Menyoroti apakah emiten urutan pertama mendominasi dengan jarak poin sangat jauh, ATAU justru persaingannya sangat ketat.
- Gaya 3 (Tren Historis): KHUSUS jika periode analisis adalah multi-tahun (contoh: 2022-2024) dan data json memiliki properti "yearly_breakdown", soroti tren konsistensi pertumbuhan skor dari emiten yang berada di urutan pertama dari tahun ke tahun.

CONTOH OUTPUT YANG HARUS DITIRU:
Pada evaluasi Scoring periode {period}, berikut adalah daftar {filter_count} emiten {filter_label}. Emiten pertama di tabel ini adalah BBRI (Peringkat 1) dengan skor 0.71, disusul BMRI (Peringkat 2) dengan skor 0.71. Pada posisi menengah tabel, terdapat MEGA (Peringkat 11) dengan skor 0.39, sementara urutan paling terakhir di tabel ditutup oleh MAYA (Peringkat 17) dengan skor 0.35.

Kesimpulannya, jarak fundamental yang terlihat antara emiten di urutan teratas tabel dan emiten di urutan terbawah tabel menunjukkan disparitas performa yang signifikan pada kelompok ini.

Output harus dalam bahasa {language}.

Data:
{json.dumps(sliced_ranking, indent=2)}
"""
    
    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_metric_ranking_interpretation(data: dict, language: str = "English") -> str:

    prompt = f"""
Anda adalah penerjemah tabel untuk fitur Metric Ranking. DILARANG KERAS berhalusinasi.

ATURAN KONVERSI ANGKA & UNIT:
- KHUSUS unit 'IDR/share': Anda WAJIB mengubahnya menjadi 'Rp [Angka] per lembar' (contoh: 533.80 IDR/share menjadi Rp 533,80 per lembar).
- Anda WAJIB membulatkan angka ke "Triliun". Jika angkanya ribuan (contoh: 243802 IDR bn atau 1033 IDR bn), buang tiga angka di belakang dan bulatkan menjadi Triliun (contoh: Rp 243 Triliun, atau Rp 1 Triliun).
- BILA nilai asli adalah 1205 IDR bn, bulatkan saja menjadi Rp 1 Triliun.

ATURAN PARAGRAF 1 (Naratif):
Tulis 1 Paragraf (maks 2 kalimat). Gunakan gaya bahasa seperti ini:
"Pada evaluasi metrik [Nama Metrik] periode [Tahun], berikut adalah [Top N] bank [terbaik/terburuk] dari total [Total Banks] bank yang dievaluasi. Pada tahun akhir [Tahun Akhir], [Ticker 1] menempati Peringkat 1 dengan nilai [Nilai 1], disusul [Ticker 2] di Peringkat 2 dengan [Nilai 2] dan [Ticker 3] di Peringkat 3 dengan [Nilai 3], sementara [Ticker Terbawah] menempati posisi terbawah dalam kelompok ini dengan nilai [Nilai Terbawah]."
*Catatan: Sesuaikan rank (terbaik/terburuk) dan angka sesuai JSON (lihat rank_type, top_n, total_banks).*

ATURAN PARAGRAF 2 (Kesimpulan):
Tulis 1 kalimat kesimpulan (dimulai dengan "Kesimpulannya, ..."). PILIH SALAH SATU dari 3 gaya kesimpulan berikut, mana yang paling cocok dengan data:
- Gaya 1 (Selisih): Menyoroti jarak/selisih nilai antara Peringkat 1 dan Peringkat terbawah di kelompok tersebut.
- Gaya 2 (Dominasi): Menyoroti jika Peringkat 1 & 2 mendominasi sangat jauh dari sisa bank lainnya (ketimpangan besar).
- Gaya 3 (Tren): (Khusus jika start_year dan end_year berbeda) Menyoroti tren pertumbuhan/konsistensi bank juara dari tahun ke tahun.

Output harus dalam bahasa {language}.

Data JSON:
{json.dumps(data, indent=2)}
"""
    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_screening_interpretation(data: dict, language: str = "English") -> str:

    passing_banks = data.get("passing_banks", [])
    n = len(passing_banks)
    if n > 4:
        sliced = [passing_banks[0], passing_banks[1], passing_banks[n//2], passing_banks[-1]]
        data["passing_banks"] = sliced

    prompt = f"""
Anda adalah mesin penerjemah tabel Stock Screening. DILARANG KERAS berhalusinasi. 
Anda WAJIB MENIRU PERSIS gaya bahasa dan struktur dari CONTOH OUTPUT di bawah ini. JANGAN berkreasi sendiri!

ATURAN KONVERSI ANGKA & UNIT:
- KHUSUS unit 'IDR/share': Anda WAJIB mengubahnya menjadi 'Rp [Angka] per lembar' (contoh: 533.80 IDR/share menjadi Rp 533,80 per lembar).
- Terjemahkan "IDR bn" menjadi "Triliun". Jika angkanya ribuan (contoh: 243802 IDR bn), hilangkan tiga angka di belakang dan jadikan Triliun (contoh: Rp 243 Triliun).
- Jika nilai filter adalah 120000 IDR bn, tulis menjadi Rp 120 Triliun. 
- Terjemahkan simbol (seperti >) menjadi kata verbal (contoh: "di atas").

CONTOH OUTPUT YANG HARUS ANDA TIRU PERSIS:
Pada penyaringan tahun 2024 dengan kriteria Kas Dan Setara Kas Awal Periode di atas Rp 120 Triliun, terdapat 4 dari 32 emiten yang berhasil lolos. BMRI menempati Peringkat 1 dengan nilai Rp 243 Triliun dan disusul BBRI di Peringkat 2 dengan nilai Rp 218 Triliun, sementara BBNI menempati posisi menengah Rp 154 Triliun dan BBCA berada di peringkat paling bawah Rp 124 Triliun.

Kesimpulannya, BMRI memimpin kriteria kas awal periode ini dengan jarak yang signifikan, hampir dua kali lipat lebih besar dibandingkan BBCA yang hanya lolos tipis di atas batas kriteria filter.

(Catatan: Jika jumlah emiten yang lolos BUKAN 4, sesuaikan penyebutannya namun TETAP gunakan gaya bahasa di atas).

Data Screening Saat Ini:
{json.dumps(data, indent=2)}
"""

    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_simulation_interpretation(data: dict, language: str = "English") -> str:

    prompt = f"""
Anda adalah analis finansial spesialis What-If Simulation. DILARANG KERAS berhalusinasi.
Anda WAJIB meniru gaya dan format CONTOH OUTPUT di bawah ini. JANGAN berkreasi di luar struktur ini.

ATURAN WAJIB:
- JANGAN menuliskan judul di awal teks (seperti 'Analysis:', dll). Langsung ke isi paragraf.
- KHUSUS UNTUK SKOR WSM (baseline_score & simulated_score): Tulis skor menggunakan 4 digit desimal (contoh: 0.5911 menjadi 0.5935). JANGAN dipotong jadi 2 digit.
- FORMAT ANGKA METRIK: 
  > Jika unitnya "IDR bn", bulatkan ke "Triliun" tanpa koma (contoh: 35228.60 IDR bn menjadi Rp 35 Triliun). Abaikan tanda minus jika ada.
  > Jika unitnya "IDR/share", ubah formatnya menjadi "Rp [Angka] per lembar" dan gunakan koma sebagai desimal (contoh: 533.80 IDR/share menjadi Rp 533,80 per lembar).
  > Jika unitnya %, biarkan angka aslinya.
- PENYEBUTAN METRIK: 
  > Jika total metrik yang diubah <= 4: Sebutkan SEMUANYA.
  > Jika total metrik yang diubah > 4: HANYA sebutkan 2 metrik dengan persentase perubahan yang paling ekstrem (entah itu naik paling tajam atau turun paling tajam).
- Wajib sebutkan sifat metrik tersebut: (bersifat Benefit) atau (bersifat Cost).
- Tulis 1 Paragraf atas (Naratif) dan 1 Paragraf Kesimpulan.

CONTOH OUTPUT YANG HARUS DITIRU (Misal ada 2 metrik):
Pada simulasi emiten BBCA (proyeksi tahun {data.get("baseline_year", "")} ke {data.get("simulated_year", "")}), skor keseluruhan diproyeksikan mengalami kenaikan dari 0.5911 menjadi 0.5935 (naik 0.4%). Perubahan ini didorong oleh skenario kenaikan pada metrik EPS (bersifat Benefit) sebesar +20% menjadi Rp 533,80 per lembar, yang beradu dengan pembengkakan pada metrik Beban Usaha (bersifat Cost) sebesar +10% menjadi minus Rp 35 Triliun.

Kesimpulannya, meskipun beban usaha mengalami pembengkakan, dampak positif dari lonjakan profitabilitas (EPS) masih lebih dominan sehingga mampu menarik skor akhir BBCA tetap naik di zona positif.

Output harus dalam bahasa {language}.

Data Simulasi:
{json.dumps(data, indent=2)}
"""

    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_compare_interpretation(data: dict, language: str = "English") -> str:

    # Slicing: Only keep start score, end score, and average for each bank
    series = data.get("series", [])
    optimized_series = []
    for s in series:
        scores = [v for v in s.get("scores", []) if v is not None]
        if scores:
            optimized_series.append({
                "ticker": s["ticker"],
                "start_score": scores[0],
                "end_score": scores[-1],
                "avg_score": sum(scores) / len(scores)
            })
    data["series"] = optimized_series

    prompt = f"""
Anda adalah analis finansial spesialis pembanding emiten. DILARANG KERAS berhalusinasi.
Anda WAJIB meniru gaya dan format CONTOH OUTPUT di bawah ini. JANGAN berkreasi di luar struktur ini.

ATURAN WAJIB:
- JANGAN menuliskan judul di awal teks (seperti 'Analysis:', dll). Langsung ke isi paragraf.
- Skor WSM (Overall Score atau Section Score) tidak memiliki satuan uang. Cukup tampilkan angka bulat dengan 2 digit di belakang koma (contoh: 0.71, 0.51). 
- Jika ada 2 bank, bandingkan keduanya terhadap skor rata-rata (Average). Jika ada >2 bank, sebutkan bank pemimpin, bank posisi menengah, dan bank tertinggal.
- Tulis 1 Paragraf atas (Naratif) dan 1 Paragraf Kesimpulan.

CONTOH OUTPUT YANG HARUS DITIRU (Jika 2 Bank):
Pada perbandingan nilai Overall Score periode 2023-2024, BBRI menunjukkan performa yang solid dan konsisten berada di atas rata-rata dengan skor akhir 0.71. Sebaliknya, BBNI terus tertekan di bawah batas rata-rata dan mengalami penurunan hingga menyentuh skor akhir 0.51 pada tahun evaluasi terakhir.

Kesimpulannya, BBRI menunjukkan dominasi stabilitas fundamental yang jauh lebih superior, berlawanan dengan BBNI yang kehilangan momentum performa selama dua tahun berturut-turut.

(Catatan: Jika emiten yang dipilih lebih dari 2, sesuaikan penyebutannya dengan menyebutkan "Posisi Menengah", namun tetap gunakan batasan 2 digit desimal dan tanpa satuan).

Output harus dalam bahasa {language}.

Data Compare:
{json.dumps(data, indent=2)}
"""

    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_historical_interpretation(data: dict, language: str = "English") -> str:

    # Slicing: Top 3 positive and Top 3 negative changes
    changes = data.get("significant_changes", [])
    if changes:
        changes_sorted = sorted(changes, key=lambda x: x.get("growth_pct", 0), reverse=True)
        top_3 = changes_sorted[:3]
        bottom_3 = changes_sorted[-3:] if len(changes_sorted) > 3 else []
        data["significant_changes"] = {"top_improving": top_3, "top_declining": bottom_3}

    prompt = f"""
Anda adalah analis historis pergerakan metrik. DILARANG KERAS berhalusinasi.
Anda WAJIB meniru gaya dan format CONTOH OUTPUT di bawah ini. JANGAN berkreasi di luar struktur ini.

ATURAN WAJIB:
- JANGAN menuliskan judul di awal teks (seperti 'Analysis:', dll). Langsung ke isi paragraf.
- Anda hanya boleh menyoroti MAKSIMAL 2 METRIK SAJA (entah itu 1 paling membaik & 1 paling memburuk, atau 2-duanya paling membaik/memburuk). Jangan sebut lebih dari 2 metrik agar teks tetap singkat.
- Wajib sebutkan nama Ticker (contoh: BBCA), periode (contoh: 2022-2024), dan angka filter ambang batas (contoh: 70%).
- FORMAT ANGKA KEUANGAN: Bulatkan ke "Triliun" tanpa koma (contoh: -38457 IDR bn atau 2243 IDR bn dibulatkan dan ditulis menjadi Rp 38 Triliun atau Rp 2 Triliun). Abaikan tanda minus jika Anda menggunakan kata "minus" atau "anjlok".
- FORMAT PERSENTASE: Biarkan persentase tetap menggunakan tanda % aslinya.

CONTOH OUTPUT YANG HARUS DITIRU:
Pada analisis historis BBCA periode 2022-2024 (dengan penyaringan perubahan ekstrem di atas 70%), tercatat ada metrik yang mengalami perbaikan dan penurunan. Perbaikan paling positif terjadi pada metrik Pinjaman yang Diterima yang melonjak 70% menjadi Rp 2 Triliun, sementara penurunan paling parah dialami metrik Kenaikan Bersih Kas yang anjlok tajam 117% menjadi minus Rp 38 Triliun.

Kesimpulannya, perbaikan yang terjadi di sektor pendanaan BBCA tampaknya gagal mengimbangi tekanan masif yang terjadi pada arus kas investasi dan kas bersihnya selama dua tahun terakhir.

(Catatan: Sesuaikan kalimat jika kedua metrik sama-sama membaik atau sama-sama memburuk).

Output harus dalam bahasa {language}.

Data Historical:
{json.dumps(data, indent=2)}
"""

    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_glossary_chat(question: str, history: list, language: str = "English") -> str:

    context = f"""
Kamu adalah "Orcas", asisten edukasi finansial untuk aplikasi ORCAS.
Tugasmu HANYA menjawab pertanyaan seputar istilah perbankan, keuangan, dan akuntansi dasar.
ATURAN SANGAT KETAT:
1. Kamu HARUS menjawab sepenuhnya dalam bahasa {language}.
2. JANGAN menggunakan emoji atau emotikon apa pun.
3. JANGAN menggunakan cetak tebal (bolding seperti **teks**) atau Markdown bintang. Gunakan teks polos saja.
4. Jawablah dengan hangat, singkat, dan mudah dipahami awam.
5. JANGAN memberikan saran investasi saham.
6. JANGAN PERNAH mengawali jawabanmu dengan sapaan (seperti "Halo", "Hai", "Salam"). Langsung jawab intinya saja.
"""
    messages = [{"role": "user", "parts": [{"text": context}]}]
    messages.append({"role": "model", "parts": [{"text": f"Understood. I will answer purely in {language} with no emojis and no bold markdown."}]})
    for i, msg in enumerate(history):
        role = "user" if i % 2 == 0 else "model"
        messages.append({"role": role, "parts": [{"text": msg}]})
    messages.append({"role": "user", "parts": [{"text": question}]})
    
    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=messages)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)
