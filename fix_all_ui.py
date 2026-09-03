import re

with open("frontend/src/pages/Screening.tsx", "r") as f:
    content = f.read()

ui_search = r'<h3 className="text-lg font-bold">Screening Results</h3>\s*\{result\.passed\.length > 0 && \(\s*<div className="flex items-center gap-2">\s*<Button variant="report" onClick=\{openSaveModal\}( disabled=\{aiLoading\})?>\s*Save to Reports\s*</Button>\s*\{saveMessage && \(\s*<span className="text-xs text-green-700">\{saveMessage\}</span>\s*\)\}\s*(<div className="ml-auto">[\s\S]*?</div>)?\s*</div>\s*\)\}\s*</div>'

ui_replace = """<h3 className="text-lg font-bold">Screening Results</h3>
            {result.passed.length > 0 && (
              <div className="flex items-center gap-2">
                <Button variant="report" onClick={openSaveModal} disabled={aiLoading}>
                  Save to Reports
                </Button>
                {saveMessage && (
                  <span className="text-xs text-green-700">{saveMessage}</span>
                )}
                <div className="ml-auto">
                  <Button 
                    onClick={handleGenerateScreeningAi}
                    disabled={aiLoading}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {aiLoading ? <span className="animate-pulse">Orcas is thinking...</span> : "Explain with Orcas AI"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {aiError && <p className="text-red-500 text-sm mb-3">{aiError}</p>}
          {aiAnalysis && (
            <div className="bg-purple-50 border border-purple-100 rounded p-4 mb-3 text-sm text-purple-900 leading-relaxed shadow-sm whitespace-pre-wrap">
              <strong className="block mb-2 text-purple-950">AI Analysis:</strong>
              {aiAnalysis}
            </div>
          )}"""

content = re.sub(ui_search, ui_replace, content)

with open("frontend/src/pages/Screening.tsx", "w") as f:
    f.write(content)
