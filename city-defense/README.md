# City Defense

Browser-based medieval city defense strategy game. Survive a siege without losing the city, running out of food, or letting your citizens revolt.

See `/root/.claude/plans/i-going-to-ask-magical-anchor.md` for the full design and implementation plan.

## Running locally

```bash
npm install
npm run dev
```

Then open the dev server URL printed in the terminal.

## Layout

```
src/
  main.ts          # bootstrap
  setup/           # pre-game general + army picker
  engine/          # fixed-timestep loop, RNG, input, time
  world/           # World aggregate, tilemap, pathfinding
  ecs/             # entity/component stores
  systems/         # food, morale, military, enemy, events, victory, ...
  render/          # canvas pipeline, camera, sprites, layers
  ui/              # DOM overlay (HUD, panels, modals)
  data/            # generals, buildings, units, events, requests, config
  save/            # serialize ↔ JSON, schema migrations
```
