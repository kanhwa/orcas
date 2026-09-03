import sys

with open("frontend/src/pages/SyncData.tsx", "r") as f:
    content = f.read()

fetch_view_code = """
  const handleView = async (filename: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/sync-data/files/${encodeURIComponent(filename)}/content`, {
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

  const handleDelete = async (filename: string, skipConfirm = false) => {
"""
content = content.replace("  const handleDelete = async (filename: string, skipConfirm = false) => {", fetch_view_code)

with open("frontend/src/pages/SyncData.tsx", "w") as f:
    f.write(content)
print("Patched handleView")
