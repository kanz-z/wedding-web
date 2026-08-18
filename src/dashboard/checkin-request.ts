// src/dashboard/checkin-request.ts — satu jalur POST /check-in
// Membuat idempotency_key SEKALI per aksi logis, lalu memakainya ulang pada
// retry otomatis untuk respons ambigu (jaringan putus / 5xx / body kosong).
// Ini mencegah check-in dobel saat operator scan ulang setelah sinyal hilang.

export interface CheckInBody {
  reservation_id: string;
  delta: number;
  method: "qr" | "manual";
  is_override?: boolean;
  notes?: string | null;
}

export interface CheckInHttpResult {
  status: number;
  result: Record<string, unknown>;
}

const MAX_ATTEMPTS = 3;

export async function postCheckIn(
  body: CheckInBody,
  token: string,
): Promise<CheckInHttpResult> {
  const idempotencyKey = crypto.randomUUID();
  const url = `${import.meta.env.VITE_CHECK_IN_EDGE_FUNCTION}/check-in`;

  // status 0 = tidak pernah mendapat respons (semua attempt fetch reject)
  let last: CheckInHttpResult = { status: 0, result: {} };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...body, idempotency_key: idempotencyKey }),
      });

      let result: Record<string, unknown>;
      try {
        result = await resp.json();
      } catch {
        // Body kosong/rusak — ambigu (server bisa mati di tengah). Retry.
        if (attempt < MAX_ATTEMPTS) continue;
        last = { status: resp.status, result: {} };
        break;
      }

      last = { status: resp.status, result };

      // 2xx sukses / 4xx gagal definitif → tidak di-retry
      if (resp.ok || resp.status < 500) {
        return last;
      }
      // 5xx → ambigu, coba lagi dengan key yang sama
    } catch {
      // fetch reject (jaringan) → ambigu, coba lagi
      if (attempt < MAX_ATTEMPTS) continue;
      break;
    }
  }

  return last;
}
