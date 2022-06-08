(
  async () => {
    try {
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({
        user: 'root',
        host: '127.0.0.1',
        port: 4000,
      })

      await conn.query(`CREATE DATABASE cdstest;`)
      await conn.query(`CREATE USER 'cdstest'@'%' IDENTIFIED BY 'cdstest';`)
      await conn.query(`GRANT ALL on cdstest.* to 'cdstest'@'%';`)

      conn.destroy()
      console.log("user 'cdstest'@'%' created at '127.0.0.1:4000'")
      process.exit(0)
    } catch (error) {
      console.error('create user failed: ', error)
      process.exit(1)
    }

  }
)();