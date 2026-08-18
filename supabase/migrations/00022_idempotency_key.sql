-- Migration: idempotency_key untuk check-in
-- Memperbaiki mekanisme idempotensi yang selama ini kode mati:
--   - kolom idempotency_key belum ada di check_in_transactions,
--   - edge function menanyainya tapi error-nya diabaikan,
--   - fn_check_in tidak pernah menyimpannya.
-- Dengan kolom ini, retry dengan key yang sama tidak akan membuat check-in dobel.

-- ============================================================
-- 1. Kolom + index unik parsial
-- ============================================================
ALTER TABLE check_in_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Partial unique index: hanya membatasi baris yang benar-benar membawa key.
-- Baris lama (NULL) tidak terpengaruh, sehingga backfill tidak diperlukan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkin_idempotency_key
  ON check_in_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 2. fn_check_in — terima + simpan idempotency_key, tolak duplikat
--    DROP signature lama (6 param) agar tidak jadi overload ambigu.
-- ============================================================
DROP FUNCTION IF EXISTS public.fn_check_in(UUID, UUID, INTEGER, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION fn_check_in(
  p_reservation_id  UUID,
  p_admin_id        UUID,
  p_delta           INTEGER,
  p_method          TEXT,
  p_is_override     BOOLEAN DEFAULT false,
  p_notes           TEXT    DEFAULT NULL,
  p_idempotency_key TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation  reservations%ROWTYPE;
  v_current_sum  INTEGER;
  v_new_total    INTEGER;
  v_tx_id        UUID;
  v_existing     RECORD;
BEGIN
  -- Validate input
  IF p_method NOT IN ('qr', 'manual') THEN
    RETURN jsonb_build_object('error', 'Method harus qr atau manual');
  END IF;

  -- Lock the reservation row (prevents race condition)
  SELECT * INTO v_reservation
    FROM reservations
   WHERE id = p_reservation_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Reservasi tidak ditemukan');
  END IF;

  -- Idempotency: jika key pernah dipakai, kembalikan transaksi yang sudah ada
  -- tanpa menambah baris baru. Lock reservasi di atas menjamin dua retry dengan
  -- key sama tidak saling menimpa.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, delta, method, is_override, notes, created_at
      INTO v_existing
      FROM check_in_transactions
     WHERE idempotency_key = p_idempotency_key
     LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'transaction_id', v_existing.id,
        'reservation_id', p_reservation_id,
        'guest_name', v_reservation.name,
        'delta', v_existing.delta,
        'method', v_existing.method,
        'is_override', v_existing.is_override,
        'created_at', v_existing.created_at
      );
    END IF;
  END IF;

  -- Calculate current total
  SELECT COALESCE(SUM(delta), 0) INTO v_current_sum
    FROM check_in_transactions
   WHERE reservation_id = p_reservation_id;

  v_new_total := v_current_sum + p_delta;

  -- Validation 1: total tidak boleh negatif
  IF v_new_total < 0 THEN
    RETURN jsonb_build_object(
      'error', 'Jumlah check-in tidak valid: total menjadi ' || v_new_total,
      'current_checked_in', v_current_sum,
      'guest_count', v_reservation.guest_count
    );
  END IF;

  -- Validation 2: tidak boleh melebihi guest_count (kecuali override)
  IF v_new_total > v_reservation.guest_count AND NOT p_is_override THEN
    RETURN jsonb_build_object(
      'error', 'Jumlah melebihi kuota (' || v_current_sum || '/' || v_reservation.guest_count || '). Gunakan override.',
      'needs_override', true,
      'current_checked_in', v_current_sum,
      'guest_count', v_reservation.guest_count
    );
  END IF;

  -- Validation 3: override wajib notes
  IF p_is_override AND (p_notes IS NULL OR TRIM(p_notes) = '') THEN
    RETURN jsonb_build_object('error', 'Notes wajib diisi untuk override kuota');
  END IF;

  -- INSERT the transaction (immutable ledger)
  BEGIN
    INSERT INTO check_in_transactions (
      reservation_id, admin_id, delta, method, is_override, notes, idempotency_key
    ) VALUES (
      p_reservation_id, p_admin_id, p_delta, p_method, p_is_override, p_notes, p_idempotency_key
    )
    RETURNING id INTO v_tx_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Jaring pengaman: retry konkuren dengan key sama menang race ke INSERT.
      SELECT id, delta, method, is_override, notes, created_at
        INTO v_existing
        FROM check_in_transactions
       WHERE idempotency_key = p_idempotency_key
       LIMIT 1;
      IF FOUND THEN
        RETURN jsonb_build_object(
          'success', true,
          'idempotent', true,
          'transaction_id', v_existing.id,
          'reservation_id', p_reservation_id,
          'guest_name', v_reservation.name,
          'delta', v_existing.delta,
          'method', v_existing.method,
          'is_override', v_existing.is_override,
          'created_at', v_existing.created_at
        );
      END IF;
      RAISE;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'reservation_id', p_reservation_id,
    'guest_name', v_reservation.name,
    'previous_checked_in', v_current_sum,
    'new_checked_in', v_new_total,
    'guest_count', v_reservation.guest_count,
    'delta', p_delta,
    'is_override', p_is_override
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- ============================================================
-- 3. Grant ulang (function baru = signature baru, butuh grant fresh)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.fn_check_in(UUID, UUID, INTEGER, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_in(UUID, UUID, INTEGER, TEXT, BOOLEAN, TEXT, TEXT) TO service_role;
