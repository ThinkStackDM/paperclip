import { createDb, agents, companies, routines, heartbeatRuns, issues } from "@paperclipai/db";
import { eq } from "drizzle-orm";

async function main() {
  const db = createDb("postgres://paperclip:paperclip@127.0.0.1:54329/paperclip");

  console.log("=== Fetching Dastardly Print Company ===");
  const dpCompanyId = "e7507bfa-ecfd-4dde-bd2a-7b19947ffdde";
  const comps = await db.select().from(companies).where(eq(companies.id, dpCompanyId));
  if (comps.length === 0) {
    console.log("Dastardly Print company not found by ID.");
    return;
  }
  const comp = comps[0];
  console.log(`Company: ${comp.name} (${comp.id})`);

  console.log("\n=== Fetching DP Agents ===");
  const dpAgents = await db.select().from(agents).where(eq(agents.companyId, dpCompanyId));
  console.log(`Found ${dpAgents.length} agents:`);
  for (const agent of dpAgents) {
    console.log(`- [${agent.id}] ${agent.name} (Role: ${agent.role}, Status: ${agent.status}, Adapter: ${agent.adapterType})`);
  }

  console.log("\n=== Fetching DP Routines ===");
  const dpRoutines = await db.select().from(routines).where(eq(routines.companyId, dpCompanyId));
  console.log(`Found ${dpRoutines.length} routines:`);
  for (const r of dpRoutines) {
    console.log(`- [${r.id}] ${r.title} (Status: ${r.status})`);
  }

  console.log("\n=== Fetching DP Open Issues ===");
  const dpIssues = await db.select().from(issues).where(eq(issues.companyId, dpCompanyId));
  const openIssues = dpIssues.filter(i => i.status !== "done" && i.status !== "cancelled");
  console.log(`Found ${openIssues.length} open issues (out of ${dpIssues.length} total):`);
  for (const i of openIssues) {
    console.log(`- [${i.identifier}] ${i.title} (Status: ${i.status}, Assignee: ${i.assigneeAgentId})`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
