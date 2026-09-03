import re

def safe_replace(filepath, loading_state):
    with open(filepath, "r") as f:
        content = f.read()

    # Insert state
    if "const [aiLanguage" not in content:
        target_state_line = f"const [{loading_state}, set{loading_state[0].upper() + loading_state[1:]}] = useState(false);"
        replacement_state_line = target_state_line + '\n  const [aiLanguage, setAiLanguage] = useState<"Indonesian" | "English">("Indonesian");'
        content = content.replace(target_state_line, replacement_state_line)

    # API language param
    content = re.sub(r'generate([A-Za-z]+)Interpretation\([^,]+, "English"\)', lambda m: m.group(0).replace('"English"', 'aiLanguage'), content)

    # Find the button exactly
    if "Explain with Orcas AI" in content:
        # We find the exact block: <Button ...> ... Explain with Orcas AI ... </Button>
        # Just use a very specific string replace if possible, or simple regex.
        pattern = r'(<Button[^>]*>\s*\{[^}]+\s*\?\s*<span[^>]*>[^<]*<\/span>\s*:\s*"Explain with Orcas AI"\s*\}\s*<\/Button>)'
        
        def button_replacer(match):
            btn_html = match.group(1)
            
            # Extract onClick and disabled from the button
            onclick_match = re.search(r'onClick=\{([^}]+)\}', btn_html)
            disabled_match = re.search(r'disabled=\{([^}]+)\}', btn_html)
            
            onclick = onclick_match.group(1) if onclick_match else ""
            disabled = disabled_match.group(1) if disabled_match else ""
            
            return f"""<div className="flex rounded-md shadow-sm relative">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none pr-3"
                  onClick={{{onclick}}}
                  disabled={{{disabled}}}
                >
                  {{{loading_state} ? <span className="animate-pulse">Orcas is thinking...</span> : "Explain with Orcas AI"}}
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

        content = re.sub(pattern, button_replacer, content)

    with open(filepath, "w") as f:
        f.write(content)

safe_replace("frontend/src/pages/ComparePage.tsx", "aiLoading")
safe_replace("frontend/src/pages/Simulation.tsx", "aiLoading")
safe_replace("frontend/src/pages/Historical.tsx", "aiLoading")

# Screening uses "aiLoading" but wait, does it use disabled={!canRun} or something?
safe_replace("frontend/src/pages/Screening.tsx", "aiLoading")
safe_replace("frontend/src/pages/MetricRanking.tsx", "aiLoading")

print("Done")
