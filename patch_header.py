import sys

with open("frontend/src/pages/SyncData.tsx", "r") as f:
    content = f.read()

old_header = """            {/* Window Header (Green) */}
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
            </div>"""

new_header = """            {/* Window Header (Green) */}
            <div className="bg-[rgb(var(--color-primary))] flex items-center justify-between px-4 py-3 shrink-0">
              {/* Left X button */}
              <button
                onClick={() => setViewFile(null)}
                className="w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 shadow-inner flex items-center justify-center cursor-pointer border border-red-700 focus:outline-none group"
                title="Close"
              >
                <span className="text-[10px] text-white leading-none font-bold opacity-0 group-hover:opacity-100">✕</span>
              </button>
              
              <div className="flex-1 text-center text-white font-semibold flex items-center justify-center gap-2">
                <span className="text-xl leading-none">📄</span>
                {viewFile.filename}
              </div>
              
              {/* Empty space to keep title centered */}
              <div className="w-4 h-4"></div>
            </div>"""

content = content.replace(old_header, new_header)

with open("frontend/src/pages/SyncData.tsx", "w") as f:
    f.write(content)

print("Header patched")
