export const EXPECTED_MIGRATE_DDL = {
  "0->1": [
    "CREATE TABLE `test_resources_migrate_People` (`ID` varchar(36) NOT NULL, `Name` varchar(100) NULL DEFAULT NULL, PRIMARY KEY (`ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'"
  ],
  "1->2": [
    "ALTER TABLE `test_resources_migrate_People` ADD `Age` int NULL DEFAULT NULL",
    "ALTER TABLE `test_resources_migrate_People` DROP PRIMARY KEY",
    "ALTER TABLE `test_resources_migrate_People` ADD PRIMARY KEY (`ID`, `Name`)",
    "ALTER TABLE `test_resources_migrate_People` CHANGE `Name` `Name` varchar(100) NOT NULL"
  ],
  "2->3": [
    "ALTER TABLE `test_resources_migrate_People` ADD `Active` tinyint NULL DEFAULT 1",
    "CREATE VIEW `test_resources_migrate_ActivePeople` AS SELECT\n" +
    "  People_0.ID,\n" +
    "  People_0.Name,\n" +
    "  People_0.Age,\n" +
    "  People_0.Active\n" +
    "FROM test_resources_migrate_People AS People_0\n" +
    "WHERE People_0.Active = TRUE",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)"
  ],
  "3->4": [
    "DELETE FROM `cdstest`.`typeorm_metadata` WHERE `type` = 'VIEW' AND `schema` = ? AND `name` = ?",
    "DROP VIEW `test_resources_migrate_ActivePeople`",
    "CREATE VIEW `test_resources_migrate_InActivePeople` AS SELECT\n" +
    "  People_0.Name\n" +
    "FROM test_resources_migrate_People AS People_0\n" +
    "WHERE People_0.Active = FALSE",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `test_resources_migrate_ActivePeople` AS SELECT\n" +
    "  People_0.Name\n" +
    "FROM test_resources_migrate_People AS People_0\n" +
    "WHERE People_0.Active = TRUE",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `test_resources_migrate_AllPeoples` AS SELECT\n" +
    "  ActivePeople_0.Name\n" +
    "FROM test_resources_migrate_ActivePeople AS ActivePeople_0\n" +
    "UNION SELECT\n" +
    "  InActivePeople_1.Name\n" +
    "FROM test_resources_migrate_InActivePeople AS InActivePeople_1",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)"
  ],
  "4->5": [
    "CREATE TABLE `test_resources_migrate_Job` (`ID` varchar(36) NOT NULL, `Title` varchar(255) NULL DEFAULT NULL, `Level` int NULL DEFAULT NULL, `Active` tinyint NULL DEFAULT 1, PRIMARY KEY (`ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
    "CREATE VIEW `test_resources_migrate_ActiveJobs` AS SELECT\n" +
    "  Job_0.ID,\n" +
    "  Job_0.Title,\n" +
    "  Job_0.Level,\n" +
    "  Job_0.Active\n" +
    "FROM test_resources_migrate_Job AS Job_0\n" +
    "WHERE Job_0.Active = TRUE",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)"
  ],
  "5->6": [
    "DELETE FROM `cdstest`.`typeorm_metadata` WHERE `type` = 'VIEW' AND `schema` = ? AND `name` = ?",
    "DROP VIEW `test_resources_migrate_AllPeoples`",
    "CREATE VIEW `test_resources_migrate_AllPeoples` AS SELECT\n" +
    "  People_0.Name\n" +
    "FROM test_resources_migrate_People AS People_0",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)"
  ],
  "6->7": [
    "DELETE FROM `cdstest`.`typeorm_metadata` WHERE `type` = 'VIEW' AND `schema` = ? AND `name` = ?",
    "DROP VIEW `test_resources_migrate_ActiveJobs`",
    "ALTER TABLE `test_resources_migrate_Job` ADD `People_ID` varchar(36) NULL DEFAULT NULL",
    "ALTER TABLE `test_resources_migrate_Job` ADD `People_Name` varchar(100) NULL DEFAULT NULL",
    "CREATE VIEW `test_resources_migrate_PeopleWithJob` AS SELECT\n" +
    "  People_0.Name,\n" +
    "  People_0.Active,\n" +
    "  Job_1.Title,\n" +
    "  Job_1.Level,\n" +
    "  Job_1.Active AS JobActive\n" +
    "FROM (test_resources_migrate_People AS People_0 LEFT JOIN test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `test_resources_migrate_ActiveJobs` AS SELECT\n" +
    "  Job_0.ID,\n" +
    "  Job_0.Title,\n" +
    "  Job_0.Level,\n" +
    "  Job_0.Active,\n" +
    "  Job_0.People_ID,\n" +
    "  Job_0.People_Name\n" +
    "FROM test_resources_migrate_Job AS Job_0\n" +
    "WHERE Job_0.Active = TRUE",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)"
  ],
  "7->8": [
    "CREATE TABLE `test_resources_migrate_Job_texts` (`locale` varchar(14) NOT NULL, `ID` varchar(36) NOT NULL, `Title` varchar(255) NULL DEFAULT NULL, PRIMARY KEY (`locale`, `ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
    "CREATE VIEW `localized_fr_test_resources_migrate_People` AS SELECT\n" +
    "  L_0.ID,\n" +
    "  L_0.Name,\n" +
    "  L_0.Active\n" +
    "FROM test_resources_migrate_People AS L_0",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_de_test_resources_migrate_People` AS SELECT\n" +
    "  L_0.ID,\n" +
    "  L_0.Name,\n" +
    "  L_0.Active\n" +
    "FROM test_resources_migrate_People AS L_0",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_test_resources_migrate_People` AS SELECT\n" +
    "  L_0.ID,\n" +
    "  L_0.Name,\n" +
    "  L_0.Active\n" +
    "FROM test_resources_migrate_People AS L_0",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_fr_test_resources_migrate_Job` AS SELECT\n" +
    "  L_0.ID,\n" +
    "  coalesce(localized_fr_1.Title, L_0.Title) AS Title,\n" +
    "  L_0.Level,\n" +
    "  L_0.Active,\n" +
    "  L_0.People_ID,\n" +
    "  L_0.People_Name\n" +
    "FROM (test_resources_migrate_Job AS L_0 LEFT JOIN test_resources_migrate_Job_texts AS localized_fr_1 ON localized_fr_1.ID = L_0.ID AND localized_fr_1.locale = 'fr')",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_fr_test_resources_migrate_PeopleWithJob` AS SELECT\n" +
    "  People_0.Name,\n" +
    "  People_0.Active,\n" +
    "  Job_1.Title,\n" +
    "  Job_1.Level,\n" +
    "  Job_1.Active AS JobActive\n" +
    "FROM (localized_fr_test_resources_migrate_People AS People_0 LEFT JOIN localized_fr_test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_fr_test_resources_migrate_ActiveJobs` AS SELECT\n" +
    "  Job_0.ID,\n" +
    "  Job_0.Title,\n" +
    "  Job_0.Level,\n" +
    "  Job_0.Active,\n" +
    "  Job_0.People_ID,\n" +
    "  Job_0.People_Name\n" +
    "FROM localized_fr_test_resources_migrate_Job AS Job_0\n" +
    "WHERE Job_0.Active = TRUE",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_de_test_resources_migrate_Job` AS SELECT\n" +
    "  L_0.ID,\n" +
    "  coalesce(localized_de_1.Title, L_0.Title) AS Title,\n" +
    "  L_0.Level,\n" +
    "  L_0.Active,\n" +
    "  L_0.People_ID,\n" +
    "  L_0.People_Name\n" +
    "FROM (test_resources_migrate_Job AS L_0 LEFT JOIN test_resources_migrate_Job_texts AS localized_de_1 ON localized_de_1.ID = L_0.ID AND localized_de_1.locale = 'de')",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_de_test_resources_migrate_PeopleWithJob` AS SELECT\n" +
    "  People_0.Name,\n" +
    "  People_0.Active,\n" +
    "  Job_1.Title,\n" +
    "  Job_1.Level,\n" +
    "  Job_1.Active AS JobActive\n" +
    "FROM (localized_de_test_resources_migrate_People AS People_0 LEFT JOIN localized_de_test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_de_test_resources_migrate_ActiveJobs` AS SELECT\n" +
    "  Job_0.ID,\n" +
    "  Job_0.Title,\n" +
    "  Job_0.Level,\n" +
    "  Job_0.Active,\n" +
    "  Job_0.People_ID,\n" +
    "  Job_0.People_Name\n" +
    "FROM localized_de_test_resources_migrate_Job AS Job_0\n" +
    "WHERE Job_0.Active = TRUE",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_test_resources_migrate_Job` AS SELECT\n" +
    "  L_0.ID,\n" +
    "  coalesce(localized_1.Title, L_0.Title) AS Title,\n" +
    "  L_0.Level,\n" +
    "  L_0.Active,\n" +
    "  L_0.People_ID,\n" +
    "  L_0.People_Name\n" +
    "FROM (test_resources_migrate_Job AS L_0 LEFT JOIN test_resources_migrate_Job_texts AS localized_1 ON localized_1.ID = L_0.ID AND localized_1.locale = 'en')",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_test_resources_migrate_PeopleWithJob` AS SELECT\n" +
    "  People_0.Name,\n" +
    "  People_0.Active,\n" +
    "  Job_1.Title,\n" +
    "  Job_1.Level,\n" +
    "  Job_1.Active AS JobActive\n" +
    "FROM (localized_test_resources_migrate_People AS People_0 LEFT JOIN localized_test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
    "CREATE VIEW `localized_test_resources_migrate_ActiveJobs` AS SELECT\n" +
    "  Job_0.ID,\n" +
    "  Job_0.Title,\n" +
    "  Job_0.Level,\n" +
    "  Job_0.Active,\n" +
    "  Job_0.People_ID,\n" +
    "  Job_0.People_Name\n" +
    "FROM localized_test_resources_migrate_Job AS Job_0\n" +
    "WHERE Job_0.Active = TRUE",
    "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)"
  ]
};