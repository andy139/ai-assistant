import { jobAgent } from "./jobAgent.js";
import { studyAgent } from "./studyAgent.js";
import { fitnessAgent } from "./fitnessAgent.js";
import { discordOpsAgent } from "./discordOpsAgent.js";

export interface SubAgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
}

const registry = new Map<string, SubAgentDefinition>();

function register(agent: SubAgentDefinition): void {
  registry.set(agent.name, agent);
}

register(jobAgent);
register(studyAgent);
register(fitnessAgent);
register(discordOpsAgent);

export function getSubAgent(name: string): SubAgentDefinition | undefined {
  return registry.get(name);
}

export function getAllSubAgents(): SubAgentDefinition[] {
  return Array.from(registry.values());
}
