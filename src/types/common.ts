/** Tipe kehadiran tamu */
export type AttendanceStatus = 'hadir' | 'tidak_hadir' | 'pending';

/** Tipe filter guestbook */
export type GuestbookFilter = 'all' | 'pending' | 'approved';

/** Tipe tab di dashboard */
export type DashboardTab = 'overview' | 'tamu' | 'guestbook' | 'qr' | 'pesan' | 'admin';

/** Tipe tab import */
export type ImportTab = 'manual' | 'csv';

/** Generic wrapper untuk response API */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Konfigurasi pagination */
export interface PaginationConfig {
  container: HTMLElement | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
