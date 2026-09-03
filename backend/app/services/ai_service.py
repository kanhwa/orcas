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

    if language.lower() == 'english':
        prompt = f"""
You are a fundamental analyst specializing in macro perspectives. DO NOT hallucinate under any circumstances.
Your task is to summarize the Scorecard into 1 dense narrative paragraph and 1 concluding paragraph.

ABSOLUTE RULES:
- DO NOT write a title at the beginning of the text (such as 'Financial Interpretation:', 'Scorecard Analysis:', etc.). Go straight into the paragraph.
- Use the term "section".
- Look for the metric with the highest/largest and lowest/worst "Contribution". IF there are multiple metrics with EXACTLY IDENTICAL contribution scores at the top or bottom, MENTION ALL OF THEM using the word "respectively". If there are no ties, mention just 1.
- You MUST translate the Indonesian metric names ("metric_name" in the JSON) into standard English (basic finance terminology).
- You MUST mention the exact "contribution" nominal numbers identical to the number strings shown in the JSON.
- Mention the total score (total_score) WITH EXACTLY 2 DECIMAL DIGITS. Use a period '.' for decimal separators.
- Percentage Rule (Coverage and Section): If the number has a .0 decimal (e.g. 100.0% or 41.0%), you MUST remove the decimal and round it (100% or 41%). If the decimal is not .0 (e.g. 97.4%), keep 1 decimal place. Use a period '.' for decimals.

CONCLUDING PARAGRAPH RULES:
Write 1 concluding sentence (starting with "In conclusion, ..."). You MUST DYNAMICALLY CHOOSE ONE of the 2 following conclusion styles based on your analyst instincts regarding the data conditions:
- Style A (Section Strength): Highlight and praise the dominance of a specific section (Income/Balance/Cashflow) that successfully became the absolute backbone supporting the company's score.
- Style B (Tug-of-War Effect): Highlight the "tug-of-war" effect where the performance of the hero metric contributing the highest score must battle against the burden of the metric contributing the worst score.

OUTPUT EXAMPLE THAT MUST BE IMITATED:
In the 2024 BBCA Scorecard evaluation, the company successfully achieved a total score of 0.59 (Rank 3) with an excellent data coverage rate of 97.4%. Structurally, the Income section became the main backbone with the highest contribution portion reaching 41%. Specifically, this fundamental foundation was mostly supported by the "Net Income for the Year" metric which provided the largest individual score contribution of 0.025604, while the "Operating Expenses" metric recorded the worst contribution of 0.000018 compared to all other metrics.

In conclusion, the dominance of the Income section and the robustness of the Net Income for the Year metric proved to be the main drivers of the company's positive score, although slightly held back by high Operating Expenses.

Scorecard Data:
{json.dumps(payload, indent=2)}
"""
    else:
        prompt = f"""
Anda adalah analis fundamental spesialis sudut pandang makro. DILARANG KERAS berhalusinasi.
Tugas Anda adalah merangkum Scorecard menjadi 1 paragraf naratif padat dan 1 paragraf kesimpulan.

ATURAN MUTLAK:
- JANGAN menuliskan judul di awal teks (seperti 'Financial Interpretation:', 'Scorecard Analysis:', dll). Langsung ke isi paragraf.
- Gunakan istilah "bagian" (bukan "seksi").
- Cari metrik dengan "Contribution" tertinggi/terbesar dan terendah/terburuk. JIKA ada beberapa metrik yang memiliki skor kontribusi KEMBAR IDENTIK di posisi puncak atau dasar, SEBUTKAN SEMUANYA dengan kata "masing-masing" (Contoh: "ditopang oleh metrik A dan B yang masing-masing memberikan sumbangsih sebesar..."). Jika tidak ada yang kembar, sebutkan 1 saja.
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

    if language.lower() == 'english':
        filter_label_en = "top" if filter_type == "top" else "bottom"
        prompt = f"""
You are a banking stock rating analyst. DO NOT hallucinate under any circumstances.

