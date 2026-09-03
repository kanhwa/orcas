import re

def manual_replace(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # We just replace the <Button to </Button>
    # Find exact string matches for MetricRanking.tsx and Screening.tsx
    
    pattern = r'<Button[^>]*onClick=\{([^}]+)\}[^>]*disabled=\{([^}]+)\}[^>]*className="bg-purple[^"]*"[^>]*>\s*\{([^}]+\s*\?\s*<span[^>]*>[^<]*<\/span>\s*:\s*"Explain with Orcas AI")\s*\}\s*<\/Button>'
    
    def replacer(match):
        onclick = match.group(1)
        disabled = match.group(2)
        inner = match.group(3)
        return f"""<div className="flex rounded-md shadow-sm relative">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none pr-3"
                  onClick={{{onclick}}}
                  disabled={{{disabled}}}
                >
                  {{{inner}}}
                </Button>
                <div className="relative flex items-stretch">
                  <select
                    value={{aiLanguage}}
                    onChange={{(e) => setAiLanguage(e.target.value as "Indonesian" | "English")}}
                    className="appearance-none bg-purple-700 hover:bg-purple-800 text-white rounded-r-md pl-3 pr-8 py-2 text-sm focus:outline-none cursor-pointer border-l border-purple-500 font-medium"
                    disabled={{{disabled}}}
                  >
                    <option value="Indonesian">Indonesian</option>
                    <option value="English">English</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </div>
                </div>
              </div>"""

    content = re.sub(pattern, replacer, content)
    with open(filepath, "w") as f:
        f.write(content)

manual_replace("frontend/src/pages/MetricRanking.tsx")
manual_replace("frontend/src/pages/Screening.tsx")

