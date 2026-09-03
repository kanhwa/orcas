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
        scorecard_data["metrics"] = {"top_contributors": top_3, "bottom_contributors": bottom_3}

    prompt = f"""
ATURAN MUTLAK (STRICT RULES):
1. Anda adalah penerjemah tabel. DILARANG KERAS berhalusinasi, berasumsi, atau menggunakan istilah yang tidak ada di dalam JSON.
2. Tulis 1 Paragraf (maksimal 3 kalimat) menggunakan prinsip 5W1H. Jelaskan bank mana yang di posisi Top, Median, dan Bottom (TIDAK BOLEH pakai format list/poin).
3. Tulis 1 kalimat kesimpulan yang murni ditarik dari perbandingan angka di tabel, BUKAN fenomena umum.
4. JANGAN gunakan kata ganti (ini, itu, tersebut). Sebut nama Ticker (contoh: BBCA) dan nama metrik secara spesifik.

Data Scorecard:
{json.dumps(scorecard_data, indent=2)}
"""
    
    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_ranking_interpretation(ranking_data: list, period: str, language: str = "Indonesian") -> str:

    prompt = f"""
ATURAN MUTLAK (STRICT RULES):
1. Anda adalah penerjemah tabel untuk Peringkat Bank (Ranking). DILARANG KERAS berhalusinasi.
2. Tulis 1 Paragraf (maksimal 2 kalimat) merangkum hasil pemeringkatan periode {period}.
3. Aturan Penyebutan Emiten (TIDAK BOLEH pakai format list/poin):
   - Sebutkan Peringkat 1, Peringkat 2, posisi menengah (Median), dan posisi paling bawah (Bottom).
4. Tulis 1 kalimat kesimpulan di paragraf baru (dimulai dengan "Kesimpulannya, ...") murni merangkum performa pemenang utama dibandingkan yang terbawah.
5. FORMAT ANGKA: WAJIB memformat skor dengan titik desimal yang benar. Skor WSM tidak memiliki unit uang (contoh: Skor 85.4).
6. JANGAN gunakan kata ganti (ini, itu, tersebut). Sebut nama Ticker secara spesifik.
7. Output harus dalam bahasa {language}.

Data:
{json.dumps(ranking_data, indent=2)}
"""
    
    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_metric_ranking_interpretation(data: dict, language: str = "English") -> str:

    # Slicing: List 4 (Top 2, Mid 1, Last 1) or List 3 (Top 1, Mid 1, Last 1)
    ranking = data.get("ranking", [])
    n = len(ranking)
    if n > 4:
        sliced_ranking = [ranking[0], ranking[1], ranking[n//2], ranking[-1]]
        data["ranking"] = sliced_ranking
    elif n == 4:
        data["ranking"] = [ranking[0], ranking[1], ranking[2], ranking[3]]
    elif n == 3:
        data["ranking"] = [ranking[0], ranking[1], ranking[2]]

    prompt = f"""
ATURAN MUTLAK (STRICT RULES):
1. Anda adalah penerjemah tabel untuk Peringkat Metrik. DILARANG KERAS berhalusinasi.
2. Tulis 1 Paragraf (maksimal 2 kalimat). 
3. Aturan Penyebutan Emiten (TIDAK BOLEH pakai format list/poin):
   - Jika data >= 4 emiten: Sebutkan Peringkat 1, Peringkat 2, posisi menengah (Median), dan posisi paling bawah (Bottom).
   - Jika data < 4 emiten: Sebutkan Peringkat 1, posisi menengah, dan posisi paling bawah.
4. Tulis 1 kalimat kesimpulan di paragraf baru (dimulai dengan "Kesimpulannya, ...") murni merangkum ketimpangan atau selisih antara pemenang dan posisi bawah.
5. FORMAT ANGKA: WAJIB memformat semua angka dengan titik ribuan (contoh: 243.802). WAJIB sertakan satuan unit di belakang SETIAP angka (contoh: 120.000 IDR bn atau 2.5%). Jangan gunakan angka telanjang.
6. JANGAN gunakan kata ganti (ini, itu, tersebut). Sebut nama Ticker secara spesifik.
7. Output harus dalam bahasa {language}.

Data:
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
ATURAN MUTLAK (STRICT RULES):
1. Anda adalah penerjemah tabel untuk fitur Stock Screening. DILARANG KERAS berhalusinasi.
2. Tulis 1 Paragraf (maksimal 2 kalimat). WAJIB sebutkan kriteria metriknya dan berapa emiten yang lolos dari total emiten yang dievaluasi (ambil angka total dari field `total_passed` dan `total_evaluated`).
   - PENTING: Terjemahkan simbol matematika pada kriteria filter menjadi kata verbal (contoh: ">" menjadi "di atas", "<" menjadi "di bawah", "<=" menjadi "kurang dari atau sama dengan").
   - PENTING: Pastikan angka kriteria filter juga DIBERI SATUAN UNIT (contoh: di atas 120.000 IDR bn).
3. Aturan Penyebutan Emiten:
   - WAJIB sebut Peringkat 1, Peringkat 2, posisi menengah, dan posisi terbawah. (TIDAK BOLEH pakai format list/poin).
4. Tulis 1 kalimat kesimpulan di paragraf baru (dimulai dengan "Kesimpulannya, ...") murni perbandingan selisih nilai Peringkat 1 dan peringkat bawah.
5. FORMAT ANGKA: Anda WAJIB memformat semua angka dengan titik ribuan (contoh: 243802 menjadi 243.802). Selalu sertakan unit di belakang setiap angka.
6. JANGAN gunakan kata ganti (ini, itu, tersebut). Sebut nama Ticker secara spesifik. Gunakan kata "penyaringan".
7. Output harus dalam bahasa {language}.

Data Screening:
{json.dumps(data, indent=2)}
"""

    def call():
        client = get_client()
        response = client.models.generate_content(model='gemini-3.5-flash-lite', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_simulation_interpretation(data: dict, language: str = "English") -> str:

    prompt = f"""
You are a senior banking data analyst. Analyze the What-If Simulation data.
STRICT RULES:
1. Output MUST be purely in {language}.
2. First part: Write EXACTLY 1 paragraph (maximum 3 sentences) summarizing the data using the 5W1H framework (Who, What, Where, When, Why, How). DO NOT explicitly write "Who:", "What:", etc. Make it a seamless narrative.
3. Second part: Write EXACTLY 1 standalone concluding sentence on a new line (e.g. "Kesimpulan: ..."). This conclusion MUST state an analytical verdict on whether the simulated changes significantly improve or harm the bank.
4. Do NOT use bullet points, bold text (**), or emojis. Do NOT give stock investment advice.

Data:
{json.dumps(scorecard_data, indent=2)}
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
ATURAN MUTLAK (STRICT RULES):
1. Anda adalah penerjemah tabel untuk Perbandingan Saham (Compare). DILARANG KERAS berhalusinasi.
2. Tulis 1 Paragraf (maksimal 3 kalimat). Jelaskan persaingan antara emiten-emiten ini dengan menyebutkan skor awal, skor akhir, dan rata-rata skor mereka. (TIDAK BOLEH pakai format list/poin).
3. Tulis 1 kalimat kesimpulan di paragraf baru (dimulai dengan "Kesimpulannya, ...") menyatakan siapa yang secara keseluruhan lebih superior dan stabil secara historis.
4. FORMAT ANGKA: Skor WSM hanya angka (contoh: Skor 75.2). 
5. JANGAN gunakan kata ganti (ini, itu, tersebut). Sebut nama Ticker secara spesifik.
6. Output harus dalam bahasa {language}.

Data:
{json.dumps(comparison_data, indent=2)}
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
ATURAN MUTLAK (STRICT RULES):
1. Anda adalah penerjemah tabel untuk Analisis Historis. DILARANG KERAS berhalusinasi.
2. Tulis 1 Paragraf (maksimal 3 kalimat). Jelaskan metrik mana yang mengalami lonjakan (peningkatan) tertinggi dan metrik mana yang mengalami kejatuhan (penurunan) terburuk. (TIDAK BOLEH pakai format list/poin).
3. Tulis 1 kalimat kesimpulan di paragraf baru (dimulai dengan "Kesimpulannya, ...") menyimpulkan kekuatan atau kelemahan fundamental emiten pada periode tersebut.
4. FORMAT ANGKA: WAJIB memformat semua angka dengan titik ribuan. WAJIB sertakan satuan unit di belakang SETIAP angka (contoh: 120.000 IDR bn atau 2.5%).
5. JANGAN gunakan kata ganti (ini, itu, tersebut). Sebut nama Ticker dan nama Metrik secara spesifik.
6. Output harus dalam bahasa {language}.

Data:
{json.dumps(history_data, indent=2)}
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
