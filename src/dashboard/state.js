import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

var sb = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

export var state = {
  dashboardSb: sb,
  currentUser: null,
  toastTimer: null,

  loginScreen: document.getElementById("login-screen"),
  dashScreen: document.getElementById("dashboard-screen"),
  loginForm: document.getElementById("login-form"),
  loginError: document.getElementById("login-error"),
  loginSubmit: document.getElementById("login-submit"),
  whoEmail: document.getElementById("who-email"),
  toastEl: document.getElementById("toast"),
  sideNav: document.getElementById("sideNav"),
  overlay: document.getElementById("overlay"),
  hamburger: document.getElementById("hamburger"),

  allTamu: [],
  tamuFilter: "all",
  tamuSearch: "",

  allGb: [],
  gbFilter: "all",

  html5QrScanner: null,

  selectedTamu: {},

  _cancelDownload: false,

  _actItems: [],
  _actPage: 0,
  _actPageSize: 5,

  _prevPending: 0,
};
