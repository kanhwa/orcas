import os
from dotenv import load_dotenv
load_dotenv()
from google import genai

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

response = client.models.generate_content(
    model='gemini-flash-latest',
    contents='Halo'
)
print("SUCCESS: " + response.text.strip())
