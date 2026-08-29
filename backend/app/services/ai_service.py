import os
import json
import time
from google import genai

ERROR_MSG_BUSY = "Sorry, Orcas is currently sleeping because the servers are busy. Please try again in a moment!"
ERROR_MSG_FAIL = "Sorry, Orcas failed to process the request. A system error occurred."

def handle_ai_retry(client_call, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client_call()
        except Exception as e:
            if "503" in str(e) or "UNAVAILABLE" in str(e) or "429" in str(e) or "quota" in str(e).lower():
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
            return ERROR_MSG_BUSY
    return ERROR_MSG_BUSY

def generate_scorecard_interpretation(scorecard_data: dict) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "API Key Gemini tidak ditemukan."

    client = genai.Client(api_key=api_key)

    prompt = f"""
Anda adalah seorang analis keuangan senior. Tugas Anda adalah memberikan interpretasi analitis (maksimal 2 paragraf) terhadap hasil pemeringkatan kesehatan finansial bank menggunakan format 5W+1H (Who, What, Where, When, Why, How). Jangan sebutkan secara eksplisit "Who:", "What:", dll, tetapi mengalirlah menjadi paragraf narasi profesional berbahasa Indonesia.

Data Hasil Analisis:
{json.dumps(scorecard_data, indent=2)}

Struktur Narasi yang Diharapkan:
- Paragraf 1: Bahas Siapa (Who), Apa peringkat/skornya (What), Di mana (Where: Bursa Efek Indonesia), dan Kapan (When).
- Paragraf 2: Bahas Mengapa (Why) skornya bisa demikian berdasarkan metrik dengan kontribusi positif/negatif terbesar, dan Bagaimana (How) implikasi operasional efisiensi/kinerjanya secara faktual.

Gunakan gaya bahasa akademik namun lugas. Jangan berikan rekomendasi beli/jual saham. DILARANG KERAS menggunakan emoji, emotikon, atau simbol dekoratif apa pun.
"""
    
    def call():
        response = client.models.generate_content(model='gemini-3.6-flash', contents=prompt)
        return response.text.strip()
        
    return handle_ai_retry(call)

def generate_ranking_interpretation(ranking_data: list, period: str, language: str = "Indonesian") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "API Key Gemini tidak ditemukan."

    client = genai.Client(api_key=api_key)
    
    data_str = json.dumps(ranking_data, indent=2)

    prompt = f"""
Anda adalah analis data perbankan ORCAS.
Tugas Anda adalah merangkum hasil perankingan (ranking) bank ke dalam TEPAT SATU PARAGRAF PENDEK (maksimal 4-5 kalimat).
ATURAN SANGAT KETAT:
1. JANGAN PERNAH gunakan poin-poin, list, bullet, cetak tebal (markdown **), atau emoji.
2. Harus ditulis dalam paragraf murni naratif bergaya profesional.
3. Sebutkan periode yang dianalisis: {period}.
4. Jangan memberikan rekomendasi saham atau kalimat pembuka/penutup basa-basi (seperti "Berikut adalah analisis..."). Langsung ke intinya.

Contoh format kalimat yang diharapkan:
"Dari tahun 2020 sampai 2024, BANK A memimpin di peringkat satu dengan skor 0.85 karena kinerjanya yang efisien. Di sisi lain, BANK B berada di peringkat terbawah..."

Data yang dianalisis:
{data_str}
"""
    
    def call():
        response = client.models.generate_content(model='gemini-3.6-flash', contents=prompt)
        return response.text.strip().replace('**', '')
        
    return handle_ai_retry(call)

def generate_metric_ranking_interpretation(data: dict, language: str = "English") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "API Key Gemini tidak ditemukan."

    client = genai.Client(api_key=api_key)
    
    data_str = json.dumps(data, indent=2)

    prompt = f"""
You are an ORCAS banking data analyst.
Your task is to analyze the following Metric Ranking data in EXACTLY 1 to 3 SHORT PARAGRAPHS.
STRICT RULES:
1. ALL OUTPUT MUST BE IN {language}.
2. NEVER use bullet points, lists, bold text (markdown **), or emojis. Write in pure narrative paragraphs.
3. First paragraph: Explain the metric ({data.get('metric_name')}), its type (Cost or Benefit), and its unit ({data.get('unit')}). Explain what this metric means briefly in the context of banking.
4. Second paragraph: Explain the ranking information from the data. If the data spans a range of years, explicitly state the period as "from year {data.get('start_year')} to {data.get('end_year')}". Mention exactly the banks provided in the data (which are up to 4 banks representing top, middle, and worst) and their scores/values.
5. Third paragraph (Optional): A very brief concluding sentence if necessary, but keep it concise.
6. Do NOT give stock investment advice or polite opening/closing phrases.

Data to analyze:
{data_str}
"""
    
    def call():
        response = client.models.generate_content(model='gemini-3.6-flash', contents=prompt)
        return response.text.strip().replace('**', '')
        
    return handle_ai_retry(call)

def generate_glossary_chat(question: str, history: list, language: str = "English") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "API Key Gemini tidak ditemukan."

    client = genai.Client(api_key=api_key)

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
        response = client.models.generate_content(model='gemini-3.6-flash', contents=messages)
        return response.text.strip().replace('**', '')
        
    return handle_ai_retry(call)

def generate_screening_interpretation(data: dict, language: str = "English") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "API Key Gemini tidak ditemukan."

    client = genai.Client(api_key=api_key)
    
    prompt = f"""
You are an ORCAS banking data analyst.
Your task is to analyze the following Screening data in EXACTLY 1 to 2 SHORT PARAGRAPHS.
STRICT RULES:
1. ALL OUTPUT MUST BE IN {language}.
2. NEVER use bullet points, lists, bold text (markdown **), or emojis. Write in pure narrative paragraphs.
3. First paragraph: Explain the chosen metrics (their definitions and what they describe). Also, briefly mention the Data Hint for each metric provided in the data (median, min, max).
4. Second paragraph: Explain the banks that passed the screening. If there are more than 4 banks, ONLY mention exactly 4 banks (the top 2 best, 1 in the middle, and the 1 worst) and their scores. If there are 4 or fewer banks, mention all of them.
5. If the data spans a range of years, explicitly state the period as "from year X to Y".
6. Do NOT give stock investment advice or polite opening/closing phrases.

Data to analyze:
{json.dumps(data, indent=2)}
"""

    def call_ai():
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text

    return handle_ai_retry(call_ai)

def generate_simulation_interpretation(data: dict, language: str = "English") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "API Key Gemini tidak ditemukan."

    client = genai.Client(api_key=api_key)
    
    prompt = f"""
You are an ORCAS banking data analyst.
Your task is to analyze the following What-If Simulation data in EXACTLY 1 to 2 SHORT PARAGRAPHS.
STRICT RULES:
1. ALL OUTPUT MUST BE IN {language}.
2. NEVER use bullet points, lists, bold text (markdown **), or emojis. Write in pure narrative paragraphs.
3. First paragraph: Summarize the simulation result. State the evaluated bank, the weight profile used, and how the overall score changed (from baseline to simulated, including the delta). Mention the adjustments that were simulated.
4. Second paragraph: Analyze *why* the score changed. Discuss whether the adjusted metrics play a key role based on the chosen weight profile, and whether the direction of change (plus or minus) had a logical positive or negative impact on the final score. 
5. Do NOT give stock investment advice or polite opening/closing phrases.

Data to analyze:
{json.dumps(data, indent=2)}
"""

    def call_ai():
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text

    return handle_ai_retry(call_ai)

def generate_compare_interpretation(data: dict, language: str = "English") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "API Key Gemini tidak ditemukan."

    client = genai.Client(api_key=api_key)
    
    prompt = f"""
You are an ORCAS banking data analyst.
Your task is to analyze the following Compare Stocks data in EXACTLY 1 to 2 SHORT PARAGRAPHS.
STRICT RULES:
1. ALL OUTPUT MUST BE IN {language}.
2. NEVER use bullet points, lists, bold text (markdown **), or emojis. Write in pure narrative paragraphs.
3. First paragraph: Introduce the comparison. Mention the banks being compared and explicitly state the year range (from year X to year Y). Mention the Mode (Overall or Section). If it's a specific section (e.g., Income Statement), explain what that section evaluates (e.g., profitability and operational efficiency). If it's Overall, explain that it evaluates the holistic financial health aggregating balance sheet, income, and cash flow. Also, mention the chosen Weight Profile and Missing Data Policy, and state whether the Industry Average benchmark is included.
4. Second paragraph: Analyze the performance results. Identify which bank achieved the highest score in which year, and which bank recorded the lowest score. Briefly summarize the overall performance trend or gap between the banks.
5. Do NOT give stock investment advice or polite opening/closing phrases.

Data to analyze:
{json.dumps(data, indent=2)}
"""

    def call_ai():
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text

    return handle_ai_retry(call_ai)

def generate_historical_interpretation(data: dict, language: str = "English") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "API Key Gemini tidak ditemukan."

    client = genai.Client(api_key=api_key)
    
    prompt = f"""
You are an ORCAS banking data analyst.
Your task is to analyze the following Historical Comparison data in EXACTLY 1 to 2 SHORT PARAGRAPHS.
STRICT RULES:
1. ALL OUTPUT MUST BE IN {language}.
2. NEVER use bullet points, lists, bold text (markdown **), or emojis. Write in pure narrative paragraphs.
3. First paragraph: Introduce the comparison. Mention the evaluated bank and explicitly state the year range being compared (from year X to year Y). Mention the scope (e.g., across all financial sections or a specific section), explicitly state the significance threshold applied to filter changes (e.g., 20%), and summarize the overall trend (e.g., how many metrics improved vs declined).
4. Second paragraph: Highlight the most significant changes. Identify the metrics with the largest positive growth and the most concerning declines. Briefly explain the potential business impact of these key changes on the bank's overall health.
5. Do NOT give stock investment advice or polite opening/closing phrases.

Data to analyze:
{json.dumps(data, indent=2)}
"""

    def call_ai():
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text

    return handle_ai_retry(call_ai)
