# Winter Games – määrittely

Retrohenkinen (Amiga/VGA-tyyli) talviurheilupeli, jossa on kolme lajia: mäkihyppy, pujottelu ja ohjaskelkkailu. Koko pelin voittaa se, jolla on eniten yhteispisteitä. Pohjana on tiedosto `suunnitelma.txt`, ja tämä määrittely täydentää sitä grilling-session päätöksillä.

## Tekniikka

- Peli toimii selaimessa: HTML5 Canvas ja tavallinen JavaScript (ES-moduulit). Npm-riippuvuuksia ei ole.
- Paikallinen Node-palvelin käyttää vain Noden sisäänrakennettuja moduuleja. Palvelin:
  - tarjoaa pelin osoitteessa `http://localhost:8080`
  - ottaa vastaan valmiit kilpailutulokset osoitteessa `POST /api/results`
  - kirjoittaa tulokset tiedostoon `docs/leaderboard.json`
  - tekee jokaisen valmiin kilpailun jälkeen automaattisesti `git commit` ja `git push` -komennot gitin omilla tunnuksilla. Jos push epäonnistuu, commit jää paikalliseksi ja lähtee seuraavassa pushissa.
- Koodiin tai tiedostoihin ei tallenneta avaimia eikä tokeneita.
- Pelin puolella tallennus on rajapinnan takana (`ScoreRepository`: `getUser`, `saveResult`, `getLeaderboard`).
- Tulokset julkaistaan GitHub Pagesissa:
  - Repositorio on julkinen `JouniJokelainen/winter-games`, ja Pages julkaistaan `main`-haaran `docs/`-kansiosta.
  - Repositorio luodaan vasta käyttäjän erillisellä hyväksynnällä.
  - Pages-sivulla näytetään kymmenen parasta yhteispistemäärää, lajikohtaiset ennätykset ja viimeisimmät kilpailut samalla retrotyylillä ja paletilla kuin pelissä.
  - Peliä pelataan vain paikallisesti, eikä peliä itseään julkaista Pagesissa.
- Grafiikka:
  - Sisäinen resoluutio on 320×256 (Amiga PAL), ja kuva skaalataan kokonaislukukertoimella.
  - Kaikki grafiikka piirretään koodilla (pikselitaulukot ja muodot), eikä kuvatiedostoja käytetä.
- Äänet: Web Audio -ääniefektit ja chiptune-taustamusiikki, joka soitetaan omalla sekvensserillä. Kappaleet ovat nuottidatana koodissa.
- Kielet: pelin tekstit ovat suomeksi ja koodi englanniksi.

## Pelin kulku

- Päävalikossa on kaksi vaihtoehtoa:
  - **Kilpailu**:
    - Pelaaja syöttää nimimerkin tai valitsee vanhan nimimerkin listasta. Nimimerkissä on enintään 10 merkkiä, isoja kirjaimia ja numeroita. Salasanaa ei ole.
    - Lajit pelataan järjestyksessä: mäkihyppy, pujottelu ja ohjaskelkkailu. Kussakin lajissa on kolme yritystä.
  - **Harjoittelu**:
    - Pelaaja valitsee yksittäisen lajin.
    - Käyttäjää ei tarvita.
    - Yrityksiä on rajattomasti, ja lajista poistutaan Escillä.
    - Tuloksia ei tallenneta.
- Jokaisen suorituksen jälkeen näytetään tulosnäyttö (pituus tai aika ja pisteet).
- Jokaisen lajin jälkeen näytetään yhteenveto, jossa ovat paras suoritus ja kertyneet kokonaispisteet. Yhteenveto kuitataan välilyönnillä.
- Kilpailun lopuksi näytetään yhteispisteet, ja tulos lähetetään palvelimelle.
- Esc avaa taukovalikon, jossa on vaihtoehdot jatka, mykistä ja lopeta. Keskeytetty kilpailu ei tallennu.
- Lajin pisteiden alaraja on 0. Jos kaikki kolme yritystä hylätään tai päättyvät kaatumiseen, lajista tulee 0 pistettä ja peli siirtyy seuraavaan lajiin.
- Käyttäjälle tallennetaan paras yhteispistemäärä ja lajikohtaiset ennätykset.

## Mäkihyppy (enintään 80 pistettä)

- **Kuvakulma:** sivulta, ja kamera seuraa hahmoa vaakasuunnassa.
- **Tausta:** talvimaisema ja katsojat, jotka liikkuvat parallax-vierityksellä.
- **Tuuli:**
  - Tuuli arvotaan jokaiselle hypylle erikseen, ja se on aina myötätuulta.
  - Tuulen voimakkuus näkyy tuuliviirinä ruudun oikeassa yläkulmassa: mitä vaakasuorempi viiri, sitä kovempi tuuli.
  - Myötätuuli kasvattaa vauhtia mäessä, mutta samalla ponnistuksen ajoitusikkuna kapenee.
- **Pituus:**
  - Yli 200 metrin hyppy ei ole mahdollinen.
  - 200 metriin pääsee vain kovalla tuulella ja lähes täydellisellä suorituksella.
  - Tyynellä paras mahdollinen tulos on noin 190 m.
- **Lähtö:** pelaaja lähtee liikkeelle välilyönnillä.
- **Ponnistus** tehdään välilyönnillä:
  - Nokalta: optimaalinen ponnistus.
  - Liian aikaisin: heikompi ponnistus. Mitä aikaisemmin, sitä lyhyempi hyppy, mutta kaatumista ei tule. Hyvin aikainen ponnistus vastaa ponnistamatta jättämistä.
  - Ei ponnistusta: lyhyt hyppy ja heikompi vauhti.
  - Liian myöhään, nokan jälkeen: kaatuminen.