ABSOLUTE RULES:
- DO NOT write a title at the beginning of the text (such as 'Ranking Analysis:', 'Interpretation:', etc.). Go straight into the paragraph.
- The data you receive is already filtered ({filter_count} {filter_label_en} stocks).
- You MUST mention the filter type (e.g., "the list of the top 15 stocks" or "the list of the bottom 32 stocks") in the introductory sentence.
- If data <= 4 stocks: Mention ALL of them in order.
- If data > 4 stocks: ONLY mention these 4 entities in order: (1) First rank in data, (2) Second rank in data, (3) Middle rank, and (4) The very last rank in the data.
- You MUST mention the original Rank of each stock.
- WSM Score must be written WITH EXACTLY 2 DECIMAL DIGITS (e.g. 0.71). Use a period '.' for decimal separators.
- Write 1 Narrative Paragraph and 1 Concluding Paragraph.

CONCLUDING PARAGRAPH RULES:
Write 1 concluding sentence (starting with "In conclusion, ..."). You MUST DYNAMICALLY CHOOSE ONE of the 3 following conclusion styles based on data conditions:
- Style 1 (Gap/Distance): Highlight the fundamental gap/score difference between the top-ranked stock in the table and the bottom-ranked stock in the table.
- Style 2 (Dominance/Tightness): Highlight whether the first-ranked stock dominates by a very large point margin, OR if the competition is very tight.
- Style 3 (Historical Trend): SPECIFICALLY if the analysis period is multi-year (e.g., 2022-2024) and the json data has a "yearly_breakdown" property, highlight the trend of score growth consistency of the first-ranked stock from year to year.

OUTPUT EXAMPLE THAT MUST BE IMITATED:
In the Scoring evaluation for the {period} period, here is the list of the {filter_count} {filter_label_en} stocks. The first stock in this table is BBRI (Rank 1) with a score of 0.71, followed by BMRI (Rank 2) with a score of 0.71. In the middle position of the table is MEGA (Rank 11) with a score of 0.39, while the very last position in the table is closed by MAYA (Rank 17) with a score of 0.35.

In conclusion, the fundamental gap seen between the top-ranked stocks in the table and the bottom-ranked stocks in the table shows a significant performance disparity in this group.

Data:
{json.dumps(sliced_ranking, indent=2)}
"""
    else:
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

    if language.lower() == 'english':
        prompt = f"""
You are a table translator for the Metric Ranking feature. DO NOT hallucinate under any circumstances.

NUMBER & UNIT CONVERSION RULES:
- FOR 'IDR/share' units: You MUST change it to 'Rp [Number] per share' (example: 533.80 IDR/share becomes Rp 533.80 per share). Use a period '.' for decimal separators.
- FOR 'IDR bn' units: You MUST change it to 'Rp [Number] Trillion'. If the number is in the thousands (e.g., 243802 IDR bn or 1033 IDR bn), remove the last three digits and round to Trillion (e.g., Rp 243 Trillion, or Rp 1 Trillion).
- IF the original value is 1205 IDR bn, just round it to Rp 1 Trillion.
- You MUST translate the Indonesian metric names into standard English (basic finance terminology).

PARAGRAPH 1 RULES (Narrative):
Write 1 Paragraph (max 2 sentences). Use language style like this:
"In the evaluation of the [Metric Name] metric for the [Year] period, here are the [Top N] [best/worst] banks out of a total of [Total Banks] banks evaluated. In the ending year of [End Year], [Ticker 1] ranked 1st with a value of [Value 1], followed by [Ticker 2] in 2nd Rank with [Value 2] and [Ticker 3] in 3rd Rank with [Value 3], while [Bottom Ticker] occupied the lowest position in this group with a value of [Bottom Value]."
*Note: Adjust rank (best/worst) and numbers according to the JSON (see rank_type, top_n, total_banks).*

PARAGRAPH 2 RULES (Conclusion):
Write 1 concluding sentence (starting with "In conclusion, ..."). CHOOSE ONE of the following 3 conclusion styles, whichever fits the data best:
- Style 1 (Gap): Highlight the distance/difference in value between Rank 1 and the bottom rank in the group.
- Style 2 (Dominance): Highlight if Rank 1 & 2 dominate very far from the rest of the banks (huge disparity).
- Style 3 (Trend): (Only if start_year and end_year are different) Highlight the growth trend/consistency of the winning bank from year to year.

