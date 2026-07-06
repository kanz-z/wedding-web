// src/main/url-params.js
export const urlParams = new URLSearchParams(window.location.search);
export const nama = urlParams.get("n") || "";
export const pronoun = urlParams.get("p") || "";
export const guestId = urlParams.get("guest_id") || null;
export const guestToken = urlParams.get("token") || null;

// Fill hero name on import
const namaContainer = document.querySelector(".hero h4 span");
if (!nama) {
  namaContainer.innerText = " Mr/Mrs/Ms Invited Guest,";
} else if (!pronoun) {
  namaContainer.innerText = " " + nama + ",";
} else {
  namaContainer.innerText = " " + pronoun + " " + nama + ",";
}
