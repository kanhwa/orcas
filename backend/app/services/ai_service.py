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
    try:
        client = get_client()
    except Exception:
        return "API Key Gemini tidak ditemukan."
        
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
You are a senior banking data analyst. Analyze the Scorecard data.
STRICT RULES:
1. Output MUST be purely in {language}.
2. First part: Write EXACTLY 1 paragraph (maximum 6 sentences) summarizing the data using the 5W1H framework (Who, What, Where, When, Why, How). DO NOT explicitly write "Who:", "What:", etc. Make it a seamless narrative.
3. Second part: Write EXACTLY 1 standalone concluding sentence on a new line (e.g. "Kesimpulan: ..."). This conclusion MUST state an analytical verdict on why the bank won or lost, rather than just repeating visible scores.
4. Do NOT use bullet points, bold text (**), or emojis. Do NOT give stock investment advice.

Data:
{json.dumps(scorecard_data, indent=2)}
"""
    
    def call():
        response = client.models.generate_content(model='gemini-1.5-flash', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_ranking_interpretation(ranking_data: list, period: str, language: str = "Indonesian") -> str:
    try:
        client = get_client()
    except Exception:
        return "API Key Gemini tidak ditemukan."

    prompt = f"""
You are a senior banking data analyst. Analyze the Ranking data for the period {period}.
STRICT RULES:
1. Output MUST be purely in {language}.
2. First part: Write EXACTLY 1 paragraph (maximum 6 sentences) summarizing the data using the 5W1H framework (Who, What, Where, When, Why, How). DO NOT explicitly write "Who:", "What:", etc. Make it a seamless narrative.
3. Second part: Write EXACTLY 1 standalone concluding sentence on a new line (e.g. "Kesimpulan: ..."). This conclusion MUST state an analytical verdict on why the top bank won and the bottom bank lost.
4. Do NOT use bullet points, bold text (**), or emojis. Do NOT give stock investment advice.

