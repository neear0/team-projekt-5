// História zmien sa číta zo súboru commits.json, ktorý pravidelne aktualizuje GitHub Action.
const zoznamCommitov = document.getElementById("git-historia");

function vypisChybuHistorie(sprava) {
    zoznamCommitov.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = sprava;
    zoznamCommitov.appendChild(li);
}

function nacitajHistoriu() {
    fetch("commits.json", { cache: "no-store" })
        .then(function (odpoved) {
            if (!odpoved.ok) {
                throw new Error("commits.json sa nenašiel");
            }
            return odpoved.json();
        })
        .then(function (commity) {
            zoznamCommitov.innerHTML = "";

            for (let i = 0; i < commity.length; i++) {
                const li = document.createElement("li");

                const kod = document.createElement("a");
                kod.className = "git-sha";
                kod.href = commity[i].url;
                kod.textContent = commity[i].sha;
                li.appendChild(kod);

                const telo = document.createElement("div");

                const sprava = document.createElement("span");
                sprava.className = "git-sprava";
                // pri dlhších správach stačí prvý riadok
                sprava.textContent = commity[i].sprava.split(String.fromCharCode(10))[0];
                telo.appendChild(sprava);

                const meta = document.createElement("span");
                meta.className = "git-meta";
                const datum = new Date(commity[i].datum).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" });
                meta.textContent = commity[i].autor + " · " + datum;
                telo.appendChild(meta);

                li.appendChild(telo);
                zoznamCommitov.appendChild(li);
            }

            if (commity.length === 0) {
                vypisChybuHistorie("Zatiaľ žiadne zmeny.");
            }
        })
        .catch(function () {
            vypisChybuHistorie("Nepodarilo sa načítať históriu zmien.");
        });
}

nacitajHistoriu();
