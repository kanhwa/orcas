import zlib
import base64
import urllib.request
import ssl

mermaid_code = """graph LR
    %% Pengaturan Warna dan Bentuk
    classDef aktor fill:#d5e8d4,stroke:#82b366,stroke-width:2px,color:#000,font-family:Times New Roman;
    classDef gemini fill:#e1d5e7,stroke:#9673a6,stroke-width:2px,color:#000,font-family:Times New Roman;
    classDef process fill:#dae8fc,stroke:#6c8ebf,stroke-width:2px,color:#000,font-family:Times New Roman;
    classDef db fill:#fff2cc,stroke:#d6b656,stroke-width:2px,color:#000,font-family:Times New Roman;

    Admin["Admin"]:::aktor
    Employee["Employee"]:::aktor
    Gemini["Gemini LLM API"]:::gemini

    P1("1.0<br>Manajemen Akun &<br>Autentikasi"):::process
    P2("2.0<br>Sinkronisasi &<br>Pemrosesan Dataset"):::process
    P3("3.0<br>Kalkulasi WSM,<br>Komparasi & Simulasi"):::process
    P4("4.0<br>Pemrosesan AI &<br>Edukasi Finansial"):::process
    P5("5.0<br>Cetak Laporan &<br>Tinjauan Audit"):::process

    D1[(USERS)]:::db
    D2[(IMPORT_HISTORY)]:::db
    D3[(EMITENS)]:::db
    D4[(METRIC_DEFINITIONS)]:::db
    D5[(FINANCIAL_DATA)]:::db
    D6[(WEIGHT_TEMPLATES)]:::db
    D7[(SCORING_TEMPLATES)]:::db
    D8[(SCORING_RUNS)]:::db
    D9[(SCORING_RUN_ITEMS)]:::db
    D10[(SCORING_RESULTS)]:::db
    D11[(COMPARISONS)]:::db
    D12[(SIMULATION_LOGS)]:::db
    D13[(REPORTS)]:::db
    D14[(AUDIT_LOGS)]:::db

    Admin -->|Kredensial| P1
    Employee -->|Kredensial| P1
    P1 -->|Status Profil| Admin
    P1 -->|Status Profil| Employee

    Admin -->|Dataset CSV & Trash Bin| P2
    P2 -->|Notifikasi Sinkronisasi| Admin

    Admin -->|Parameter Analisis| P3
    Employee -->|Parameter Analisis| P3
    P3 -->|Hasil Numerik WSM| Admin
    P3 -->|Hasil Numerik WSM| Employee

    Admin -->|Kueri Chatbot / Scorecard| P4
    Employee -->|Kueri Chatbot / Scorecard| P4
    P4 -->|Teks Naratif 5W+1H & Chat| Admin
    P4 -->|Teks Naratif 5W+1H & Chat| Employee

    Admin -->|Instruksi Cetak / Cek Log| P5
    Employee -->|Instruksi Cetak| P5
    P5 -->|Dokumen PDF & Log Sistem| Admin
    P5 -->|Dokumen PDF| Employee

    P4 <-->|JSON Payload| Gemini

    P1 <-->|Read/Write| D1
    P1 -->|Write Log| D14

    P2 -->|Write| D2
    P2 <-->|Read/Write| D3
    P2 <-->|Read/Write| D4
    P2 -->|Write| D5
    P2 -->|Write Log| D14

    P3 -->|Read| D3
    P3 -->|Read| D4
    P3 -->|Read| D5
    P3 <-->|Read/Write| D6
    P3 <-->|Read/Write| D7
    P3 -->|Write| D8
    P3 -->|Write| D9
    P3 -->|Write| D10
    P3 -->|Write| D11
    P3 -->|Write| D12

    P4 -->|Read| D10

    P5 -->|Write| D13
    P5 -->|Read| D14
"""

compressed = zlib.compress(mermaid_code.encode('utf-8'), 9)
payload = base64.urlsafe_b64encode(compressed).decode('ascii')
url = f"https://kroki.io/mermaid/png/{payload}"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx) as response:
        with open('DFD_Level_1_Orcas.png', 'wb') as f:
            f.write(response.read())
    print("Success")
except Exception as e:
    print(f"Error: {e}")
