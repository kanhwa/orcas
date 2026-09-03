import sys

with open("frontend/src/pages/SyncData.tsx", "r") as f:
    content = f.read()

# 1. Add state
state_code = """
  const [error, setError] = useState<string | null>(null);
  
  const [viewFile, setViewFile] = useState<{ filename: string, rows: string[][] } | null>(null);
"""
content = content.replace("  const [error, setError] = useState<string | null>(null);", state_code)

# 2. Add handleView function right before handleDelete
fetch_view_code = """
  const handleView = async (filename: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/sync-data/files/${filename}/content`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const rawContent: string = data.content;
        const parsedRows = rawContent.split('\\n')
            .filter(line => line.trim())
            .map(line => line.split(',')); 
        setViewFile({ filename: data.filename, rows: parsedRows });
      } else {
        alert("Failed to fetch file content.");
      }
    } catch (e) {
      console.error(e);
      alert("Error fetching file content.");
    }
  };

  const handleDelete = async (filename: string) => {
"""
content = content.replace("  const handleDelete = async (filename: string) => {", fetch_view_code)

# 3. Replace Action Column TD
old_action_td = """<td className="py-3 px-4 text-right">
                        <span
                          onClick={() => handleDelete(file.filename)}
                          className="text-red-600 font-semibold cursor-pointer hover:underline"
                        >
                          Delete
                        </span>
                      </td>"""

new_action_td = """<td className="py-3 px-4 text-right space-x-4">
                        <span
                          onClick={() => handleView(file.filename)}
                          className="text-[rgb(var(--color-primary))] font-semibold cursor-pointer hover:underline"
                        >
                          View
                        </span>
                        <span
                          onClick={() => handleDelete(file.filename)}
                          className="text-red-600 font-semibold cursor-pointer hover:underline"
                        >
                          Delete
                        </span>
                      </td>"""
content = content.replace(old_action_td, new_action_td)

# 4. Add Modal at the end just before final </div>
modal_code = """

      {/* Quick Look View Modal */}
      {viewFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden border border-gray-300 transform transition-all">
            {/* Window Header (Green) */}
            <div className="bg-[rgb(var(--color-primary))] flex items-center justify-between px-4 py-3 shrink-0">
              {/* Left X button */}
              <button
                onClick={() => setViewFile(null)}
                className="w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 shadow-inner flex items-center justify-center cursor-pointer border border-red-700 focus:outline-none"
                title="Close"
              >
              </button>
              
              <div className="flex-1 text-center text-white font-semibold flex items-center justify-center gap-2">
                <span className="text-xl leading-none">📄</span>
                {viewFile.filename}
              </div>
              
              {/* Right X button */}
              <button
                onClick={() => setViewFile(null)}
                className="w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 shadow-inner flex items-center justify-center cursor-pointer border border-red-700 focus:outline-none"
                title="Close"
              >
              </button>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-auto bg-[#f8f9fa]">
              <table className="w-full border-collapse text-xs md:text-sm text-black select-text">
                <thead className="sticky top-0 bg-[#e0e0e0] z-10 shadow-sm border-b-2 border-gray-400">
                  <tr>
                    {viewFile.rows[0]?.map((header, idx) => (
                      <th key={idx} className="border-r border-gray-400 border-b border-gray-400 px-3 py-2 text-left font-bold whitespace-nowrap bg-[#ebebeb]">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewFile.rows.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-blue-100/50">
                      {row.map((cell, colIdx) => (
                        <td key={colIdx} className="border-r border-b border-gray-300 px-3 py-1.5 whitespace-nowrap font-mono text-[13px]">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
"""

# Replace the last `    </div>\n  );\n}` with our new modal code.
content = content.replace("    </div>\n  );\n}", modal_code)

with open("frontend/src/pages/SyncData.tsx", "w") as f:
    f.write(content)

print("Patched SyncData.tsx")