JSON Data:
{json.dumps(data, indent=2)}
"""
    else:
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

    if language.lower() == 'english':
        prompt = f"""
You are a translation engine for the Stock Screening table. DO NOT hallucinate under any circumstances. 
You MUST COPY EXACTLY the language style and structure of the OUTPUT EXAMPLE below. DO NOT make up your own style!

NUMBER & UNIT CONVERSION RULES:
- FOR 'IDR/share' units: You MUST change it to 'Rp [Number] per share' (example: 533.80 IDR/share becomes Rp 533.80 per share). Use a period '.' for decimal separators.
- Translate "IDR bn" to "Rp [Number] Trillion". If the number is in the thousands (e.g., 243802 IDR bn), remove the last three digits and make it Trillion (e.g., Rp 243 Trillion).
- If the filter value is 120000 IDR bn, write it as Rp 120 Trillion. 
- Translate symbols (like >) into verbal words (example: "above").
- You MUST translate the Indonesian metric names into standard English (basic finance terminology).

OUTPUT EXAMPLE THAT YOU MUST COPY EXACTLY:
In the 2024 screening with the criteria of Beginning Cash and Cash Equivalents above Rp 120 Trillion, 4 out of 32 stocks successfully passed. BMRI took 1st Rank with a value of Rp 243 Trillion and was followed by BBRI in 2nd Rank with a value of Rp 218 Trillion, while BBNI took the middle position with Rp 154 Trillion and BBCA was at the very bottom rank with Rp 124 Trillion.

In conclusion, BMRI led this beginning cash criteria with a significant margin, almost twice as large as BBCA which only narrowly passed above the filter criteria limit.

(Note: If the number of passing stocks is NOT 4, adjust the mentioning but STILL use the language style above).

Current Screening Data:
{json.dumps(data, indent=2)}
"""
    else:
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

    if language.lower() == 'english':
        prompt = f"""
You are a financial analyst specializing in What-If Simulations. DO NOT hallucinate under any circumstances.
You MUST copy the style and format of the OUTPUT EXAMPLE below. DO NOT create outside of this structure.

MANDATORY RULES:
- DO NOT write a title at the beginning of the text (such as 'Analysis:', etc.). Go straight into the paragraph.
- SPECIFICALLY FOR WSM SCORE (baseline_score & simulated_score): Write the score using exactly 4 decimal digits (example: 0.5911 becomes 0.5935). DO NOT cut it to 2 digits. Use a period '.' for decimal separators.
- METRIC NUMBER FORMAT: 
  > If the unit is "IDR bn", round it to "Rp [Number] Trillion" (example: 35228.60 IDR bn becomes Rp 35 Trillion). Ignore the minus sign if any.
  > If the unit is "IDR/share", change the format to "Rp [Number] per share" and use a period '.' for decimals (example: 533.80 IDR/share becomes Rp 533.80 per share).
  > If the unit is %, keep the original number.
- METRIC MENTIONING: 
  > If total metrics changed <= 4: Mention ALL of them.
  > If total metrics changed > 4: ONLY mention the 2 metrics with the most extreme percentage changes (whether it went up the sharpest or dropped the sharpest).
  > You MUST translate the Indonesian metric names into standard English (basic finance terminology).
- Must mention the nature of the metric: (Benefit nature) or (Cost nature).
- Write 1 Top Paragraph (Narrative) and 1 Concluding Paragraph.

OUTPUT EXAMPLE THAT MUST BE IMITATED (e.g., if there are 2 metrics):
In the simulation of the BBCA stock (projection from year {data.get("baseline_year", "")} to {data.get("simulated_year", "")}), the overall score is projected to experience an increase from 0.5911 to 0.5935 (up 0.4%). This change is driven by an upside scenario on the EPS metric (Benefit nature) by +20% to Rp 533.80 per share, which battled against the swelling of the Operating Expenses metric (Cost nature) by +10% to minus Rp 35 Trillion.

In conclusion, although operating expenses experienced a swelling, the positive impact of the profitability surge (EPS) was still more dominant, successfully pulling BBCA's final score up to remain in the positive zone.

Simulation Data:
{json.dumps(data, indent=2)}
"""
    else:
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

    if language.lower() == 'english':
        prompt = f"""
