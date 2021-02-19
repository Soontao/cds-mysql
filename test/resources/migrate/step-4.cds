namespace test.resources.migrate;

using {cuid} from '@sap/cds/common';

entity People : cuid {
  key Name   : String(255);
      Age    : Integer;
      Active : Boolean default false;
}

view ActivePeople as
  select Name from People
  where
    Active = true;

view InActivePeople as
  select Name from People
  where
    Active = false;

view AllPeoples as
    select from ActivePeople
  union
    select from InActivePeople;
