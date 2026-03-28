import { existsSync, mkdirSync, writeFileSync } from "fs"
import { dirname, join } from "path"

const SKILL_URL = "https://docs.struere.dev/skill"
const SKILL_PATH = ".claude/skills/struere-developer/SKILL.md"

const FALLBACK_SKILL = `---
name: struere-developer
description: "Build, configure, and deploy AI agents on the Struere platform. Use when working with Struere projects (struere.json present), defining agents/data-types/roles/triggers, using the Struere SDK (defineAgent, defineData, defineRole, defineTrigger, defineTools), running struere CLI commands, calling the Struere Chat API, or debugging agent behavior."
metadata:
  author: struere
  version: 1.0.0
  category: developer-tools
---

# Struere Developer Guide

Fetch the full skill from: ${SKILL_URL}
`

export async function installSkill(cwd: string): Promise<void> {
  const filePath = join(cwd, SKILL_PATH)
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  let content: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(SKILL_URL, { signal: controller.signal })
    clearTimeout(timeout)
    content = await response.text()
  } catch {
    content = FALLBACK_SKILL
  }

  writeFileSync(filePath, content)
}
