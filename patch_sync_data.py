import re

with open("frontend/src/pages/SyncData.tsx", "r") as f:
    content = f.read()

template_func = """
  const handleDownloadTemplate = () => {
    const headers = [
      "Year", "Section", "Metric", 
      "AGRS", "ARTO", "BABP", "BACA", "BBCA", "BBKP", "BBNI", "BBRI", "BBTN", "BDMN", "BINA", "BJBR", "BJTM", "BKSW", "BMAS", "BMRI", "BNBA", "BNGA", "BNII", "BNLI", "BSIM", "BTPN", "BTPS", "CCB", "MEGA", "NISP", "NOBU", "PNBN", "SDRA"
    ];
    
    const rows = [
      ["20YY", "BALANCE SHEET", "Total Assets", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Total Liabilities", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Total Equity", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Customer Deposits", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Fixed Assets", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Cash and Cash Equivalents", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Loans Given", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Loans Received", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Placements with Bank Indonesia", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Giro at Bank Indonesia", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Asset Turnover", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Price to Book Value (PBV)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Book Value Per Share (BVPS)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Tangible Book Value Per Share", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Total Revenue", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Net Income", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Gross Profit", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Operating Expenses", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Net Interest Income (NII)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Provision for Impairment Losses (CKPN)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Earnings per Share (EPS)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Return on Assets (ROA)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Return on Equity (ROE)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Net Profit Margin (NPM)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Gross Profit Margin (GPM)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Operating Expenses to Operating Income (BOPO)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Cost to Income Ratio (CIR)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "CASH FLOW STATEMENT", "Operating Cash Flow", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "CASH FLOW STATEMENT", "Investing Cash Flow", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "CASH FLOW STATEMENT", "Financing Cash Flow", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "CASH FLOW STATEMENT", "Net Increase Decrease in Cash and Cash Equivalents", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(c => `"${c}"`).join(","))
    ].join("\\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Orcas_Dataset_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
"""

button_code = """      {/* Action Buttons & Sync Date */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleDownloadTemplate} 
            className="w-fit text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300"
          >
            ⬇️ Download Template
          </Button>
          <div className="text-sm text-gray-500 font-medium">
            {lastRefreshed && `Dataset synchronized as of: ${lastRefreshed.toLocaleString('en-US')}`}
          </div>
        </div>"""

content = content.replace("  const handleView = async (filename: string) => {", template_func + "\n  const handleView = async (filename: string) => {")
content = re.sub(r'      {/\* Action Buttons & Sync Date \*/}.*?        <div className="text-sm text-gray-500 font-medium">\n          {lastRefreshed.*?</div>', button_code, content, flags=re.DOTALL)

with open("frontend/src/pages/SyncData.tsx", "w") as f:
    f.write(content)
