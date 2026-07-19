-- Seed data: 12 reservasi + 5 check_in_transactions
-- Mencakup edge cases: partial check-in, override, reversal

-- Admin users (dibuat dulu karena FK dari check_in_transactions)
INSERT INTO admin_users (id, email, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'ashila@rezaashila.id', 'superadmin'),
  ('00000000-0000-0000-0000-000000000002', 'reza@rezaashila.id',    'superadmin'),
  ('00000000-0000-0000-0000-000000000003', 'panitia.checkin@rezaashila.id', 'operator');

-- Reservations
INSERT INTO reservations (id, slug, qr_token, name, guest_count, kelompok, kategori, nomor_wa, approval_status, edited_status, notes, created_at, updated_at, approved_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'aufa-kanz-a82js9',     'qr_token_aufa',     'Muhammad Aufa Kanz Anindito', 3, 'Keluarga Ashila',       'keluarga', '0812-3456-7890', 'approved', 'rsvp',  NULL,                                                                     '2026-07-01 00:00:00+00', '2026-07-01 00:00:00+00', '2026-07-01 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000002', 'siti-amara-x91qe2',    'qr_token_siti',     'Siti Amara',                   1, 'Teman Kuliah Ashila',   'bukan',    '0813-2211-0098', 'approved', NULL,     NULL,                                                                     '2026-07-02 00:00:00+00', '2026-07-02 00:00:00+00', '2026-07-02 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000003', 'damar-w-k77rtz',       'qr_token_damar',    'Damar Wicaksono',              4, 'Kolega Kantor Reza',    'bukan',    '0857-7723-1190', 'approved', NULL,     NULL,                                                                     '2026-07-03 00:00:00+00', '2026-07-03 00:00:00+00', '2026-07-03 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000004', 'keluarga-danurdoro',   'qr_token_danur',    'Keluarga Danurdoro',           6, 'Keluarga Ashila',       'keluarga', '0811-9090-1122', 'approved', NULL,     NULL,                                                                     '2026-07-04 00:00:00+00', '2026-07-04 00:00:00+00', '2026-07-04 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000005', 'farah-okta-p33lmv',    'qr_token_farah',    'Farah Oktaviani',              2, 'Teman Kantor Ashila',   'bukan',    '0822-4455-6677', 'approved', NULL,     'Tolong disediakan kursi roda untuk ibu saya',                             '2026-07-05 00:00:00+00', '2026-07-05 00:00:00+00', '2026-07-05 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000006', 'bagas-nararya',        'qr_token_bagas',    'Bagas Nararya',                2, 'Sahabat Reza',          'bukan',    '0856-1230-9988', 'approved', 'admin',   NULL,                                                                     '2026-07-06 00:00:00+00', '2026-07-06 00:00:00+00', '2026-07-06 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000007', 'keluarga-andriani',    'qr_token_andri',    'Keluarga Besar Andriani',      8, 'Keluarga Reza',         'keluarga', '0813-7788-2233', 'pending',  NULL,     'Butuh konfirmasi jumlah — mungkin ada tambahan',                           '2026-07-07 00:00:00+00', '2026-07-07 00:00:00+00', NULL),
  ('10000000-0000-0000-0000-000000000008', 'nadia-kirana',         'qr_token_nadia',    'Nadia Kirana',                 2, 'Teman SMA Ashila',      'bukan',    '0819-3344-5566', 'approved', 'rsvp',    NULL,                                                                     '2026-07-08 00:00:00+00', '2026-07-08 00:00:00+00', '2026-07-08 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000009', 'yusuf-maulana',        'qr_token_yusuf',    'Yusuf Maulana',                1, 'Kolega Kantor Reza',    'bukan',    '0878-2299-4411', 'approved', NULL,     NULL,                                                                     '2026-07-09 00:00:00+00', '2026-07-09 00:00:00+00', '2026-07-09 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000010', 'intan-permatasari',    'qr_token_intan',    'Intan Permatasari',            1, 'Teman Kuliah Ashila',   'bukan',    '0812-6677-8899', 'approved', NULL,     NULL,                                                                     '2026-07-10 00:00:00+00', '2026-07-10 00:00:00+00', '2026-07-10 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000011', 'galih-prakoso',        'qr_token_galih',    'Galih Prakoso',                2, 'Sahabat Reza',          'bukan',    '0857-1122-3344', 'rejected', NULL,     'Tamu tidak bisa hadir — konfirmasi via WA',                               '2026-07-11 00:00:00+00', '2026-07-11 00:00:00+00', NULL),
  ('10000000-0000-0000-0000-000000000012', 'keluarga-hastono',     'qr_token_hastono',  'Keluarga Hastono',             5, 'Keluarga Reza',         'keluarga', '0811-2233-4455', 'approved', NULL,     'Hadir semua — titip salam untuk kedua mempelai',                           '2026-07-12 00:00:00+00', '2026-07-12 00:00:00+00', '2026-07-12 00:00:00+00');

-- Check-in transactions (edge cases)
INSERT INTO check_in_transactions (id, reservation_id, admin_id, delta, method, is_override, notes, created_at)
VALUES
  -- Aufa: full check-in (3 dari 3)
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 3, 'qr',      false, NULL,                             '2026-08-22 10:14:00+00'),

  -- Danurdoro: partial check-in 3 + override 4 (7 dari 6) — edge case: exceeded guest count
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 3, 'qr',      false, NULL,                             '2026-08-22 10:30:00+00'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 4, 'manual',  true,  'Keluarga bawa tambahan 4 orang',  '2026-08-22 11:05:00+00'),

  -- Farah: partial check-in (1 dari 2)
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 1, 'qr',      false, NULL,                             '2026-08-22 09:02:00+00'),

  -- Nadia: full check-in (2 dari 2)
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 2, 'qr',      false, NULL,                             '2026-08-22 10:41:00+00');
