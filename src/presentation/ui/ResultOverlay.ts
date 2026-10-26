import { Container } from 'pixi.js';
import { SLOT_COLORS, TEAM_COLORS, UI } from '../../data/palette.ts';
import type { MatchResult } from '../../shared/types.ts';
import type { PixelFont } from './PixelFont.ts';
import { Button, label, rect } from './widgets.ts';

export class ResultOverlay {
  readonly root = new Container();
  private readonly font: PixelFont;

  constructor(font: PixelFont) {
    this.font = font;
    this.root.visible = false;
  }

  hide(): void {
    this.root.visible = false;
  }

  show(
    r: MatchResult,
    names: readonly string[],
    vw: number,
    vh: number,
    replayNote: string,
    onReplay?: () => void,
    onEditor?: () => void,
  ): void {
    for (const c of this.root.removeChildren()) c.destroy({ children: true });
    const cx = Math.floor(vw / 2);
    this.root.addChild(rect(0x000000, vw, vh, 0, 0, 0.62));
    const order = [...r.scores].sort((a, b) => b.points - a.points || a.slot - b.slot);
    const h = r.highlights;
    const lines: string[] = [];
    if (h.topCatcher >= 0) lines.push(`TOP CATCHER: ${names[h.topCatcher]!.toUpperCase()} (${r.catches[h.topCatcher]})`);
    if (h.mostStuns >= 0) lines.push(`MOST STUNS: ${names[h.mostStuns]!.toUpperCase()} (${r.stuns[h.mostStuns]})`);
    if (h.biggestSwing !== null) lines.push(`BIGGEST SWING: ${names[h.biggestSwing.slot]!.toUpperCase()} +${h.biggestSwing.points}`);

    // If more than 6 participants, display scores in 2 compact columns to prevent overflowing the screen
    const twoCol = order.length > 6;
    const scoreRows = twoCol ? Math.ceil(order.length / 2) : order.length;
    const totalH = 16 + (r.overtime ? 8 : 0) + 4 + scoreRows * 7.5 + 4 + lines.length * 7 + 6 + 14 + (replayNote !== '' ? 14 : 0);
    let y = Math.max(4, Math.floor((vh - totalH) / 2));

    const isTag = r.mode === 'tag_team';
    let title = r.draw ? 'DRAW!' : `${names[r.winnerSlot]!.toUpperCase()} WINS!`;
    let titleColor = SLOT_COLORS[r.winnerSlot % SLOT_COLORS.length]!;
    if (isTag) {
      if (r.draw || r.winningTeam === -1) {
        title = 'TAG TEAM DRAW!';
        titleColor = UI.accent;
      } else if (r.winningTeam === 0) {
        title = 'TEAM RED WINS!';
        titleColor = TEAM_COLORS.red;
      } else {
        title = 'TEAM BLUE WINS!';
        titleColor = TEAM_COLORS.blue;
      }
    }

    const t = label(this.font, title, cx, y, titleColor, 'center');
    t.scale.set(2);
    this.root.addChild(t);
    y += 16;
    if (isTag && r.teamScores) {
      this.root.addChild(label(this.font, `RED: ${r.teamScores[0]} PTS   BLUE: ${r.teamScores[1]} PTS`, cx, y, UI.accent, 'center'));
      y += 8;
    }
    if (r.overtime) { this.root.addChild(label(this.font, 'DECIDED IN OVERTIME', cx, y, UI.accent, 'center')); y += 8; }
    y += 4;

    if (twoCol) {
      const half = Math.ceil(order.length / 2);
      const startY = y;
      order.forEach((s, i) => {
        const col = i < half ? 0 : 1;
        const row = i < half ? i : i - half;
        const colX = col === 0 ? cx - 74 : cx + 8;
        const rowY = startY + row * 7;
        this.root.addChild(rect(SLOT_COLORS[s.slot % SLOT_COLORS.length]!, 4, 5, colX, rowY));
        this.root.addChild(label(this.font, names[s.slot]!.toUpperCase().slice(0, 7), colX + 6, rowY, UI.text));
        this.root.addChild(label(this.font, String(s.points), colX + 66, rowY, UI.text, 'right'));
      });
      y += half * 7;
    } else {
      for (const s of order) {
        this.root.addChild(rect(SLOT_COLORS[s.slot % SLOT_COLORS.length]!, 4, 5, cx - 40, y));
        this.root.addChild(label(this.font, names[s.slot]!.toUpperCase().slice(0, 8), cx - 33, y, UI.text));
        this.root.addChild(label(this.font, String(s.points), cx + 40, y, UI.text, 'right'));
        y += 7.5;
      }
    }
    y += 5;

    for (const l of lines) { this.root.addChild(label(this.font, l, cx, y, UI.dim, 'center')); y += 7; }
    y += 5;

    if (onReplay && onEditor) {
      const replayBtn = new Button(this.font, 'REPLAY [R]', cx - 58, y, 54, 12, onReplay);
      const editorBtn = new Button(this.font, 'EDITOR [ESC]', cx + 4, y, 54, 12, onEditor);
      this.root.addChild(replayBtn, editorBtn);
    } else {
      this.root.addChild(label(this.font, 'R REPLAY   ESC EDITOR', cx, y, UI.accent, 'center'));
    }

    if (replayNote !== '') this.root.addChild(label(this.font, replayNote, cx, y + 14, replayNote.includes('OK') ? UI.good : UI.bad, 'center'));
    this.root.visible = true;
  }
}
