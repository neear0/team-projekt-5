// Board sa číta zo súboru trello.json, ktorý pravidelne aktualizuje GitHub Action.
// V repozitári nie sú žiadne kľúče ani tokeny.
const kontajner = document.getElementById("trello-board");

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

            for (let i = 0; i < zoznamy.length; i++) {
                const stlpec = document.createElement("div");
                stlpec.className = "trello-stlpec";

                const nadpis = document.createElement("h4");
                nadpis.textContent = zoznamy[i].name;
                stlpec.appendChild(nadpis);

                const ul = document.createElement("ul");
                ul.className = "trello-zoznam";
                const karty = zoznamy[i].cards;

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

                if (karty.length === 0) {
                    const prazdne = document.createElement("li");
                    prazdne.textContent = "Žiadne karty.";
                    ul.appendChild(prazdne);
                }

                stlpec.appendChild(ul);
                kontajner.appendChild(stlpec);
            }

            if (zoznamy.length === 0) {
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
