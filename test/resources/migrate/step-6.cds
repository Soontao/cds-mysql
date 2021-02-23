namespace test.resources.migrate;

using {cuid} from '@sap/cds/common';

entity People : cuid {
  key Name   : String(100);
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

view AllPeoples as select Name from People;

entity Job : cuid {
  Title  : String(255);
  Level  : Integer;
  Active : Boolean default false;
}

view ActiveJobs as
  select from Job
  where
    Job.Active = true;
