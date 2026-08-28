import os
import json
import time
from google import genai

def generate_scorecard_interpretation(scorecard_data: dict) -> str:
    """
    Generates a 5W+1H financial interpretation using Gemini API (via google-genai).
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "API Key Gemini tidak ditemukan. Hubungi administrator."

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
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            error_str = str(e)
            if "503" in error_str or "UNAVAILABLE" in error_str:
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Tunggu 1 detik, lalu 2 detik
                    continue
                else:
                    return "Maaf, server AI sedang mengalami antrean tinggi (High Demand). Mohon tunggu beberapa saat dan coba klik tombol kembali."
            return f"Gagal menghasilkan analisis AI: Terjadi kendala sistem ({error_str})"
            
    return "Maaf, server AI sedang sibuk. Mohon coba lagi nanti."


def generate_glossary_chat(question: str, history: list, language: str = "English") -> str:
    """
    Generates an answer based strictly on financial glossary context.
    """
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

    try:
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=messages
        )
        return response.text.strip().replace('**', '')
    except Exception as e:
        return "Maaf, Orcas sedang tidur karena antrean di server sedang penuh. Silakan coba sapa Orcas lagi beberapa saat lagi ya!" if language == "Indonesia" else "Sorry, Orcas is currently sleeping because the servers are busy. Please try again in a moment!"
