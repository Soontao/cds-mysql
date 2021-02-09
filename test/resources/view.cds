namespace test.resources.view.simple;

using {cuid} from '@sap/cds/common';

entity People : cuid {
  Name      : String(20);
  Age       : Integer;
  AddressID : UUID;
  Credit    : Integer;
}

entity Address : cuid {
  Street   : String(100);
  PeopleID : UUID;
}


view PeopleWithAddress as
  select from People
  left join Address
    on Address.PeopleID = People.ID
  {
    key People.ID,
        People.Age,
        People.Name,
        Address.Street,
  };

view CreditByAge as
  select from People {
    Age,
    sum(
      Credit
    ) as Total,
  }
  group by
    Age;
