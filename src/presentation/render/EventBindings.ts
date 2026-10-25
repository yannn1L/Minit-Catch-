import { SLOT_COLORS } from '../../data/palette.ts';
import type { ZzfxPlayer } from '../audio/ZzfxPlayer.ts';
import type { SimEvent } from '../../shared/types.ts';
import { spriteId } from '../../core/ids.ts';
import type { SpriteFactory } from '../sprites/SpriteFactory.ts';
import type { Vfx } from './Vfx.ts';

const ABILITY_SFX: Readonly<Record<string, string>> = { sprinter: 'dash', heavy: 'slam', magnetizer: 'magnet' };

/** Event log -> audio (never called from the simulation directly). */
export function bindAudio(ev: SimEvent, audio: ZzfxPlayer): void {
  switch (ev.t) {
    case 'pickup': audio.play('pickup'); break;
    case 'deliver': audio.play('deliver'); audio.play('scoreUp'); break;
    case 'bomb': audio.play('bomb'); break;
    case 'stun': audio.play('stun'); break;
    case 'root': audio.play('net'); break;
    case 'shield': if (ev.duration >= 0.5) audio.play('shield'); break;
    case 'lock': audio.play('lock'); break;
    case 'lure': audio.play('lure'); break;
    case 'drop': audio.play('drop'); break;
    case 'blocked': audio.play('blocked'); break;
    case 'ability': { const s = ABILITY_SFX[ev.ability]; if (s !== undefined) audio.play(s); break; }
    case 'end': audio.play('win'); break;
    default: break;
  }
}

/** Event log -> particles & floating text barks. */
export function bindVfx(
  ev: SimEvent,
  vfx: Vfx,
  sprites: SpriteFactory,
  lookupVec: (slot: number) => { x: number; y: number },
  onFloater?: (xm: number, ym: number, msg: string, color?: number) => void,
): void {
  const star = sprites.frame(spriteId('star'));
  const puff = sprites.frame(spriteId('puff'));
  switch (ev.t) {
    case 'spawn': vfx.burst(ev.x, ev.y, puff, 4, 0xffffff, 18, 0.35, 0.6); break;
    case 'pickup': { const r = lookupVec(ev.roaster); vfx.burst(r.x, r.y, star, 4, 0xffe066, 40, 0.4); break; }
    case 'deliver': {
      const c = lookupVec(ev.roaster);
      vfx.burst(c.x, c.y, star, 10, SLOT_COLORS[ev.coop % SLOT_COLORS.length]!, 70, 0.7, 1.5);
      onFloater?.(c.x, c.y, '+1 POINT!', 0x55ff55);
      break;
    }
    case 'stun': {
      const r = lookupVec(ev.roaster);
      vfx.burst(r.x, r.y, star, 6, 0xfff275, 50, 0.6);
      onFloater?.(r.x, r.y, 'IM STUNNED!', 0xff5555);
      break;
    }
    case 'root': {
      const r = lookupVec(ev.roaster);
      onFloater?.(r.x, r.y, 'NETTED!', 0x55bbff);
      break;
    }
    case 'bomb': {
      vfx.burst(ev.x, ev.y, puff, 14, 0xff8a3d, ev.radius * 16 * 3, 0.5, 2, 4);
      onFloater?.(ev.x, ev.y, 'BOOM!', 0xff7733);
      break;
    }
    case 'bombPlanted': break;
    case 'shield': {
      if (ev.duration >= 0.5) {
        const r = lookupVec(ev.roaster);
        onFloater?.(r.x, r.y, 'SHIELD UP!', 0x55ffaa);
      }
      break;
    }
    case 'blocked': {
      const r = lookupVec(ev.roaster);
      onFloater?.(r.x, r.y, 'BLOCKED!', 0xffff55);
      break;
    }
    case 'drop': {
      const r = lookupVec(ev.roaster);
      vfx.burst(ev.x, ev.y, puff, 4, 0xffffff, 40, 0.3, 0.7);
      onFloater?.(r.x, r.y, 'OUCH...', 0xff8888);
      break;
    }
    case 'lure': {
      onFloater?.(ev.x, ev.y, 'DECOY!', 0xff9ad5);
      break;
    }
    case 'lureEnd': vfx.burst(ev.x, ev.y, puff, 8, 0xff9ad5, 45, 0.4, 1); break;
    case 'ability': {
      vfx.burst(ev.x, ev.y, puff, 6, 0xbfe9ff, 55, 0.35, 1);
      const r = lookupVec(ev.roaster);
      const barks: Record<string, string> = {
        sprinter: 'DASH!',
        heavy: 'SLAM!',
        magnetizer: 'MAGNET!',
        bomber: 'TAKE THIS!',
        guardian: 'PROTECT!',
        trickster: 'TRICK!',
        saboteur: 'LOCKDOWN!',
        netter: 'NET OUT!',
      };
      const text = barks[ev.ability] ?? 'SKILL!';
      onFloater?.(r.x, r.y, text, 0xffee66);
      break;
    }
    default: break;
  }
}