- **Lento:**
  - Nuoli vasemmalle nostaa hahmoa pystympään ja nuoli oikealle laskee vaakasuorempaan.
  - Kulma ajelehtii itsestään (puuskat ja painovoima), ja pelaaja korjaa sitä koko lennon ajan.
  - Paras kulma on 45 astetta. Liian pysty tai liian vaakasuora asento hidastaa vauhtia.
- **Alastulo** tehdään välilyönnillä. Ajoitusikkunat (viritetään testauksessa):
  - yli 0,5 s ennen kosketusta: huono alastulo, 5 pistettä
  - 0,5–0,15 s ennen kosketusta: optimaalinen alastulo, 20 pistettä
  - alle 0,15 s ennen kosketusta, kosketuksen jälkeen tai ei painallusta: kaatuminen
- **Pisteet:**
  - Pituuspisteet = 60 − 2 × (200 − pituus), alaraja 0.
  - Alastulopisteet lisätään pituuspisteisiin.
  - Kaatumisesta tulee 0 pistettä.
  - Paras kolmesta hypystä jää voimaan.
- **Näytöllä:**
  - hahmo, hyppyrimäki, alastulorinne ja tuuliviiri
  - nopeus mäessä ja lennossa
  - tuomaripisteet hypyn jälkeen
  - paras hyppy ja sen pisteet kolmen hypyn jälkeen

## Pujottelu (enintään 60 pistettä)

- **Kuvakulma:** edestä. Hahmo laskee kohti katsojaa ruudun yläkolmanneksessa, ja rata vierii ylöspäin.
- **Rata:**
  - Rata on aina sama.
  - Siinä on 23 yksittäistä keppiä, jotka kierretään vuorotellen vasemmalta ja oikealta (punaiset ja siniset kepit).
  - Ennen maalia on lyhyt kepitön kiihdytysosuus.
- **Ohjaus:**
  - Välilyönnillä lähdetään liikkeelle.
  - Nuolet kääntävät suksien kulmaa, ja liike seuraa kulmaa. Kääntyminen hidastaa vauhtia.
  - Välilyönnin naputtelu kiihdyttää. Liian kova vauhti vaikeuttaa keppien kiertämistä.
  - Keppiin osuminen hidastaa vauhtia.
- **Hylkäys:**
  - kaksi kiertämätöntä keppiä
  - hahmo ajautuu ulos rinteestä
- **Pisteet:**
  - Pisteet = 60 − 5 × (sekunnit yli 30 s) − 10 × törmäykset − 20 × kiertämätön keppi, alaraja 0.
  - Voimaan jää pisteiltään paras hyväksytty lasku kolmesta.
- **Näytöllä:**
  - lähtöpaikka, rinne ja hahmo
  - vauhti
  - talvimaisema ja katsojat
  - kierretyt ja kiertämättömät kepit
  - paras lasku ja sen aika kolmen laskun jälkeen

## Ohjaskelkkailu (enintään 60 pistettä)

- **Kuvakulma:** takaa, pseudo-3D-rata. Rata kaartaa kohti horisonttia, ja kelkan sijainti radan poikkileikkauksessa näkyy (sisälaita, keskellä, ulkolaita).
- **Lähtö:**
  - Välilyönnillä lähdetään liikkeelle.
  - Sen jälkeen tulee viiden sekunnin työntövaihe, jossa välilyönnin nopea naputtelu kiihdyttää.
  - Hahmo hyppää automaattisesti kelkkaan punaisen viivan kohdalla. Hyvä työntö näkyy hyvänä vauhtina mäessä.
- **Ajanotto:** alkaa punaisesta viivasta.
- **Ohjaus:**
  - Nuolet vasemmalle ja oikealle ohjaavat kelkkaa, ja nuoli alas jarruttaa.
  - Käännöksessä ulkolaita kiihdyttää, keskellä vauhti pysyy ennallaan ja sisälaita hidastaa.
- **Suistuminen:**
  - Jokaisella käännöksellä on nopeusraja.
  - Jos raja ylittyy ulkolaidalla, kelkka suistuu radalta ja suoritus hylätään.
  - Varoituksena kelkka nousee seinämälle ja kuuluu kirskuntaa.
- **Pisteet:**
  - Pisteet = 60 − 5 × (sekunnit yli 30 s), alaraja 0.
  - Voimaan jää nopein hyväksytty lasku kolmesta.
- **Näytöllä:**
  - lähtöpaikka, kiihdytysalue ja kelkkamäki
  - hahmo kelkkoineen ja vauhti
  - talvimaisema ja katsojat
  - paras lasku ja sen aika kolmen laskun jälkeen

## Tavoiteajat

Pujottelussa ja ohjaskelkkailussa 30 sekunnin tavoiteaika vaatii erinomaisen suorituksen. Keskiverto suoritus kestää 33–36 sekuntia, josta saa noin 30–45 pistettä. Radat suunnitellaan ja viritetään tämän mukaan.

## Kontrollit

| Näppäin | Mäkihyppy | Pujottelu | Ohjaskelkkailu |
|---|---|---|---|
| Välilyönti | lähtö, ponnistus, alastulo | lähtö, kiihdytys (naputtelu) | lähtö, työntö (naputtelu) |
| ← / → | lentokulman säätö | kääntyminen | ohjaus |
| ↓ | – | – | jarrutus |
| Esc | taukovalikko | taukovalikko | taukovalikko |
