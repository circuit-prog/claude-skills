import type { World, NotableRequest } from '../world/world.ts';
import { findTemplate } from '../data/requests.ts';
import type { RequestEffect } from '../data/requests.ts';
import { pendingRequests } from '../systems/requests.ts';

export interface InboxCallbacks {
  onAccept(requestId: string): void;
  onDecline(requestId: string): void;
}

export interface RequestInbox {
  root: HTMLElement;
  update(world: World): void;
}

export function mountRequestInbox(cb: InboxCallbacks): RequestInbox {
  const root = document.createElement('div');
  root.style.cssText = `
    position: absolute; right: 1rem; top: 4rem; bottom: 5rem;
    width: 19rem; display: flex; flex-direction: column; gap: 0.5rem;
    overflow-y: auto; pointer-events: auto;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    color: #d4a050; font-size: 0.85rem; text-transform: uppercase;
    letter-spacing: 0.05em; padding: 0.3rem 0.5rem;
    background: rgba(0,0,0,0.75); border: 1px solid #3a2a1a;
  `;
  header.textContent = 'Requests';
  root.append(header);

  const list = document.createElement('div');
  list.style.cssText = 'display: flex; flex-direction: column; gap: 0.4rem;';
  root.append(list);

  return {
    root,
    update(world) {
      const reqs = pendingRequests(world);
      header.textContent = reqs.length === 0 ? 'Requests (none)' : `Requests (${reqs.length})`;

      const seen = new Set<string>();
      // Re-render rather than diff; the list is tiny.
      list.innerHTML = '';
      for (const r of reqs) {
        list.append(renderRequest(world, r, cb));
        seen.add(r.id);
      }
    },
  };
}

function renderRequest(world: World, r: NotableRequest, cb: InboxCallbacks): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = `
    background: rgba(20,15,10,0.92); border: 1px solid #5a4530;
    padding: 0.55rem 0.7rem; display: flex; flex-direction: column; gap: 0.3rem;
    font-size: 0.82rem;
  `;

  const tmpl = findTemplate(r.templateId);
  const title = document.createElement('div');
  title.style.cssText = 'color:#d4a050; font-weight:bold; font-size:0.9rem;';
  title.textContent = tmpl?.title ?? 'Request';

  const body = document.createElement('div');
  body.style.cssText = 'color:#c0b090; line-height: 1.35;';
  body.textContent = r.description;

  const daysLeft = Math.max(0, r.deadlineDay - world.day);
  const meta = document.createElement('div');
  meta.style.cssText = 'font-size: 0.75rem; color:#9a8e74; display:flex; justify-content: space-between;';
  meta.innerHTML = `
    <span>${daysLeft} day${daysLeft === 1 ? '' : 's'} left</span>
    <span style="color:${r.status === 'accepted' ? '#90c090' : '#b09060'}">${labelFor(r.status)}</span>
  `;

  card.append(title, body, meta);

  if (tmpl?.acceptCost) {
    const cost = document.createElement('div');
    cost.style.cssText = 'color:#e08060; font-size: 0.75rem;';
    cost.textContent = 'Cost: ' + formatEffect(tmpl.acceptCost);
    card.append(cost);
  }
  if (tmpl) {
    const reward = document.createElement('div');
    reward.style.cssText = 'color:#90c090; font-size: 0.75rem;';
    reward.textContent = 'Reward: ' + formatEffect(tmpl.acceptReward);
    card.append(reward);
  }

  if (r.status === 'pending') {
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex; gap:0.4rem; margin-top: 0.2rem;';
    const accept = makeButton(tmpl?.kind === 'task' ? 'Pledge' : 'Accept', '#5a4530', () => cb.onAccept(r.id));
    const decline = makeButton('Decline', '#3a2a1a', () => cb.onDecline(r.id));
    buttons.append(accept, decline);
    card.append(buttons);
  }

  return card;
}

function makeButton(label: string, bg: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `
    flex: 1; background: ${bg}; color: #f0e4c8; border: 1px solid #8a6a45;
    padding: 0.3rem 0.5rem; cursor: pointer; font-family: inherit; font-size: 0.8rem;
  `;
  b.addEventListener('click', onClick);
  return b;
}

function labelFor(status: NotableRequest['status']): string {
  switch (status) {
    case 'pending':   return 'awaiting reply';
    case 'accepted':  return 'pledged';
    case 'fulfilled': return 'done';
    case 'refused':   return 'refused';
    case 'expired':   return 'expired';
  }
}

function formatEffect(e: RequestEffect): string {
  const parts: string[] = [];
  if (e.food) parts.push(`${signed(e.food)} food`);
  if (e.gold) parts.push(`${signed(e.gold)} gold`);
  if (e.wood) parts.push(`${signed(e.wood)} wood`);
  if (e.stone) parts.push(`${signed(e.stone)} stone`);
  if (e.loyalty) {
    parts.push(`${signed(e.loyalty.selfDelta)} loyalty`);
    if (e.loyalty.othersDelta) parts.push(`${signed(e.loyalty.othersDelta)} others`);
  }
  if (e.moraleDelta) parts.push(`${signed(e.moraleDelta)} morale`);
  return parts.join(', ') || '—';
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
