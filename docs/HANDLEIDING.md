# My Training Coach - Gebruikershandleiding

## Inhoudsopgave
1. [Introductie](#introductie)
2. [Inloggen](#inloggen)
3. [Hoofdscherm](#hoofdscherm)
4. [Schema Editor](#schema-editor)
5. [Training Uitvoeren](#training-uitvoeren)
6. [Tips & Tricks](#tips--tricks)
7. [Veelgestelde Vragen](#veelgestelde-vragen)

---

## Introductie

My Training Coach is een persoonlijke trainingsplanner waarmee je je eigen trainingsschema kunt maken en volgen. De app berekent automatisch welke week je in je trainingsprogramma zit op basis van de startdatum.

**Belangrijkste functies:**
- Eigen trainingsschema maken en bewerken
- Aangepaste startdatum per schema
- Week-voor-week trainingsplanning
- Interval en steady trainingen
- Calorieën tracking per week
- Automatische berekening huidige trainingsweek

---

## Inloggen

1. Open de app op [https://jochem77.github.io/trainer-app/](https://jochem77.github.io/trainer-app/)
2. Klik op **"Inloggen met E-mail"**
3. Vul je e-mailadres in
4. Klik op **"Stuur Magic Link"**
5. Check je e-mail en klik op de link om in te loggen

De app gebruikt Supabase authenticatie - je gegevens zijn veilig opgeslagen en automatisch gesynchroniseerd.

---

## Hoofdscherm

### Week Navigatie

Bovenaan zie je de huidige week in je trainingsprogramma:
```
← Week 13 →
```
- Gebruik de **pijltjes** om tussen weken te navigeren
- De app toont automatisch de huidige week op basis van je startdatum

### Week Informatie

Onder de week zie je:
- **Datum periode**: bijv. "23 nov - 29 nov"
- **Calorieën**: Geschatte calorieverbranding voor die week

### Trainingsoverzicht

Voor elke week zie je:
- **Totale trainingstijd** in minuten
- **Totale afstand** in kilometers
- **Geschatte calorieën** verbranding

### Trainingsstappen

Elke training bestaat uit stappen:

**Steady Stappen** (doorlopend tempo):
- **Label**: bijv. "Warming-up", "Cool-down", "Basis tempo"
- **Snelheid**: in km/u
- **Duur**: in minuten
- **Herhalingen**: aantal keer dat deze stap herhaald wordt

**Interval Stappen** (hard/rust afwisselend):
- **Hard interval**: snelheid en duur
- **Rust interval**: snelheid en duur
- **Aantal herhalingen**: hoeveel keer het hard/rust patroon herhaald wordt

### Knoppen

- **📊 Stats**: Bekijk trainingsstatistieken
- **✏️ Schema Editor**: Bewerk je trainingsschema
- **🚪 Uitloggen**: Log uit van de app

---

## Schema Editor

Klik op **"✏️ Schema Editor"** om je trainingsschema te bewerken.

### Schema Naam

Geef je schema een herkenbare naam, bijvoorbeeld:
- "10K Voorbereiding"
- "Marathon Training"
- "Basis Conditie"

### Startdatum Programma

Stel de startdatum in van je trainingsprogramma. De app berekent automatisch in welke week je zit op basis van deze datum.

**Voorbeeld:**
- Startdatum: 31 augustus 2025
- Vandaag: 29 november 2025
- Huidige week: Week 13

### Week Manager

Hier zie je alle weken in je schema:

**Week toevoegen:**
1. Klik op **"➕ Week Toevoegen"**
2. Er wordt een nieuwe lege week toegevoegd

**Week kopiëren:**
1. Klik op het **📄 icoon** bij een week
2. Er wordt een kopie gemaakt van die week

**Week verwijderen:**
1. Klik op het **🗑️ icoon** bij een week
2. De week wordt verwijderd

**Weken herschikken:**
1. Sleep een week met je muis
2. Plaats deze tussen twee andere weken
3. De week wordt op de nieuwe positie ingevoegd

### Training Stappen Bewerken

Klik op een week om de trainingsstappen te bewerken.

#### Stap Toevoegen

Kies het type stap:

**1. Steady (doorlopend tempo):**
- Klik op **"+ Steady"**
- Vul in:
  - **Label**: bijv. "Warming-up", "Basis tempo"
  - **Snelheid**: km/u (bijv. 10)
  - **Duur**: minuten (bijv. 5)
  - **Herhalingen**: aantal keer (meestal 1)

**2. Interval (hard/rust):**
- Klik op **"+ Interval"**
- Vul in voor **Hard**:
  - **Label**: bijv. "Sprint"
  - **Snelheid**: km/u (bijv. 14)
  - **Duur**: minuten (bijv. 1)
- Vul in voor **Rust**:
  - **Label**: bijv. "Herstel"
  - **Snelheid**: km/u (bijv. 8)
  - **Duur**: minuten (bijv. 2)
- **Herhalingen**: aantal keer dit patroon (bijv. 5)

#### Stap Bewerken

1. Klik op een bestaande stap
2. Pas de waarden aan
3. De wijzigingen worden automatisch bijgewerkt

#### Stap Verplaatsen

1. Gebruik de **⬆️** en **⬇️** knoppen
2. De stap wordt omhoog of omlaag verplaatst

#### Stap Verwijderen

1. Klik op het **🗑️** icoon
2. De stap wordt verwijderd

### Opslaan

1. Klik op **"💾 Opslaan"** (rechts bovenaan)
2. Je ziet de status:
   - **💾 Opslaan...**: Bezig met opslaan
   - **✅ Opgeslagen**: Succesvol opgeslagen
   - **❌ Fout bij opslaan**: Er is iets misgegaan

**Let op**: De knop is alleen actief als je wijzigingen hebt gemaakt (je ziet dan **⚠️ Niet opgeslagen wijzigingen**).

---

## Training Uitvoeren

### Timer Gebruiken

1. Ga naar de week die je wilt trainen
2. Zie de trainingsstappen
3. Gebruik de timer (toekomstige functie) om je training te volgen

### Trainingsweergave

Voor elke stap zie je:

**Steady stappen:**
```
🏃 Warming-up
⚡ 10 km/u | ⏱️ 5 min
```

**Interval stappen:**
```
💨 Intervaltraining (5x)

Hard: Sprint
⚡ 14 km/u | ⏱️ 1 min

Rust: Herstel  
⚡ 8 km/u | ⏱️ 2 min
```

### Statistieken

Onderaan elke training zie je:
- **Totale tijd**: Som van alle stappen (inclusief herhalingen)
- **Totale afstand**: Berekend op basis van snelheid × tijd
- **Calorieën**: Geschatte verbranding (ongeveer 1 cal per kg lichaamsgewicht per km)

---

## Tips & Tricks

### Een Goed Trainingsschema Opbouwen

1. **Start met warming-up** (5-10 min, lage snelheid)
2. **Bouw intensiteit op** (geleidelijk harder)
3. **Eindig met cool-down** (5-10 min, lage snelheid)

**Voorbeeld trainingsweek:**
- Week 1-4: Basis opbouwen (30-40 min steady)
- Week 5-8: Intervallen toevoegen
- Week 9-12: Langere afstanden

### Startdatum Instellen

- Stel de startdatum in op de **zaterdag** dat je begint
- De app berekent weken van zaterdag tot vrijdag
- Wijzig de startdatum als je opnieuw wilt beginnen

### Meerdere Schema's

Je kunt meerdere schema's aanmaken voor verschillende doelen:
- Een schema voor 5K training
- Een schema voor 10K training  
- Een schema voor herstelweken

### Automatische Cloud Opslag

Je data wordt automatisch opgeslagen. Je kunt altijd inloggen vanaf elk apparaat en je schema's terugvinden.

### Weken Kopiëren

Gebruik de kopieer functie om:
- Een succesvolle week te herhalen
- Een basisweek als template te gebruiken
- Snel variaties te maken

### Interval Training

Intervallen zijn perfect voor:
- **Snelheid opbouwen**: Korte sprints (30 sec - 1 min)
- **VO2 max verbeteren**: Middellange intervallen (2-3 min)
- **Tempo training**: Langere intervallen (5-10 min)

Stel altijd genoeg rusttijd in tussen intervallen!

---

## Veelgestelde Vragen

**Q: Kan ik mijn schema's delen met anderen?**  
A: Momenteel niet, elk account heeft eigen schema's.

**Q: Werkt de app offline?**  
A: Nee, je hebt een internetverbinding nodig.

**Q: Hoeveel schema's kan ik maken?**  
A: Momenteel één actief schema per account.

**Q: Hoe bereken ik mijn trainingssnelheid?**  
A: Gebruik je normale loopsnelheid als basis. Bijvoorbeeld: 10 km/u = 6 min/km.

**Q: Kan ik een week overslaan?**  
A: Ja, gebruik de pijltjes om handmatig naar een andere week te navigeren.

**Q: Wat gebeurt er als ik mijn startdatum wijzig?**  
A: De app berekent opnieuw in welke week je zit op basis van de nieuwe startdatum.

**Q: Hoe voeg ik een warming-up en cool-down toe?**  
A: Voeg een "Steady" stap toe aan het begin (warming-up) en einde (cool-down) van je training met lagere snelheid.

---

## Hulp Nodig?

Heb je vragen of loop je ergens tegenaan? Neem dan contact op via de GitHub pagina van het project.

---

**Veel succes met je training! 🏃‍♂️💪**
