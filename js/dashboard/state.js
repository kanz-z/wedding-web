// dashboard state & shared references

var dashboardSb = supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

var currentUser = null;
var toastTimer = null;

// dom refs
var loginScreen = document.getElementById("login-screen");
var dashScreen = document.getElementById("dashboard-screen");
var loginForm = document.getElementById("login-form");
var loginError = document.getElementById("login-error");
var loginSubmit = document.getElementById("login-submit");
var whoEmail = document.getElementById("who-email");
var toastEl = document.getElementById("toast");
var sideNav = document.getElementById("sideNav");
var overlay = document.getElementById("overlay");
var hamburger = document.getElementById("hamburger");

// tamu state
var allTamu = [];
var tamuFilter = "all";
var tamuSearch = "";

// guestbook state
var allGb = [];
var gbFilter = "all";

// QR state
var html5QrScanner = null;

// batch selection
var selectedTamu = {};

// batch download
var _cancelDownload = false;

// overview activity state
var _actItems = [];
var _actPage = 0;
var _actPageSize = 5;

// polling
var _prevPending = 0;
