# Codex Execution Plans

Use this file when implementing a complex feature, native integration, or multi-step refactor.

## What is an ExecPlan?

An ExecPlan is a living implementation document that lets another agent or developer restart the task from the repository alone.

## When to use it

Use an ExecPlan for:

- ZIP extraction pipeline work.
- Share Intent integration.
- Android MediaStore / EXIF timestamp work.
- Permission model changes.
- Multi-screen UI flow changes.
- Any task likely to take more than one coding session.

## Required sections

Every ExecPlan must include:

1. Goal
2. Current state
3. Decisions already made
4. Open risks / unknowns
5. Milestones
6. Verification steps
7. Progress log
8. Final acceptance criteria

## Agent behavior

When implementing from an ExecPlan:

- Read the whole ExecPlan first.
- Update the progress log as work proceeds.
- Do not ask the user for next steps when the next milestone is clear.
- Make the smallest safe implementation that advances the plan.
- Prefer real verification over assumptions.
- Record any discovered Android behavior, library limitation, or workaround.
