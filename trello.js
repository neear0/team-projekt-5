// Board sa číta zo súboru trello.json, ktorý pravidelne aktualizuje GitHub Action.
// V repozitári nie sú žiadne kľúče ani tokeny.
const kontajner = document.getElementById("trello-board");

// zoznamy, ktoré sa na webe nemajú zobrazovať (stačí ich archivovať aj priamo v Trelle)
const SKRYTE_ZOZNAMY = ["Trello Starter Guide"];

function vypisChybu(sprava) {
    kontajner.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = sprava;
    kontajner.appendChild(p);
}

function nacitajKarty() {
    fetch("trello.json", { cache: "no-store" })
        .then(function (odpoved) {
            if (!odpoved.ok) {
                throw new Error("trello.json sa nenašiel");
            }
            return odpoved.json();
        })
        .then(function (zoznamy) {
            kontajner.innerHTML = "";

            let zobrazene = 0;

            for (let i = 0; i < zoznamy.length; i++) {
                const karty = zoznamy[i].cards;
                if (SKRYTE_ZOZNAMY.includes(zoznamy[i].name) || karty.length === 0) {
                    continue;
                }
                zobrazene++;

                const stlpec = document.createElement("div");
                stlpec.className = "trello-stlpec";

                const nadpis = document.createElement("h4");
                nadpis.textContent = zoznamy[i].name;
                stlpec.appendChild(nadpis);

                const ul = document.createElement("ul");
                ul.className = "trello-zoznam";
                for (let j = 0; j < karty.length; j++) {
                    const li = document.createElement("li");
                    li.textContent = karty[j].name;

                    if (karty[j].due) {
                        const termin = document.createElement("span");
                        termin.className = "trello-termin";
                        termin.textContent = new Date(karty[j].due).toLocaleDateString("sk-SK");
                        li.appendChild(termin);
                    }
                    ul.appendChild(li);
                }

                stlpec.appendChild(ul);
                kontajner.appendChild(stlpec);
            }

            if (zobrazene === 0) {
                vypisChybu("Board je prázdny.");
            }
        })
        .catch(function () {
            vypisChybu("Nepodarilo sa načítať Trello.");
        });
}

// prvé načítanie hneď po otvorení stránky
nacitajKarty();

// potom znova každých 5 minút
setInterval(nacitajKarty, 300000);
