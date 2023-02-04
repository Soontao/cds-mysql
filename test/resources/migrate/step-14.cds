namespace test.resources.migrate;

using {cuid} from '@sap/cds/common';

entity People : cuid {
  key Name   : String(100);
      Active : Boolean default false;
      Job    : Association to one Job
                 on Job.People = $self;
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
  Title  : localized String(255);
  Level  : Integer;
  Active : Boolean default false;
  People : Association to one People;
}

@cds.typeorm.config: {indices: [
  {
    name   : 'ProductName', // key name
    columns: ['Name'], // index fields
  },
  {
    name   : 'ProductDescription', // key name
    columns: ['Description'], // index fields
  }
]}
entity Product : cuid {
  Name        : String(40);
  Price       : Decimal(13, 2);
  Description : String(500);
}

view ActiveJobs as
  select from Job
  where
    Job.Active = true;

view PeopleWithJob as
  select from People {
    Name,
    Active,
    Job.Title,
    Job.Level,
    Job.Active as JobActive
  };
