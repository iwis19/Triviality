# Triviality 🧠

Combining autonomous research agents, mathematical search, and formal verification into a single research workspace to solve the unsolved!

---

## Repository Note

Built at **Hack the North 2026** on 4h of sleep:
- Best Use of Vultr 
- 2nd Best Use of Devin

Checkout the Devpost submission: [click](https://devpost.com/software/rbc-buddies?ref_content=user-portfolio&ref_feature=in_progress)

---

## Key Features

1. **Multi-Agent Mathematical Research**
   - openJiuwen WorkSwarm supports separate research agent branches in parallel during exploration
   - Coordinates 3 researchers, 1 challenger, 1 coordinator, and 1 proof-writer agent
   - Supports fresh research directions after getting stuck or realizing failure

2. **Formal Proof Verification**
   - Candidate proofs are checked using Lean rather than accepted directly from challenger outputs
   - Lean feedback is returned to the research workflow for further refinement
   - Challenger experiment worker runs bounded exact-arithmetic searches on Vultr infrastructure to reduce forced LLM computations
   - Lean checker also runs on a Vultr-hosted VM to remove user download requirements

3. **Pre-research Knowledge Base**
   - Discovers mathematical literature through OpenAlex across 16 research areas
   - Ranks papers by citation count and stores metadata
   - Deduplicates papers and preserves source links including arXiv/PDF references
   - Generates embeddings for semantic/dense retrieval with vector search

4. **Persistent Research Infrastructure**
   - MongoDB stores research state, mathematical knowledge, graph relationships, and artifacts
   - Redis manages research projects and ingestion jobs
   - Research API creates and tracks research episodes
   - Background workers execute literature retrieval, small arithmetic experiments, and verification

---

## Tech Stack

- **TypeScript**
- **React / Next.js**
- **Node.js**
- **Python**
- **openJiuwen SwarmFlow**
- **MongoDB** + **MongoDB Atlas Vector Search**
- **Redis**
- **Lean 4**
- **OpenAlex**
- **Vultr**
- **Docker**

---

## Try It Out

The full local setup requires an unusual amount of API keys, external services, and remote compute infrastructure, so a setup instruction won't be provided... 

But check out the complete platform through our hosted deployment!
**[Try Triviality →](https://triviality-psi.vercel.app/)**

---

## Project Structure

```text
Triviality/
├── apps/
│   ├── web/
│   ├── research-api/
│   ├── research-worker/          # Research orchestration + persistence
│   │   ├── src/
│   │   └── tests/
│   ├── research-swarm/           # WorkSwarm / SwarmFlow runtime
│   ├── experiment-worker/        # Remote computational experiments
│   ├── paper-ingest/
│   ├── api-papers/
│   ├── api-auth/
│   └── api-billing/
│
├── packages/
│   ├── database/                 # MongoDB schemas + persistence
│   ├── services/
│   ├── ui/
│   └── typescript-config/
│
├── swarm-skills/
│   └── math-research/
│       ├── roles/                # Research agent definitions
│       ├── scripts/              # Workflow + Lean checking
│       ├── SKILL.md
│       └── workflow.md
│
├── backend/
│   ├── artifacts/
│   └── benchmarks/
│
├── deploy/
│   └── vm/                       # Vultr VM deployment
│
├── config/
│   └── research-models.json
│
├── docs/
├── scripts/
├── external/
│
├── docker-compose.yml            # MongoDB + Redis
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## Research Workflow

Supported by integrating Huawei openJiuwen's WorkSwarm, our research workflow looks like:

```text
Researchers
    ▼
Challenger / Iteration
    ▼
Reviewed Complete Argument
    ▼
Proof Writer
    ▼
Mathematical Proof + Lean Formalization
    ▼
Lean Checker
   ╱     ╲
 Fail    Pass
  ▼       ▼
Research  Verified Proof
Loop          ▼
        Research Worker
              ▼
        proofDocument(...)
              ▼
         LaTeX Output
```

Research episodes preserve intermediate attempts into an episode-sepcific knowledge pool and failed verifications are returned to the workflow so agents can revise or abandon the candidate.

---

## Lessons Learned

- Designing multi-agent workflows for open-ended mathematical research
- Connecting LLM-generated reasoning with deterministic computational evidence
- Integrating Lean formal verification into an autonomous research loop
- Running remote experiment and verification workloads on cloud compute

---
