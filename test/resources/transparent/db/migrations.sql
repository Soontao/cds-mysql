-- generated by cds-mysql
-- database migration scripts
-- do not manually change this file

-- version: 100 hash: 89d52ab9f80a0fb38b9d52bc1caeeaf532d208e4b5671818830f4fa2032c45d1 at: 2023-02-01T12:03:22.489Z
CREATE TABLE `FioriService_Forms_drafts` (`ID` varchar(36) NOT NULL, `f1` varchar(255) NULL, `f2` varchar(255) NULL, `f3` int NULL, `f4` decimal NULL, `IsActiveEntity` tinyint NOT NULL DEFAULT 1, `HasActiveEntity` tinyint NOT NULL DEFAULT 0, `HasDraftEntity` tinyint NOT NULL DEFAULT 0, `DraftAdministrativeData_DraftUUID` varchar(36) NULL, PRIMARY KEY (`ID`, `IsActiveEntity`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'

CREATE TABLE `FioriService_Persons_drafts` (`ID` varchar(36) NOT NULL, `Name` varchar(255) NULL, `Age` int NULL DEFAULT '25', `Address` varchar(255) NULL, `IsActiveEntity` tinyint NOT NULL DEFAULT 1, `HasActiveEntity` tinyint NOT NULL DEFAULT 0, `HasDraftEntity` tinyint NOT NULL DEFAULT 0, `DraftAdministrativeData_DraftUUID` varchar(36) NULL, PRIMARY KEY (`ID`, `IsActiveEntity`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'

CREATE TABLE `DRAFT_DraftAdministrativeData` (`DraftUUID` varchar(36) NOT NULL, `CreationDateTime` datetime(3) NULL, `CreatedByUser` varchar(256) NULL, `DraftIsCreatedByMe` tinyint NULL, `LastChangeDateTime` datetime(3) NULL, `LastChangedByUser` varchar(256) NULL, `InProcessByUser` varchar(256) NULL, `DraftIsProcessedByMe` tinyint NULL, PRIMARY KEY (`DraftUUID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'

CREATE TABLE `test_resources_fiori_db_Form` (`ID` varchar(36) NOT NULL, `f1` varchar(255) NULL, `f2` varchar(255) NULL, `f3` int NULL, `f4` decimal NULL, PRIMARY KEY (`ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'

CREATE TABLE `test_resources_fiori_db_Person` (`ID` varchar(36) NOT NULL, `Name` varchar(255) NULL, `Age` int NULL DEFAULT '25', `Address` varchar(255) NULL, PRIMARY KEY (`ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'

CREATE VIEW `FioriService_DraftAdministrativeData` AS SELECT
  DraftAdministrativeData.DraftUUID,
  DraftAdministrativeData.CreationDateTime,
  DraftAdministrativeData.CreatedByUser,
  DraftAdministrativeData.DraftIsCreatedByMe,
  DraftAdministrativeData.LastChangeDateTime,
  DraftAdministrativeData.LastChangedByUser,
  DraftAdministrativeData.InProcessByUser,
  DraftAdministrativeData.DraftIsProcessedByMe
FROM DRAFT_DraftAdministrativeData AS DraftAdministrativeData;

CREATE VIEW `FioriService_Forms` AS SELECT
  Form_0.ID,
  Form_0.f1,
  Form_0.f2,
  Form_0.f3,
  Form_0.f4
FROM test_resources_fiori_db_Form AS Form_0;

CREATE VIEW `FioriService_Persons` AS SELECT
  Person_0.ID,
  Person_0.Name,
  Person_0.Age,
  Person_0.Address
FROM test_resources_fiori_db_Person AS Person_0;

-- version: 101 hash: 06962d18b51963e273375acc512ea8e96b69325620662a78d57b4cf9c2bc1877 at: 2023-02-01T12:04:16.622Z
DROP VIEW `FioriService_Persons`

ALTER TABLE `FioriService_Persons_drafts` ADD `Country` varchar(40) NULL DEFAULT 'CN'

ALTER TABLE `test_resources_fiori_db_Person` ADD `Country` varchar(40) NULL DEFAULT 'CN'

CREATE VIEW `FioriService_Persons` AS SELECT
  Person_0.ID,
  Person_0.Name,
  Person_0.Age,
  Person_0.Address,
  Person_0.Country
FROM test_resources_fiori_db_Person AS Person_0;

-- version: 102 hash: c7f16bf48eb23fe3f5b52c53c53bfade82a3ce2f3a6532493b82d16cefa75e37 at: 2023-02-04T03:41:18.704Z
CREATE TABLE `cds_xt_Extensions` (`ID` varchar(36) NOT NULL, `tag` text NULL, `csn` longtext NULL, `i18n` longtext NULL, `sources` longblob NULL, `activated` text NULL, `timestamp` datetime(3) NULL, PRIMARY KEY (`ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'