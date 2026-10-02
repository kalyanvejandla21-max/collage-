const bcrypt = require('bcryptjs');

const hashInDb = "$2b$10$2Gs81NPMfJHMYmlBjZvMteibV.sBx7dG7bMhW92ohS6xWrvNWsmQS";

console.log("Compare AIET@123:", bcrypt.compareSync("AIET@123", hashInDb));
console.log("Compare password123:", bcrypt.compareSync("password123", hashInDb));
