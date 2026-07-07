// src/main/url-params.ts
export const urlParams: URLSearchParams = new URLSearchParams(window.location.search);

export const nama: string = urlParams.get('n') ?? '';
export const pronoun: string = urlParams.get('p') ?? '';
export const guestId: string | null = urlParams.get('guest_id');
export const guestToken: string | null = urlParams.get('token');

// Fill hero name on import (side-effect)
const namaContainer = document.querySelector<HTMLElement>('.hero h4 span');

if (namaContainer) {
  if (!nama) {
    namaContainer.innerText = ' Mr/Mrs/Ms Invited Guest,';
  } else if (!pronoun) {
    namaContainer.innerText = ' ' + nama + ',';
  } else {
    namaContainer.innerText = ' ' + pronoun + ' ' + nama + ',';
  }
}
