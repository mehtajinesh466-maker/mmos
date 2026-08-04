const bcrypt = require('bcrypt');
const hash = '$2b$10$Jx.ENjzCSV1gU4sG.WfZge6soqx95ommRFW0f5j0EUJQqGhesuupO';

const candidates = [
  'mastermoves@coach$',
  'mastermoves@front@123',
  'mastermoves@$',
  'password123',
  'coach',
  'coach123',
  'mastermoves',
  'mastermoves@coach',
  'mastermoves@front',
  'mastermoves@owner'
];

async function check() {
  for (const c of candidates) {
    const match = await bcrypt.compare(c, hash);
    if (match) {
      console.log('MATCH FOUND:', c);
      return;
    }
  }
  console.log('NO MATCH FOUND');
}

check();
