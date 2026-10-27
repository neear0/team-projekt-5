// Board sa číta zo súboru trello.json, ktorý pravidelne aktualizuje GitHub Action.
// V repozitári nie sú žiadne kľúče ani tokeny.
const kontajner = document.getElementById("trello-board");

// zoznamy, ktoré sa na webe nemajú zobrazovať (porovnáva sa začiatok názvu)
const SKRYTE_ZOZNAMY = ["Trello Starter Guide", "Today", "Next Meeting", "Later"];

function vypisChybu(sprava) {
    kontajner.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = sprava;
    kontajner.appendChild(p);
}

function jeSkryty(nazov) {
    return SKRYTE_ZOZNAMY.some(function (skryty) {
        return nazov.startsWith(skryty);
    });
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
                if (jeSkryty(zoznamy[i].name) || karty.length === 0) {
                    continue;
                }
                zobrazene++;

                const stlpec = document.createElement("div");
                stlpec.className = "trello-stlpec";

                const nadpis = document.createElement("h4");
                nadpis.textContent = zoznamy[i].name;

                let hotove = 0;
                for (let j = 0; j < karty.length; j++) {
                    if (karty[j].dueComplete) {
                        hotove++;
                    }
                }
                const pocet = document.createElement("span");
                pocet.className = "trello-pocet";
                pocet.textContent = hotove + " / " + karty.length + " hotové";
                nadpis.appendChild(pocet);
                stlpec.appendChild(nadpis);

                const ul = document.createElement("ul");
                ul.className = "trello-zoznam";
                for (let j = 0; j < karty.length; j++) {
                    const li = document.createElement("li");
                    const nazov = document.createElement("span");
                    nazov.className = "trello-nazov";
                    nazov.textContent = karty[j].name;
                    li.appendChild(nazov);

                    if (karty[j].dueComplete) {
                        li.className = "hotovo";
                    }

                    if (karty[j].due) {
                        const termin = document.createElement("span");
                        termin.className = karty[j].dueComplete ? "trello-termin hotovo" : "trello-termin";
                        termin.textContent = new Date(karty[j].due).toLocaleDateString("sk-SK");
                        li.appendChild(termin);
                    }

                    const odpocet = karty[j].badges;
                    if (odpocet && odpocet.checkItems > 0) {
                        const checklist = document.createElement("span");
                        checklist.className = "trello-checklist";
                        checklist.textContent = odpocet.checkItemsChecked + " / " + odpocet.checkItems + " podúloh";
                        li.appendChild(checklist);
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
