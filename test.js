const createJiti = require("./dist/jiti").default;

const jiti = createJiti(__filename);

const obj = jiti("./examples/import-demo");
console.log(obj.default);