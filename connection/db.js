const {Pool} = require('pg') //import pg pool

const dbPool = new Pool({
    database: 'personal_web',
    port: 5432,
    user: 'postgres',
    password: '12345678'  
})

module.exports = dbPool