(
  async () => {
    try {
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({
        user: 'root',
        host: '127.0.0.1',
        port: 4000,
      })

      await conn.query(`CREATE USER 'cdstest'@'%' IDENTIFIED BY 'cdstest'; `)
      await conn.query(`GRANT ALL on cdstest.* to 'cdstest'@'%';`)

      conn.destroy()
      process.exit(0)
    } catch (error) {
      console.error('create user failed: ', error)
      process.exit(1)
    }

  }
)();