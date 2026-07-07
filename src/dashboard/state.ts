// src/dashboard/state.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { GuestbookFilter } from '../types/common';

const sb: SupabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

/** Type untuk item activity feed (overview) */
interface ActItem {
  _type: 'rsvp' | 'gb';
  nama: string;
  status?: string;
  jumlah_hadir?: number;
  pesan?: string;
  created_at: string;
  is_approved?: boolean;
}

/** Type untuk state dashboard */
export interface DashboardState {
  dashboardSb: SupabaseClient;
  currentUser: { email: string } | null;
  toastTimer: ReturnType<typeof setTimeout> | null;

  loginScreen: HTMLElement | null;
  dashScreen: HTMLElement | null;
  loginForm: HTMLElement | null;
  loginError: HTMLElement | null;
  loginSubmit: HTMLElement | null;
  whoEmail: HTMLElement | null;
  toastEl: HTMLElement | null;
  sideNav: HTMLElement | null;
  overlay: HTMLElement | null;
  hamburger: HTMLElement | null;

  allTamu: unknown[];
  tamuFilter: string;
  tamuSearch: string;

  allGb: unknown[];
  gbFilter: string;

  html5QrScanner: unknown | null;

  selectedTamu: Record<string, boolean>;

  _cancelDownload: boolean;
  _actItems: ActItem[];
  _actPage: number;
  _actPageSize: number;
  _prevPending: number;
}

export const state: DashboardState = {
  dashboardSb: sb,
  currentUser: null,
  toastTimer: null,

  loginScreen: document.getElementById('login-screen'),
  dashScreen: document.getElementById('dashboard-screen'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  loginSubmit: document.getElementById('login-submit'),
  whoEmail: document.getElementById('who-email'),
  toastEl: document.getElementById('toast'),
  sideNav: document.getElementById('sideNav'),
  overlay: document.getElementById('overlay'),
  hamburger: document.getElementById('hamburger'),

  allTamu: [],
  tamuFilter: 'all',
  tamuSearch: '',

  allGb: [],
  gbFilter: 'all',

  html5QrScanner: null,

  selectedTamu: {},

  _cancelDownload: false,
  _actItems: [],
  _actPage: 0,
  _actPageSize: 5,
  _prevPending: 0,
};
