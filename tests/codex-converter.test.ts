import { describe, expect, test } from "bun:test"
import { convertClaudeToCodex } from "../src/converters/claude-to-codex"
import { parseFrontmatter } from "../src/utils/frontmatter"
import type { ClaudePlugin } from "../src/types/claude"

const fixturePlugin: ClaudePlugin = {
  root: "/tmp/plugin",
  manifest: { name: "fixture", version: "1.0.0" },
  agents: [
    {
      name: "Security Reviewer",
      description: "Security-focused agent",
      capabilities: ["Threat modeling", "OWASP"],
      model: "claude-sonnet-4-20250514",
      body: "Focus on vulnerabilities.",
      sourcePath: "/tmp/plugin/agents/security-reviewer.md",
    },
  ],
  commands: [
    {
      name: "workflows:plan",
      description: "Planning command",
      argumentHint: "[FOCUS]",
      model: "inherit",
      allowedTools: ["Read"],
      body: "Plan the work.",
      sourcePath: "/tmp/plugin/commands/workflows/plan.md",
    },
  ],
  skills: [
    {
      name: "existing-skill",
      description: "Existing skill",
      sourceDir: "/tmp/plugin/skills/existing-skill",
      skillPath: "/tmp/plugin/skills/existing-skill/SKILL.md",
    },
  ],
  hooks: undefined,
  mcpServers: {
    local: { command: "echo", args: ["hello"] },
  },
}

describe("convertClaudeToCodex", () => {
  test("converts commands to prompts and agents to skills", () => {
    const bundle = convertClaudeToCodex(fixturePlugin, {
      agentMode: "subagent",
      inferTemperature: false,
      permissions: "none",
    })

    expect(bundle.prompts).toHaveLength(1)
    const prompt = bundle.prompts[0]
    expect(prompt.name).toBe("workflows-plan")

    const parsedPrompt = parseFrontmatter(prompt.content)
    expect(parsedPrompt.data.description).toBe("Planning command")
    expect(parsedPrompt.data["argument-hint"]).toBe("[FOCUS]")
    expect(parsedPrompt.body).toContain("$workflows-plan")
    expect(parsedPrompt.body).toContain("Plan the work.")

    expect(bundle.skillDirs[0]?.name).toBe("existing-skill")
    expect(bundle.generatedSkills).toHaveLength(2)

    const commandSkill = bundle.generatedSkills.find((skill) => skill.name === "workflows-plan")
    expect(commandSkill).toBeDefined()
    const parsedCommandSkill = parseFrontmatter(commandSkill!.content)
    expect(parsedCommandSkill.data.name).toBe("workflows-plan")
    expect(parsedCommandSkill.data.description).toBe("Planning command")
    expect(parsedCommandSkill.body).toContain("Allowed tools")

    const agentSkill = bundle.generatedSkills.find((skill) => skill.name === "security-reviewer")
    expect(agentSkill).toBeDefined()
    const parsedSkill = parseFrontmatter(agentSkill!.content)
    expect(parsedSkill.data.name).toBe("security-reviewer")
    expect(parsedSkill.data.description).toBe("Security-focused agent")
    expect(parsedSkill.body).toContain("Capabilities")
    expect(parsedSkill.body).toContain("Threat modeling")
  })

  test("passes through MCP servers", () => {
    const bundle = convertClaudeToCodex(fixturePlugin, {
      agentMode: "subagent",
      inferTemperature: false,
      permissions: "none",
    })

    expect(bundle.mcpServers?.local?.command).toBe("echo")
    expect(bundle.mcpServers?.local?.args).toEqual(["hello"])
  })

  test("truncates generated skill descriptions to 1024 chars", () => {
    const longDescription = "a".repeat(1100)
    const plugin: ClaudePlugin = {
      ...fixturePlugin,
      agents: [
        {
          name: "Long Description Agent",
          description: longDescription,
          body: "Body",
          sourcePath: "/tmp/plugin/agents/long.md",
        },
      ],
      commands: [],
      skills: [],
    }

    const bundle = convertClaudeToCodex(plugin, {
      agentMode: "subagent",
      inferTemperature: false,
      permissions: "none",
    })

    const generated = bundle.generatedSkills[0]
    const parsed = parseFrontmatter(generated.content)
    const description = String(parsed.data.description ?? "")
    expect(description.length).toBeLessThanOrEqual(1024)
    expect(description.endsWith("...")).toBe(true)
  })
})
