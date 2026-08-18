import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSessionUser } from '@/lib/session';
import { buildExport, ExportType } from '@/lib/exports';

const VALID_TYPES: ExportType[] = ['arrives', 'absents', 'partiels', 'supplementaires', 'repartition', 'reserve'];

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))];
  return '﻿' + lines.join('\n'); // BOM pour Excel
}

export async function GET(req: NextRequest) {
  const user = getSessionUser();
  if (!user || (user.role !== 'admin' && user.role !== 'placeur')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') as ExportType | null;
  const format = (searchParams.get('format') || 'csv').toLowerCase();

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'type invalide' }, { status: 400 });
  }
  if (!['csv', 'xlsx'].includes(format)) {
    return NextResponse.json({ error: 'format invalide' }, { status: 400 });
  }

  const sheet = await buildExport(user.event_id, type);

  if (format === 'csv') {
    const csv = toCsv(sheet.headers, sheet.rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${sheet.filename}.csv"`,
      },
    });
  }

  const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${sheet.filename}.xlsx"`,
    },
  });
}
