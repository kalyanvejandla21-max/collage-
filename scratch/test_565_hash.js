const bcrypt = require('bcryptjs');

const hash = '$2b$10$eGb8i9a591OXQQaDYf5qGO0esPQM/EfdO9XmycgCF2BT96eyp/0ji';
const regNo = '24HP1A0565';

console.log("Testing candidate '24HP1A0565':", bcrypt.compareSync('24HP1A0565', hash));
console.log("Testing candidate '24hp1a0565':", bcrypt.compareSync('24hp1a0565', hash));
console.log("Testing candidate '24HP1A0565@':", bcrypt.compareSync('24HP1A0565@', hash));
console.log("Testing candidate 'AIET@123':", bcrypt.compareSync('AIET@123', hash));
