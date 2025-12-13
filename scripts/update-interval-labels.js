// Dit script voegt een oplopend nummer toe aan elk interval-paar label in schema.json
const fs = require('fs');
const path = 'c:/Users/joche/trainer-app/schema.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const day of data) {
  let intervalNr = 1;
  for (const step of day.steps) {
    if (step.type === 'interval_pair') {
      step.hard.label = `Interval ${intervalNr} hard`;
      step.rest.label = `Interval ${intervalNr} rust`;
      intervalNr++;
    }
  }
}
fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Interval labels updated!');
