import re
import sys

files_to_patch = [
    "frontend/src/pages/Scoring.tsx",
    "frontend/src/pages/ComparePage.tsx",
    "frontend/src/pages/Simulation.tsx",
    "frontend/src/pages/Screening.tsx",
    "frontend/src/pages/MetricRanking.tsx",
    "frontend/src/pages/Historical.tsx"
]

def generate_split_button(button_content, disabled_condition, onclick_func):
    return f"""<div className="flex rounded-md shadow-sm relative">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none pr-3"
                  onClick={{{onclick_func}}}
                  disabled={{{disabled_condition}}}
                >
                  {button_content}
                </Button>
                <div className="relative flex items-stretch">
                  <select
                    value={{aiLanguage}}
                    onChange={{(e) => setAiLanguage(e.target.value as "Indonesian" | "English")}}
                    className="appearance-none bg-purple-700 hover:bg-purple-800 text-white rounded-r-md pl-3 pr-8 py-2 text-sm focus:outline-none cursor-pointer border-l border-purple-500 font-medium"
                    disabled={{{disabled_condition}}}
                  >
                    <option value="Indonesian">Indonesian</option>
                    <option value="English">English</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </div>
                </div>
              </div>"""

for filepath in files_to_patch:
    with open(filepath, "r") as f:
        content = f.read()

    if "const [aiLanguage" not in content:
        # Add aiLanguage state
        content = re.sub(r'(const \[(?:aiLoading|aiAnalysisLoading|rankingAiLoading), .*?\] = useState\(false\);)', 
                         r'\1\n  const [aiLanguage, setAiLanguage] = useState<"Indonesian" | "English">("Indonesian");', 
                         content)

    # Replace "English" with aiLanguage in API calls
    content = re.sub(r'generate[A-Za-z]+Interpretation\([^,]+, "English"\)', lambda m: m.group(0).replace('"English"', 'aiLanguage'), content)

    # For Scoring, modify the JSON.stringify payload to include language
    if "Scoring.tsx" in filepath:
        content = content.replace("body: JSON.stringify(scorecard)", "body: JSON.stringify({ scorecard, language: aiLanguage })")
        content = content.replace("body: JSON.stringify({ result: rankResult })", "body: JSON.stringify({ result: rankResult, language: aiLanguage })")

    # Replace the button carefully
    # Find <Button ...>...</Button> containing "Explain with Orcas AI"
    pattern = r'<Button[^>]*onClick=\{([^}]+)\}[^>]*disabled=\{([^}]+)\}[^>]*>\s*(.*?)Explain with Orcas AI(.*?)\s*<\/Button>'
    
    def replacer(match):
        onclick = match.group(1)
        disabled = match.group(2)
        inner = match.group(3) + "Explain with Orcas AI" + match.group(4)
        return generate_split_button(inner.strip(), disabled, onclick)

    content = re.sub(pattern, replacer, content, flags=re.DOTALL)

    with open(filepath, "w") as f:
        f.write(content)

print("Patch complete")
