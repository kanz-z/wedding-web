const urlParams = new URLSearchParams(window.location.search); //pengambilan parameter dari url yang bernilai nama tamu
const nama = urlParams.get("n") || "";
const pronoun = urlParams.get("p") || "";

// pemanggilan element yang akan diisi nama dari url
const namaContainer = document.querySelector(".hero h4 span");
if (!nama && !pronoun) {
  namaContainer.innerText = ` Mr/Mrs/Ms Invited Guest,`;
} else {
  namaContainer.innerText = ` ${pronoun} ${nama},`;
}

document.querySelector("#nama").value = nama;
