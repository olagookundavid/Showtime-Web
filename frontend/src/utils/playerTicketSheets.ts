import type { PlayerTicketRow, PlayerTicketSheet } from '../types';

// Printing and exporting team sheets with each player's ticket code: the paper
// copy a team manager or ticketer takes to the gate.

const sheetDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

/** "Lions vs Eagles", home side first. */
export const playerTicketFixture = (sheet: PlayerTicketSheet) =>
    `${sheet.match.home_team || 'TBD'} vs ${sheet.match.away_team || 'TBD'}`;

/** "Sat 7 Nov 2026 · 14:30 · Showtime Arena", leaving out what is not set. */
export const playerTicketWhen = (sheet: PlayerTicketSheet) =>
    [sheetDate(sheet.match.date), sheet.match.kickoff, sheet.match.venue].filter(Boolean).join(' · ');

/** What a row's ticket means at the gate. */
export const playerTicketGateStatus = (row: PlayerTicketRow) => {
    if (!row.ticket_code) return 'No code yet';
    if (row.checked_in_at) return 'Checked in';
    return 'Not yet in';
};

const csvCell = (value: string | number) => {
    const s = String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every player on the sheets, one row each, as CSV. */
export const playerTicketSheetsCsv = (sheets: PlayerTicketSheet[]) => {
    const header = ['Date', 'Kickoff', 'Competition', 'Match', 'Team', 'Jersey', 'Player', 'Position', 'Role', 'Ticket code', 'Gate'];
    const lines = [header.map(csvCell).join(',')];
    for (const sheet of sheets) {
        for (const p of sheet.players ?? []) {
            lines.push(
                [
                    sheet.match.date,
                    sheet.match.kickoff ?? '',
                    sheet.match.competition,
                    playerTicketFixture(sheet),
                    sheet.team_name,
                    p.jersey_number || '',
                    p.name,
                    p.position,
                    p.is_starter ? 'Starter' : 'Squad',
                    p.ticket_code ?? '',
                    playerTicketGateStatus(p),
                ]
                    .map(csvCell)
                    .join(','),
            );
        }
    }
    return lines.join('\r\n');
};

/** Saves the sheets as a CSV file. */
export const downloadPlayerTicketCsv = (sheets: PlayerTicketSheet[], filename: string) => {
    // The byte-order mark makes Excel read the names as UTF-8.
    const blob = new Blob(['﻿' + playerTicketSheetsCsv(sheets)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

/** A file name made from a sheet's match and team, safe on every system. */
export const playerTicketFileName = (...parts: string[]) =>
    parts
        .join(' ')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'player-tickets';

const esc = (s: string | number) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const sheetHtml = (sheet: PlayerTicketSheet) => {
    const rows = (sheet.players ?? [])
        .map(
            (p) => `<tr>
<td class="num">${esc(p.jersey_number || '')}</td>
<td>${esc(p.name)}</td>
<td>${esc(p.position)}</td>
<td>${p.is_starter ? 'Starter' : 'Squad'}</td>
<td class="code">${esc(p.ticket_code ?? '—')}</td>
<td class="tick"></td>
</tr>`,
        )
        .join('');
    return `<section>
<h2>${esc(sheet.team_name)} <span>vs ${esc(sheet.opponent || 'TBD')}</span></h2>
<p class="meta">${esc([sheet.match.competition, playerTicketFixture(sheet), playerTicketWhen(sheet)].filter(Boolean).join(' · '))}</p>
<table>
<thead><tr><th class="num">#</th><th>Player</th><th>Position</th><th>Role</th><th>Ticket code</th><th class="tick">In</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">No players on this sheet.</td></tr>'}</tbody>
</table>
<p class="foot">${sheet.named} players · ${sheet.issued} codes issued</p>
</section>`;
};

/**
 * Opens the sheets in a print-ready window: one team per page, with a blank
 * column for the gate to tick. Returns false if the browser blocked the window.
 */
export const printPlayerTicketSheets = (sheets: PlayerTicketSheet[], title: string) => {
    const win = window.open('', '_blank');
    if (!win) return false;
    win.document.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; }
h1 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin: 0 0 16px; }
section { page-break-after: always; break-after: page; }
section:last-child { page-break-after: auto; break-after: auto; }
h2 { font-size: 22px; margin: 0 0 4px; }
h2 span { font-weight: 400; color: #475569; }
.meta { margin: 0 0 14px; color: #334155; font-size: 13px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: left; }
th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
.num { width: 36px; text-align: center; }
.code { font-family: 'Courier New', monospace; font-weight: 700; letter-spacing: 1px; white-space: nowrap; }
.tick { width: 44px; }
.foot { color: #64748b; font-size: 12px; margin-top: 8px; }
</style></head>
<body><h1>${esc(title)}</h1>${sheets.map(sheetHtml).join('')}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    return true;
};
