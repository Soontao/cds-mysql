export const EXPECTED_MIGRATE_DDL = {
  "0->1": [
    {
      query: "CREATE TABLE `test_resources_migrate_People` (`ID` varchar(36) NOT NULL, `Name` varchar(100) NULL, PRIMARY KEY (`ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
      parameters: undefined
    }
  ],
  "1->2": [
    {
      query: "ALTER TABLE `test_resources_migrate_People` ADD `Age` int NULL",
      parameters: undefined
    },
    {
      query: "ALTER TABLE `test_resources_migrate_People` DROP PRIMARY KEY",
      parameters: undefined
    },
    {
      query: "ALTER TABLE `test_resources_migrate_People` ADD PRIMARY KEY (`ID`, `Name`)",
      parameters: undefined
    },
    {
      // add NOT NULL for key
      query: "ALTER TABLE `test_resources_migrate_People` CHANGE `Name` `Name` varchar(100) NOT NULL",
      parameters: undefined
    }
  ],
  "2->3": [
    {
      query: "ALTER TABLE `test_resources_migrate_People` ADD `Active` tinyint NULL DEFAULT 0",
      parameters: undefined
    },
    {
      query: "CREATE VIEW `test_resources_migrate_ActivePeople` AS SELECT\n" +
        "  People_0.ID,\n" +
        "  People_0.Name,\n" +
        "  People_0.Age,\n" +
        "  People_0.Active\n" +
        "FROM test_resources_migrate_People AS People_0\n" +
        "WHERE People_0.Active = TRUE",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "test_resources_migrate_ActivePeople",
        "SELECT\n" +
        "  People_0.ID,\n" +
        "  People_0.Name,\n" +
        "  People_0.Age,\n" +
        "  People_0.Active\n" +
        "FROM test_resources_migrate_People AS People_0\n" +
        "WHERE People_0.Active = TRUE"
      ]
    }
  ],
  "3->4": [
    {
      query: "DELETE FROM `cdstest`.`typeorm_metadata` WHERE `type` = 'VIEW' AND `schema` = ? AND `name` = ?",
      parameters: ["cdstest", "test_resources_migrate_ActivePeople"]
    },
    {
      query: "DROP VIEW `test_resources_migrate_ActivePeople`",
      parameters: undefined
    },
    {
      query: "CREATE VIEW `test_resources_migrate_InActivePeople` AS SELECT\n" +
        "  People_0.Name\n" +
        "FROM test_resources_migrate_People AS People_0\n" +
        "WHERE People_0.Active = FALSE",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "test_resources_migrate_InActivePeople",
        "SELECT\n" +
        "  People_0.Name\n" +
        "FROM test_resources_migrate_People AS People_0\n" +
        "WHERE People_0.Active = FALSE"
      ]
    },
    {
      query: "CREATE VIEW `test_resources_migrate_ActivePeople` AS SELECT\n" +
        "  People_0.Name\n" +
        "FROM test_resources_migrate_People AS People_0\n" +
        "WHERE People_0.Active = TRUE",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "test_resources_migrate_ActivePeople",
        "SELECT\n" +
        "  People_0.Name\n" +
        "FROM test_resources_migrate_People AS People_0\n" +
        "WHERE People_0.Active = TRUE"
      ]
    },
    {
      query: "CREATE VIEW `test_resources_migrate_AllPeoples` AS SELECT\n" +
        "  ActivePeople_0.Name\n" +
        "FROM test_resources_migrate_ActivePeople AS ActivePeople_0\n" +
        "UNION SELECT\n" +
        "  InActivePeople_1.Name\n" +
        "FROM test_resources_migrate_InActivePeople AS InActivePeople_1",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "test_resources_migrate_AllPeoples",
        "SELECT\n" +
        "  ActivePeople_0.Name\n" +
        "FROM test_resources_migrate_ActivePeople AS ActivePeople_0\n" +
        "UNION SELECT\n" +
        "  InActivePeople_1.Name\n" +
        "FROM test_resources_migrate_InActivePeople AS InActivePeople_1"
      ]
    }
  ],
  "4->5": [
    {
      query: "CREATE TABLE `test_resources_migrate_Job` (`ID` varchar(36) NOT NULL, `Title` varchar(255) NULL, `Level` int NULL, `Active` tinyint NULL DEFAULT 0, PRIMARY KEY (`ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
      parameters: undefined
    },
    {
      query: "CREATE VIEW `test_resources_migrate_ActiveJobs` AS SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active\n" +
        "FROM test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "test_resources_migrate_ActiveJobs",
        "SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active\n" +
        "FROM test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE"
      ]
    }
  ],
  "5->6": [
    {
      query: "DELETE FROM `cdstest`.`typeorm_metadata` WHERE `type` = 'VIEW' AND `schema` = ? AND `name` = ?",
      parameters: ["cdstest", "test_resources_migrate_AllPeoples"]
    },
    {
      query: "DROP VIEW `test_resources_migrate_AllPeoples`",
      parameters: undefined
    },
    {
      query: "CREATE VIEW `test_resources_migrate_AllPeoples` AS SELECT\n" +
        "  People_0.Name\n" +
        "FROM test_resources_migrate_People AS People_0",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "test_resources_migrate_AllPeoples",
        "SELECT\n  People_0.Name\nFROM test_resources_migrate_People AS People_0"
      ]
    }
  ],
  "6->7": [
    {
      query: "DELETE FROM `cdstest`.`typeorm_metadata` WHERE `type` = 'VIEW' AND `schema` = ? AND `name` = ?",
      parameters: ["cdstest", "test_resources_migrate_ActiveJobs"]
    },
    {
      query: "DROP VIEW `test_resources_migrate_ActiveJobs`",
      parameters: undefined
    },
    {
      query: "ALTER TABLE `test_resources_migrate_Job` ADD `People_ID` varchar(36) NULL",
      parameters: undefined
    },
    {
      query: "ALTER TABLE `test_resources_migrate_Job` ADD `People_Name` varchar(100) NULL",
      parameters: undefined
    },
    {
      query: "CREATE VIEW `test_resources_migrate_PeopleWithJob` AS SELECT\n" +
        "  People_0.Name,\n" +
        "  People_0.Active,\n" +
        "  Job_1.Title,\n" +
        "  Job_1.Level,\n" +
        "  Job_1.Active AS JobActive\n" +
        "FROM (test_resources_migrate_People AS People_0 LEFT JOIN test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "test_resources_migrate_PeopleWithJob",
        "SELECT\n" +
        "  People_0.Name,\n" +
        "  People_0.Active,\n" +
        "  Job_1.Title,\n" +
        "  Job_1.Level,\n" +
        "  Job_1.Active AS JobActive\n" +
        "FROM (test_resources_migrate_People AS People_0 LEFT JOIN test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))"
      ]
    },
    {
      query: "CREATE VIEW `test_resources_migrate_ActiveJobs` AS SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active,\n" +
        "  Job_0.People_ID,\n" +
        "  Job_0.People_Name\n" +
        "FROM test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "test_resources_migrate_ActiveJobs",
        "SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active,\n" +
        "  Job_0.People_ID,\n" +
        "  Job_0.People_Name\n" +
        "FROM test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE"
      ]
    }
  ],
  "7->8": [
    {
      query: "CREATE TABLE `test_resources_migrate_Job_texts` (`locale` varchar(14) NOT NULL, `ID` varchar(36) NOT NULL, `Title` varchar(255) NULL, PRIMARY KEY (`locale`, `ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
      parameters: undefined
    },
    {
      query: "CREATE VIEW `localized_fr_test_resources_migrate_People` AS SELECT\n" +
        "  L_0.ID,\n" +
        "  L_0.Name,\n" +
        "  L_0.Active\n" +
        "FROM test_resources_migrate_People AS L_0",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_fr_test_resources_migrate_People",
        "SELECT\n" +
        "  L_0.ID,\n" +
        "  L_0.Name,\n" +
        "  L_0.Active\n" +
        "FROM test_resources_migrate_People AS L_0"
      ]
    },
    {
      query: "CREATE VIEW `localized_de_test_resources_migrate_People` AS SELECT\n" +
        "  L_0.ID,\n" +
        "  L_0.Name,\n" +
        "  L_0.Active\n" +
        "FROM test_resources_migrate_People AS L_0",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_de_test_resources_migrate_People",
        "SELECT\n" +
        "  L_0.ID,\n" +
        "  L_0.Name,\n" +
        "  L_0.Active\n" +
        "FROM test_resources_migrate_People AS L_0"
      ]
    },
    {
      query: "CREATE VIEW `localized_test_resources_migrate_People` AS SELECT\n" +
        "  L_0.ID,\n" +
        "  L_0.Name,\n" +
        "  L_0.Active\n" +
        "FROM test_resources_migrate_People AS L_0",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_test_resources_migrate_People",
        "SELECT\n" +
        "  L_0.ID,\n" +
        "  L_0.Name,\n" +
        "  L_0.Active\n" +
        "FROM test_resources_migrate_People AS L_0"
      ]
    },
    {
      query: "CREATE VIEW `localized_fr_test_resources_migrate_Job` AS SELECT\n" +
        "  L_0.ID,\n" +
        "  coalesce(localized_fr_1.Title, L_0.Title) AS Title,\n" +
        "  L_0.Level,\n" +
        "  L_0.Active,\n" +
        "  L_0.People_ID,\n" +
        "  L_0.People_Name\n" +
        "FROM (test_resources_migrate_Job AS L_0 LEFT JOIN test_resources_migrate_Job_texts AS localized_fr_1 ON localized_fr_1.ID = L_0.ID AND localized_fr_1.locale = 'fr')",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_fr_test_resources_migrate_Job",
        "SELECT\n" +
        "  L_0.ID,\n" +
        "  coalesce(localized_fr_1.Title, L_0.Title) AS Title,\n" +
        "  L_0.Level,\n" +
        "  L_0.Active,\n" +
        "  L_0.People_ID,\n" +
        "  L_0.People_Name\n" +
        "FROM (test_resources_migrate_Job AS L_0 LEFT JOIN test_resources_migrate_Job_texts AS localized_fr_1 ON localized_fr_1.ID = L_0.ID AND localized_fr_1.locale = 'fr')"
      ]
    },
    {
      query: "CREATE VIEW `localized_fr_test_resources_migrate_PeopleWithJob` AS SELECT\n" +
        "  People_0.Name,\n" +
        "  People_0.Active,\n" +
        "  Job_1.Title,\n" +
        "  Job_1.Level,\n" +
        "  Job_1.Active AS JobActive\n" +
        "FROM (localized_fr_test_resources_migrate_People AS People_0 LEFT JOIN localized_fr_test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_fr_test_resources_migrate_PeopleWithJob",
        "SELECT\n" +
        "  People_0.Name,\n" +
        "  People_0.Active,\n" +
        "  Job_1.Title,\n" +
        "  Job_1.Level,\n" +
        "  Job_1.Active AS JobActive\n" +
        "FROM (localized_fr_test_resources_migrate_People AS People_0 LEFT JOIN localized_fr_test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))"
      ]
    },
    {
      query: "CREATE VIEW `localized_fr_test_resources_migrate_ActiveJobs` AS SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active,\n" +
        "  Job_0.People_ID,\n" +
        "  Job_0.People_Name\n" +
        "FROM localized_fr_test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_fr_test_resources_migrate_ActiveJobs",
        "SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active,\n" +
        "  Job_0.People_ID,\n" +
        "  Job_0.People_Name\n" +
        "FROM localized_fr_test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE"
      ]
    },
    {
      query: "CREATE VIEW `localized_de_test_resources_migrate_Job` AS SELECT\n" +
        "  L_0.ID,\n" +
        "  coalesce(localized_de_1.Title, L_0.Title) AS Title,\n" +
        "  L_0.Level,\n" +
        "  L_0.Active,\n" +
        "  L_0.People_ID,\n" +
        "  L_0.People_Name\n" +
        "FROM (test_resources_migrate_Job AS L_0 LEFT JOIN test_resources_migrate_Job_texts AS localized_de_1 ON localized_de_1.ID = L_0.ID AND localized_de_1.locale = 'de')",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_de_test_resources_migrate_Job",
        "SELECT\n" +
        "  L_0.ID,\n" +
        "  coalesce(localized_de_1.Title, L_0.Title) AS Title,\n" +
        "  L_0.Level,\n" +
        "  L_0.Active,\n" +
        "  L_0.People_ID,\n" +
        "  L_0.People_Name\n" +
        "FROM (test_resources_migrate_Job AS L_0 LEFT JOIN test_resources_migrate_Job_texts AS localized_de_1 ON localized_de_1.ID = L_0.ID AND localized_de_1.locale = 'de')"
      ]
    },
    {
      query: "CREATE VIEW `localized_de_test_resources_migrate_PeopleWithJob` AS SELECT\n" +
        "  People_0.Name,\n" +
        "  People_0.Active,\n" +
        "  Job_1.Title,\n" +
        "  Job_1.Level,\n" +
        "  Job_1.Active AS JobActive\n" +
        "FROM (localized_de_test_resources_migrate_People AS People_0 LEFT JOIN localized_de_test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_de_test_resources_migrate_PeopleWithJob",
        "SELECT\n" +
        "  People_0.Name,\n" +
        "  People_0.Active,\n" +
        "  Job_1.Title,\n" +
        "  Job_1.Level,\n" +
        "  Job_1.Active AS JobActive\n" +
        "FROM (localized_de_test_resources_migrate_People AS People_0 LEFT JOIN localized_de_test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))"
      ]
    },
    {
      query: "CREATE VIEW `localized_de_test_resources_migrate_ActiveJobs` AS SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active,\n" +
        "  Job_0.People_ID,\n" +
        "  Job_0.People_Name\n" +
        "FROM localized_de_test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_de_test_resources_migrate_ActiveJobs",
        "SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active,\n" +
        "  Job_0.People_ID,\n" +
        "  Job_0.People_Name\n" +
        "FROM localized_de_test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE"
      ]
    },
    {
      query: "CREATE VIEW `localized_test_resources_migrate_Job` AS SELECT\n" +
        "  L_0.ID,\n" +
        "  coalesce(localized_1.Title, L_0.Title) AS Title,\n" +
        "  L_0.Level,\n" +
        "  L_0.Active,\n" +
        "  L_0.People_ID,\n" +
        "  L_0.People_Name\n" +
        "FROM (test_resources_migrate_Job AS L_0 LEFT JOIN test_resources_migrate_Job_texts AS localized_1 ON localized_1.ID = L_0.ID AND localized_1.locale = 'en')",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_test_resources_migrate_Job",
        "SELECT\n" +
        "  L_0.ID,\n" +
        "  coalesce(localized_1.Title, L_0.Title) AS Title,\n" +
        "  L_0.Level,\n" +
        "  L_0.Active,\n" +
        "  L_0.People_ID,\n" +
        "  L_0.People_Name\n" +
        "FROM (test_resources_migrate_Job AS L_0 LEFT JOIN test_resources_migrate_Job_texts AS localized_1 ON localized_1.ID = L_0.ID AND localized_1.locale = 'en')"
      ]
    },
    {
      query: "CREATE VIEW `localized_test_resources_migrate_PeopleWithJob` AS SELECT\n" +
        "  People_0.Name,\n" +
        "  People_0.Active,\n" +
        "  Job_1.Title,\n" +
        "  Job_1.Level,\n" +
        "  Job_1.Active AS JobActive\n" +
        "FROM (localized_test_resources_migrate_People AS People_0 LEFT JOIN localized_test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_test_resources_migrate_PeopleWithJob",
        "SELECT\n" +
        "  People_0.Name,\n" +
        "  People_0.Active,\n" +
        "  Job_1.Title,\n" +
        "  Job_1.Level,\n" +
        "  Job_1.Active AS JobActive\n" +
        "FROM (localized_test_resources_migrate_People AS People_0 LEFT JOIN localized_test_resources_migrate_Job AS Job_1 ON ((Job_1.People_ID = People_0.ID) AND (Job_1.People_Name = People_0.Name)))"
      ]
    },
    {
      query: "CREATE VIEW `localized_test_resources_migrate_ActiveJobs` AS SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active,\n" +
        "  Job_0.People_ID,\n" +
        "  Job_0.People_Name\n" +
        "FROM localized_test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE",
      parameters: undefined
    },
    {
      query: "INSERT INTO `cdstest`.`typeorm_metadata`(`type`, `schema`, `name`, `value`) VALUES (?, ?, ?, ?)",
      parameters: [
        "VIEW",
        "cdstest",
        "localized_test_resources_migrate_ActiveJobs",
        "SELECT\n" +
        "  Job_0.ID,\n" +
        "  Job_0.Title,\n" +
        "  Job_0.Level,\n" +
        "  Job_0.Active,\n" +
        "  Job_0.People_ID,\n" +
        "  Job_0.People_Name\n" +
        "FROM localized_test_resources_migrate_Job AS Job_0\n" +
        "WHERE Job_0.Active = TRUE"
      ]
    }
  ]
};