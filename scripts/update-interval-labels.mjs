// Script om interval nummers uit de labels te verwijderen in schema.json
import fs from 'fs';
const path = 'c:/Users/joche/trainer-app/schema.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const day of data) {
  for (const step of day.steps) {
    if (step.type === 'interval_pair') {
      if (step.hard && typeof step.hard.label === 'string') {
        step.hard.label = 'Interval hard';
      }
      if (step.rest && typeof step.rest.label === 'string') {
        step.rest.label = 'Interval rust';
      }
    }
  }
}
fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Interval labels hersteld!');