You are a financial analyst specializing in stock comparisons. DO NOT hallucinate under any circumstances.
You MUST copy the style and format of the OUTPUT EXAMPLE below. DO NOT create outside of this structure.

MANDATORY RULES:
- DO NOT write a title at the beginning of the text (such as 'Analysis:', etc.). Go straight into the paragraph.
- WSM Score (Overall Score or Section Score) does not have a currency unit. Just display a rounded number with exactly 2 decimal digits (example: 0.71, 0.51). Use a period '.' for decimal separators.
- If there are 2 banks, compare both against the average score (Average). If there are >2 banks, mention the leading bank, the middle position bank, and the lagging bank.
- Write 1 Top Paragraph (Narrative) and 1 Concluding Paragraph.

OUTPUT EXAMPLE THAT MUST BE IMITATED (If 2 Banks):
In the comparison of Overall Score values for the 2023-2024 period, BBRI showed solid performance and consistently remained above average with a final score of 0.71. Conversely, BBNI continued to be pressured below the average limit and experienced a decline, hitting a final score of 0.51 in the last evaluation year.

In conclusion, BBRI demonstrated a far superior dominance in fundamental stability, in contrast to BBNI which lost its performance momentum for two consecutive years.

(Note: If the selected stocks are more than 2, adjust the mentioning by mentioning the "Middle Position", but still strictly use the 2 decimal digits limit and without units).

Compare Data:
{json.dumps(data, indent=2)}
"""
    else:
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

    if language.lower() == 'english':
        prompt = f"""
You are a historical analyst of metric movements. DO NOT hallucinate under any circumstances.
You MUST copy the style and format of the OUTPUT EXAMPLE below. DO NOT create outside of this structure.

MANDATORY RULES:
- DO NOT write a title at the beginning of the text (such as 'Analysis:', etc.). Go straight into the paragraph.
- You may only highlight a MAXIMUM of 2 METRICS ONLY (whether it's 1 most improved & 1 most deteriorated, or both most improved/deteriorated). Do not mention more than 2 metrics to keep the text concise.
- You must translate the Indonesian metric names into standard English (basic finance terminology).
- Must mention the Ticker name (e.g., BBCA), period (e.g., 2022-2024), and the extreme threshold filter number (e.g., 70%).
- FINANCIAL NUMBER FORMAT: Round to "Rp [Number] Trillion" without decimals (example: -38457 IDR bn or 2243 IDR bn are rounded and written as Rp 38 Trillion or Rp 2 Trillion). Ignore the minus sign if you use the word "minus" or "plunged".
- PERCENTAGE FORMAT: Leave percentages using their original % sign.

OUTPUT EXAMPLE THAT MUST BE IMITATED:
In the historical analysis of BBCA for the 2022-2024 period (with an extreme change filtering above 70%), there were metrics that experienced improvements and declines. The most positive improvement occurred in the Received Loans metric which surged 70% to Rp 2 Trillion, while the most severe decline was experienced by the Net Increase in Cash metric which plunged sharply by 117% to minus Rp 38 Trillion.

In conclusion, the improvement that occurred in BBCA's funding sector seemed to fail to offset the massive pressure that occurred in its investment cash flows and net cash over the past two years.

(Note: Adjust the sentence if both metrics improved or both deteriorated).

Historical Data:
{json.dumps(data, indent=2)}
"""
    else:
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

    if language.lower() == 'english':
        context = f"""
You are "Orcas", a financial education assistant for the ORCAS application.
Your task is ONLY to answer questions related to basic banking, finance, and accounting terms.
VERY STRICT RULES:
1. You MUST answer completely in English natively.
2. DO NOT use any emojis or emoticons.
3. DO NOT use bolding (such as **text**) or star Markdown. Use plain text only.
4. Answer warmly, briefly, and easily understood by laypeople.
5. DO NOT give stock investment advice.
6. NEVER start your answer with greetings (like "Hello", "Hi", "Greetings"). Just answer straight to the point.
"""
        messages = [{"role": "user", "parts": [{"text": context}]}]
        messages.append({"role": "model", "parts": [{"text": "Understood. I will answer purely in English with no emojis and no bold markdown."}]})
    else:
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