Data:
{json.dumps(ranking_data, indent=2)}
"""
    
    def call():
        response = client.models.generate_content(model='gemini-1.5-flash', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_metric_ranking_interpretation(data: dict, language: str = "English") -> str:
    try:
        client = get_client()
    except Exception:
        return "API Key Gemini tidak ditemukan."

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
You are a senior banking data analyst. Analyze the Metric Ranking data.
STRICT RULES:
1. Output MUST be purely in {language}.
2. First part: Write EXACTLY 1 paragraph (maximum 6 sentences) summarizing the data using the 5W1H framework (Who, What, Where, When, Why, How). DO NOT explicitly write "Who:", "What:", etc. Make it a seamless narrative.
3. Second part: Write EXACTLY 1 standalone concluding sentence on a new line (e.g. "Kesimpulan: ..."). This conclusion MUST state an analytical verdict on the performance gap between the top and bottom banks.
4. Do NOT use bullet points, bold text (**), or emojis. Do NOT give stock investment advice.

Data:
{json.dumps(data, indent=2)}
"""
    
    def call():
        response = client.models.generate_content(model='gemini-1.5-flash', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_screening_interpretation(data: dict, language: str = "English") -> str:
    try:
        client = get_client()
    except Exception:
        return "API Key Gemini tidak ditemukan."

    passing_banks = data.get("passing_banks", [])
    n = len(passing_banks)
    if n > 4:
        sliced = [passing_banks[0], passing_banks[1], passing_banks[n//2], passing_banks[-1]]
        data["passing_banks"] = sliced

    prompt = f"""
You are a senior banking data analyst. Analyze the Screening data.
STRICT RULES:
1. Output MUST be purely in {language}.
2. First part: Write EXACTLY 1 paragraph (maximum 6 sentences) summarizing the data using the 5W1H framework (Who, What, Where, When, Why, How). DO NOT explicitly write "Who:", "What:", etc. Make it a seamless narrative.
3. Second part: Write EXACTLY 1 standalone concluding sentence on a new line (e.g. "Kesimpulan: ..."). This conclusion MUST state an analytical verdict on the overall quality of the banks that passed.
4. Do NOT use bullet points, bold text (**), or emojis. Do NOT give stock investment advice.

Data:
{json.dumps(data, indent=2)}
"""

    def call():
        response = client.models.generate_content(model='gemini-1.5-flash', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_simulation_interpretation(data: dict, language: str = "English") -> str:
    try:
        client = get_client()
    except Exception:
        return "API Key Gemini tidak ditemukan."

    prompt = f"""
You are a senior banking data analyst. Analyze the What-If Simulation data.
STRICT RULES:
1. Output MUST be purely in {language}.
2. First part: Write EXACTLY 1 paragraph (maximum 6 sentences) summarizing the data using the 5W1H framework (Who, What, Where, When, Why, How). DO NOT explicitly write "Who:", "What:", etc. Make it a seamless narrative.
3. Second part: Write EXACTLY 1 standalone concluding sentence on a new line (e.g. "Kesimpulan: ..."). This conclusion MUST state an analytical verdict on whether the simulated changes significantly improve or harm the bank.
4. Do NOT use bullet points, bold text (**), or emojis. Do NOT give stock investment advice.

Data:
{json.dumps(data, indent=2)}
"""

    def call():
        response = client.models.generate_content(model='gemini-1.5-flash', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_compare_interpretation(data: dict, language: str = "English") -> str:
    try:
        client = get_client()
    except Exception:
        return "API Key Gemini tidak ditemukan."

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
You are a senior banking data analyst. Analyze the Compare Stocks data.
STRICT RULES:
1. Output MUST be purely in {language}.
2. First part: Write EXACTLY 1 paragraph (maximum 6 sentences) summarizing the data using the 5W1H framework (Who, What, Where, When, Why, How). DO NOT explicitly write "Who:", "What:", etc. Make it a seamless narrative.
3. Second part: Write EXACTLY 1 standalone concluding sentence on a new line (e.g. "Kesimpulan: ..."). This conclusion MUST state an analytical verdict on which bank is superior across the timeline.
4. Do NOT use bullet points, bold text (**), or emojis. Do NOT give stock investment advice.

Data:
{json.dumps(data, indent=2)}
"""

    def call():
        response = client.models.generate_content(model='gemini-1.5-flash', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_historical_interpretation(data: dict, language: str = "English") -> str:
    try:
        client = get_client()
    except Exception:
        return "API Key Gemini tidak ditemukan."

    # Slicing: Top 3 positive and Top 3 negative changes
    changes = data.get("significant_changes", [])
    if changes:
        changes_sorted = sorted(changes, key=lambda x: x.get("growth_pct", 0), reverse=True)
        top_3 = changes_sorted[:3]
        bottom_3 = changes_sorted[-3:] if len(changes_sorted) > 3 else []
        data["significant_changes"] = {"top_improving": top_3, "top_declining": bottom_3}

    prompt = f"""
You are a senior banking data analyst. Analyze the Historical Comparison data.
STRICT RULES:
1. Output MUST be purely in {language}.
2. First part: Write EXACTLY 1 paragraph (maximum 6 sentences) summarizing the data using the 5W1H framework (Who, What, Where, When, Why, How). DO NOT explicitly write "Who:", "What:", etc. Make it a seamless narrative.
3. Second part: Write EXACTLY 1 standalone concluding sentence on a new line (e.g. "Kesimpulan: ..."). This conclusion MUST state an analytical verdict on whether the bank's historical trajectory makes it superior or declining.
4. Do NOT use bullet points, bold text (**), or emojis. Do NOT give stock investment advice.

Data:
{json.dumps(data, indent=2)}
"""

    def call():
        response = client.models.generate_content(model='gemini-1.5-flash', contents=prompt)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)

def generate_glossary_chat(question: str, history: list, language: str = "English") -> str:
    try:
        client = get_client()
    except Exception:
        return "API Key Gemini tidak ditemukan."

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
        response = client.models.generate_content(model='gemini-1.5-flash', contents=messages)
        return response.text.strip().replace('**', '')
    return handle_ai_retry(call)
