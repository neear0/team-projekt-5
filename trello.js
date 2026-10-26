// Tu doplň svoje údaje
const KEY = "a6e353ca42d9b0de020633b7a0874cae";
const TOKEN = "ATTAbec1cd50f6267c8b2c18c4ea0aa7f24facd939c5d2ce61508f9fbfbed01fa5268BB0B6B9";
const BOARD_ID = "wvPm4USn";

const url = "https://api.trello.com/1/boards/" + BOARD_ID +
            "/cards?fields=name,due&key=" + KEY + "&token=" + TOKEN;

const zoznam = document.getElementById("trello-zoznam");

// funkcia, ktorá načíta karty a vypíše ich
function nacitajKarty() {
    fetch(url)
        .then(function (odpoved) {
            return odpoved.json();
        })
        .then(function (karty) {
            // necháme len karty, ktoré majú termín
            const sTerminom = [];
            for (let i = 0; i < karty.length; i++) {
                if (karty[i].due) {
                    sTerminom.push(karty[i]);
                }
            }

            // zoradíme podľa dátumu
            sTerminom.sort(function (a, b) {
                return new Date(a.due) - new Date(b.due);
            });

            // vypíšeme do zoznamu
            zoznam.innerHTML = "";
            for (let i = 0; i < sTerminom.length; i++) {
                const datum = new Date(sTerminom[i].due).toLocaleDateString("sk-SK");
                const li = document.createElement("li");
                li.textContent = datum + " – " + sTerminom[i].name;
                zoznam.appendChild(li);
            }

            if (sTerminom.length === 0) {
                zoznam.innerHTML = "<li>Žiadne karty s termínom.</li>";
            }
        })
        .catch(function () {
            zoznam.innerHTML = "<li>Nepodarilo sa načítať Trello.</li>";
        });
}

// prvé načítanie hneď po otvorení stránky
nacitajKarty();

// potom znova každých 30 sekúnd (30000 milisekúnd)
setInterval(nacitajKarty, 30000);