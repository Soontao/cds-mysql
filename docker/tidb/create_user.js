(
  async () => {
    try {
      const adminUserName = process.env.MYSQL_ADMIN_USRE ?? "cdstest";
      const mysqlPort = parseInt(process.env.MYSQL_PORT ?? "3306");
      const mysqlHost = process.env.MYSQL_HOST ?? "127.0.0.1";
      const mysql = require("mysql2/promise");
      const conn = await mysql.createConnection({
        user: "root",
        host: mysqlHost,
        port: mysqlPort,
      });

      await conn.query(`CREATE DATABASE IF NOT EXISTS ${adminUserName};`);
      await conn.query(`CREATE USER IF NOT EXISTS '${adminUserName}'@'%' IDENTIFIED BY '${adminUserName}';`);
      await conn.query(`GRANT ALL PRIVILEGES ON *.* TO '${adminUserName}'@'%' WITH GRANT OPTION;`);

      conn.destroy();
      console.log(`user '${adminUserName}'@'%' created at '127.0.0.1:${mysqlPort}'`);
      process.exit(0);
    } catch (error) {
      console.error("create user failed: ", error);
      process.exit(1);
    }

  }
)();