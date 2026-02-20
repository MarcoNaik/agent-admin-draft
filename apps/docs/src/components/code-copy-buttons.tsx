"use client"

import { useEffect } from "react"

export function CodeCopyButtons() {
  useEffect(() => {
    const blocks = document.querySelectorAll("div.prose pre")
    blocks.forEach((pre) => {
      if (pre.querySelector(".copy-btn")) return
      const wrapper = document.createElement("div")
      wrapper.className = "relative group"
      pre.parentNode?.insertBefore(wrapper, pre)
      wrapper.appendChild(pre)

      const btn = document.createElement("button")
      btn.className =
        "copy-btn absolute top-2 right-2 p-1.5 rounded bg-cream/10 text-cream/50 hover:text-cream/80 opacity-0 group-hover:opacity-100 transition-all"
      btn.setAttribute("aria-label", "Copy code")
      btn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      btn.addEventListener("click", async () => {
        const text = pre.textContent ?? ""
        await navigator.clipboard.writeText(text)
        btn.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        setTimeout(() => {
          btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
        }, 2000)
      })
      wrapper.appendChild(btn)
    })
  }, [])

  return null
}
