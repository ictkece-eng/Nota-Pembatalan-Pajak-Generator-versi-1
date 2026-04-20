import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

export async function GET() {
  try {
    await initDb();
    const db = await getDb();
    const [rows] = await db.execute('SELECT * FROM nota_pajak ORDER BY created_at DESC LIMIT 50');
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const data = await request.json();
    const db = await getDb();
    
    const [result] = await db.execute(
      `INSERT INTO nota_pajak (
        nomor, faktur_nomor, faktur_tanggal, 
        penerima_name, penerima_address, penerima_npwp,
        pemberi_name, pemberi_address, pemberi_npwp,
        items, tanggal_dokumen, penandatangan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nomor,
        data.fakturNomor,
        data.fakturTanggal,
        data.penerima.name,
        data.penerima.address,
        data.penerima.npwp,
        data.pemberi.name,
        data.pemberi.address,
        data.pemberi.npwp,
        JSON.stringify(data.items),
        data.tanggalDokumen,
        data.penandatangan
      ]
    );
    
    return NextResponse.json({ id: (result as any).insertId });
  } catch (error: any) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
