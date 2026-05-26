import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getPlayers, importMatchCsv,
    type ImportMatchPlayerRow, type Match, type Player,
} from '../../services/api';

interface AdminImportMatchModalProps {
    match: Match;
    onClose: () => void;
}

const REQUIRED_COLS = ['side', 'player_name'] as const;

const STAT_COLS = [
    'jersey_number', 'position',
    'passing_attempts', 'rushing_attempts', 'completed_passes',
    'passing_tds', 'rushing_tds', 'interceptions_thrown',
    'receptions', 'receiving_tds', 'extra_points_tds', 'drops',
    'flag_pulls', 'pass_deflections', 'interceptions',
    'defensive_tds', 'safety', 'qb_sacks', 'def_sacks',
] as const;

const NUMERIC_COLS = new Set<string>([
    'jersey_number',
    'passing_attempts', 'rushing_attempts', 'completed_passes',
    'passing_tds', 'rushing_tds', 'interceptions_thrown',
    'receptions', 'receiving_tds', 'extra_points_tds', 'drops',
    'flag_pulls', 'pass_deflections', 'interceptions',
    'defensive_tds', 'safety', 'qb_sacks', 'def_sacks',
]);

// RFC 4180-ish CSV parser: handles quoted fields, embedded commas/newlines, escaped "".
const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += c;
            }
        } else {
            if (c === '"') inQuotes = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                if (row.some(v => v.trim() !== '')) rows.push(row);
                row = [];
            } else field += c;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        if (row.some(v => v.trim() !== '')) rows.push(row);
    }
    return rows;
};

interface ParsedRow {
    rowNum: number; // 1-based, header excluded
    raw: Record<string, string>;
    row: ImportMatchPlayerRow;
    errors: string[];
}

interface ParseOutcome {
    rows: ParsedRow[];
    errors: string[];
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_');

const parseCsvToRows = (text: string): ParseOutcome => {
    const grid = parseCsv(text);
    if (grid.length < 2) return { rows: [], errors: ['CSV must have a header row and at least one data row'] };

    const header = grid[0].map(normalize);
    const headerIdx: Record<string, number> = {};
    header.forEach((h, i) => { headerIdx[h] = i; });

    const errors: string[] = [];
    for (const req of REQUIRED_COLS) {
        if (!(req in headerIdx)) errors.push(`Missing required column: ${req}`);
    }
    if (errors.length) return { rows: [], errors };

    const out: ParsedRow[] = [];
    for (let i = 1; i < grid.length; i++) {
        const cells = grid[i];
        const raw: Record<string, string> = {};
        for (const [col, idx] of Object.entries(headerIdx)) raw[col] = (cells[idx] ?? '').trim();

        const rowErrors: string[] = [];
        const side = raw.side?.toLowerCase();
        if (side !== 'home' && side !== 'away') rowErrors.push(`side must be "home" or "away" (got "${raw.side}")`);
        if (!raw.player_name) rowErrors.push('player_name is required');

        const row: ImportMatchPlayerRow = {
            side: side as 'home' | 'away',
            player_name: raw.player_name,
            position: raw.position || undefined,
        };
        for (const col of STAT_COLS) {
            if (!(col in headerIdx)) continue;
            const v = raw[col];
            if (v === '' || v === undefined) continue;
            if (NUMERIC_COLS.has(col)) {
                const n = parseInt(v, 10);
                if (Number.isNaN(n)) { rowErrors.push(`${col} is not a number (got "${v}")`); continue; }
                (row as any)[col] = n;
            } else {
                (row as any)[col] = v;
            }
        }

        out.push({ rowNum: i, raw, row, errors: rowErrors });
    }
    return { rows: out, errors: [] };
};

export const AdminImportMatchModal = ({ match, onClose }: AdminImportMatchModalProps) => {
    const queryClient = useQueryClient();
    const [csvText, setCsvText] = useState('');
    const [parseResult, setParseResult] = useState<ParseOutcome | null>(null);

    const homeTeamId = match.home_team?.id;
    const awayTeamId = match.away_team?.id;

    // Pull roster for each team so we can highlight matched vs to-be-created.
    const { data: homeRoster } = useQuery({
        queryKey: ['players', homeTeamId, 'roster-all'],
        queryFn: () => getPlayers(homeTeamId, 1, 500),
        enabled: !!homeTeamId,
    });
    const { data: awayRoster } = useQuery({
        queryKey: ['players', awayTeamId, 'roster-all'],
        queryFn: () => getPlayers(awayTeamId, 1, 500),
        enabled: !!awayTeamId,
    });

    const rosterIndex = useMemo(() => {
        const idx: Record<string, Set<string>> = { home: new Set(), away: new Set() };
        (homeRoster?.data || []).forEach((p: Player) => idx.home.add(p.name.trim().toLowerCase()));
        (awayRoster?.data || []).forEach((p: Player) => idx.away.add(p.name.trim().toLowerCase()));
        return idx;
    }, [homeRoster, awayRoster]);

    const handleFile = async (file: File | null) => {
        if (!file) return;
        const text = await file.text();
        setCsvText(text);
        setParseResult(parseCsvToRows(text));
    };

    const handleTextParse = () => {
        setParseResult(parseCsvToRows(csvText));
    };

    const importMutation = useMutation({
        mutationFn: async () => {
            if (!parseResult) throw new Error('Parse the CSV first');
            const rows = parseResult.rows.map(r => r.row);
            return importMatchCsv(match.id, rows);
        },
        onSuccess: (result) => {
            toast.success(
                `Imported: ${result.sheet_rows} sheet rows, ${result.stat_rows} stat rows. ` +
                `${result.players_created} new players, ${result.players_matched} matched.`,
            );
            queryClient.invalidateQueries({ queryKey: ['adminTeamSheet', match.id] });
            queryClient.invalidateQueries({ queryKey: ['players'] });
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || err.message || 'Import failed');
        },
    });

