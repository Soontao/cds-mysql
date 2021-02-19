namespace test.resources.migrate;

using {cuid} from '@sap/cds/common';

entity People : cuid {
  key Name   : String(255);
      Age    : Integer;
      Active : Boolean default false;
}

view ActivePeople as
  select from People
  where
    Active = true;
