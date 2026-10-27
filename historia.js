// História zmien sa číta zo súboru commits.json, ktorý pravidelne aktualizuje GitHub Action.
const historia = document.getElementById("git-historia");

function vypisChybuHistorie(sprava) {
    historia.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = sprava;
    historia.appendChild(p);
}

// kľúč dňa, napríklad 2026-10-27, podľa miestneho času
function kluc(datum) {
    return datum.getFullYear() + "-" + datum.getMonth() + "-" + datum.getDate();
}

function nazovDna(datum) {
    const dnes = new Date();
    const vcera = new Date();
    vcera.setDate(vcera.getDate() - 1);

    if (kluc(datum) === kluc(dnes)) {
        return "Dnes";
    }
    if (kluc(datum) === kluc(vcera)) {
        return "Včera";
    }
    return datum.toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long" });
}

function vytvorCommit(commit) {
    const datum = new Date(commit.datum);
    const li = document.createElement("li");

    if (commit.avatar) {
        const avatar = document.createElement("img");
        avatar.className = "git-avatar";
        avatar.src = commit.avatar + "&s=64";
        avatar.alt = commit.autor;
        avatar.width = 32;
        avatar.height = 32;
        li.appendChild(avatar);
    } else {
        const iniciala = document.createElement("span");
        iniciala.className = "git-avatar git-iniciala";
        iniciala.textContent = commit.autor.charAt(0).toUpperCase();
        li.appendChild(iniciala);
    }

    const telo = document.createElement("div");
    telo.className = "git-telo";

    const sprava = document.createElement("span");
    sprava.className = "git-sprava";
    // pri dlhších správach stačí prvý riadok
    sprava.textContent = commit.sprava.split(String.fromCharCode(10))[0];
    telo.appendChild(sprava);

    const meta = document.createElement("span");
    meta.className = "git-meta";
    const cas = datum.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
    meta.textContent = commit.autor + " · " + cas;
    telo.appendChild(meta);
    li.appendChild(telo);

    const kod = document.createElement("a");
    kod.className = "git-sha";
    kod.href = commit.url;
    kod.textContent = commit.sha;
    li.appendChild(kod);

    return li;
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
            historia.innerHTML = "";

            if (commity.length === 0) {
                vypisChybuHistorie("Zatiaľ žiadne zmeny.");
                return;
            }

            let aktualnyDen = "";
            let ul = null;

            for (let i = 0; i < commity.length; i++) {
                const datum = new Date(commity[i].datum);

                // nový nadpis vždy, keď sa zmení deň
                if (kluc(datum) !== aktualnyDen) {
                    aktualnyDen = kluc(datum);

                    const nadpis = document.createElement("h4");
                    nadpis.className = "git-den";
                    nadpis.textContent = nazovDna(datum);
                    historia.appendChild(nadpis);

                    ul = document.createElement("ul");
                    ul.className = "git-zoznam";
                    historia.appendChild(ul);
                }

                ul.appendChild(vytvorCommit(commity[i]));
            }
        })
        .catch(function () {
            vypisChybuHistorie("Nepodarilo sa načítať históriu zmien.");
        });
}

nacitajHistoriu();
