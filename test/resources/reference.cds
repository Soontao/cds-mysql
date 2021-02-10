namespace test.resources.ref;


using {cuid} from '@sap/cds/common';

type Name : String(20);

entity People2 : cuid {
  Name : Name;
  Age  : Integer;
}

entity Detail2 : cuid {
  PeopleID : UUID;
}