    const totalRowErrors = parseResult?.rows.reduce((n, r) => n + r.errors.length, 0) ?? 0;
    const canImport =
        parseResult &&
        parseResult.errors.length === 0 &&
        parseResult.rows.length > 0 &&
        totalRowErrors === 0 &&
        !importMutation.isPending;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-sffl-navy dark:text-white">Import Match CSV</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {match.home_team?.short_name} vs {match.away_team?.short_name} · {match.date?.split('T')[0]}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-1">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-5 overflow-y-auto flex-1 space-y-5">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl p-4 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                        <p className="font-bold mb-1">CSV format — one row per player per match:</p>
                        <p className="font-mono text-[11px] break-all">
                            <strong>required:</strong> side, player_name<br />
                            <strong>optional:</strong> jersey_number, position, passing_attempts, rushing_attempts, completed_passes, passing_tds, rushing_tds, interceptions_thrown, receptions, receiving_tds, extra_points_tds, drops, flag_pulls, pass_deflections, interceptions, defensive_tds, safety, qb_sacks, def_sacks
                        </p>
                        <p className="mt-2">
                            <code>side</code> must be exactly <code>home</code> or <code>away</code>. New players get auto-created in the team they're listed for.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                            Upload CSV file
                        </label>
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={e => handleFile(e.target.files?.[0] ?? null)}
                            className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-sffl-navy file:text-white hover:file:bg-sffl-navy-light file:cursor-pointer"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                            …or paste CSV
                        </label>
                        <textarea
                            value={csvText}
                            onChange={e => setCsvText(e.target.value)}
                            rows={6}
                            placeholder="side,player_name,jersey_number,position,passing_tds,..."
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none"
                        />
                        <button
                            onClick={handleTextParse}
                            disabled={!csvText.trim()}
                            className="mt-2 px-3 py-1.5 bg-sffl-navy text-white text-xs font-bold rounded-lg hover:bg-sffl-navy-light transition-colors disabled:opacity-50"
                        >
                            Parse Preview
                        </button>
                    </div>

                    {parseResult && parseResult.errors.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
                            <p className="font-bold mb-1">CSV header errors:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                {parseResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}

                    {parseResult && parseResult.errors.length === 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Preview ({parseResult.rows.length} rows)
                                </label>
                                {totalRowErrors > 0 && (
                                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                                        {totalRowErrors} row error{totalRowErrors === 1 ? '' : 's'} — fix before import
                                    </span>
                                )}
                            </div>
                            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-[10px] uppercase font-bold">
                                        <tr>
                                            <th className="px-3 py-2 text-left">#</th>
                                            <th className="px-3 py-2 text-left">Side</th>
                                            <th className="px-3 py-2 text-left">Player</th>
                                            <th className="px-3 py-2 text-left">Status</th>
                                            <th className="px-3 py-2 text-left">Pos / #</th>
                                            <th className="px-3 py-2 text-right">PassTD</th>
                                            <th className="px-3 py-2 text-right">RushTD</th>
                                            <th className="px-3 py-2 text-right">RecTD</th>
                                            <th className="px-3 py-2 text-right">FlagP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {parseResult.rows.map(pr => {
                                            const sideKey = pr.row.side as 'home' | 'away';
                                            const matched = sideKey && rosterIndex[sideKey]?.has(pr.row.player_name?.trim().toLowerCase());
                                            return (
                                                <tr key={pr.rowNum} className={pr.errors.length ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                                                    <td className="px-3 py-1.5 text-gray-400">{pr.rowNum}</td>
                                                    <td className="px-3 py-1.5 font-semibold text-gray-700 dark:text-gray-300 uppercase">{pr.row.side}</td>
                                                    <td className="px-3 py-1.5 font-semibold text-gray-900 dark:text-white">{pr.row.player_name}</td>
                                                    <td className="px-3 py-1.5">
                                                        {pr.errors.length > 0 ? (
                                                            <span className="text-red-600 dark:text-red-400 font-bold" title={pr.errors.join('; ')}>{pr.errors.length} error{pr.errors.length === 1 ? '' : 's'}</span>
                                                        ) : matched ? (
                                                            <span className="inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 font-bold">existing</span>
                                                        ) : (
                                                            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-bold">will create</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{pr.row.position || '—'} {pr.row.jersey_number ? `#${pr.row.jersey_number}` : ''}</td>
                                                    <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">{pr.row.passing_tds ?? 0}</td>
                                                    <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">{pr.row.rushing_tds ?? 0}</td>
                                                    <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">{pr.row.receiving_tds ?? 0}</td>
                                                    <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">{pr.row.flag_pulls ?? 0}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {parseResult.rows.some(r => r.errors.length > 0) && (
                                <div className="mt-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-xl p-3 text-xs text-red-700 dark:text-red-300 space-y-0.5 max-h-32 overflow-y-auto">
                                    {parseResult.rows.filter(r => r.errors.length > 0).map(r => (
                                        <div key={r.rowNum}><strong>Row {r.rowNum}:</strong> {r.errors.join('; ')}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                        {parseResult ? `${parseResult.rows.length} rows · ${parseResult.rows.filter(r => r.errors.length === 0).length} valid` : 'No CSV parsed yet'}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 min-h-[40px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all">Close</button>
                        <button
                            onClick={() => importMutation.mutate()}
                            disabled={!canImport}
                            className="px-5 py-2 min-h-[40px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {importMutation.isPending ? 'Importing…' : 'Confirm Import'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
