-- Migration: Fase 5 — Edge Function /check-in SQL backend
-- Task 5.3: Database function untuk atomic check-in dengan SELECT FOR UPDATE

-- ============================================================
-- fn_check_in: Atomic check-in transaction
-- Validasi: new >= 0, new <= guest_count (atau override)
-- Override: is_override = true + notes wajib
-- ============================================================

CREATE OR REPLACE FUNCTION fn_check_in(
  p_reservation_id UUID,
  p_admin_id       UUID,
  p_delta          INTEGER,
  p_method         TEXT,
  p_is_override    BOOLEAN DEFAULT false,
  p_notes          TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation  reservations%ROWTYPE;
  v_current_sum  INTEGER;
  v_new_total    INTEGER;
  v_tx_id        UUID;
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
  INSERT INTO check_in_transactions (
    reservation_id, admin_id, delta, method, is_override, notes
  ) VALUES (
    p_reservation_id, p_admin_id, p_delta, p_method, p_is_override, p_notes
  )
  RETURNING id INTO v_tx_id;

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
