namespace test.resources.dep;

using {cuid} from '@sap/cds/common';

entity TableA : cuid {
  Name : String(255);
}

entity TableB : cuid {
  Name : String(255);
  Age  : Integer;
}

entity Foo1 : cuid {
  Name   : String(255);
  Weight : Decimal(12, 2);
}


view V00001 as
    select distinct Name from TableA
  union
    select distinct Name from TableB;


view V00002 as
  select from (
    select Name from Foo1 as f1
    where
      exists(select from TableB as tb
      where
        f1.Name = tb.Name
      )
  ) as f2;

view V00003 as select count(1) as $count from Foo1;

entity V00004 as projection on TableA {
  *,
  tb : Association to one TableB
         on tb.Name = Name,
};


view V00005 as
  select
    Age,
    Weight
  from TableA as ta
  left join TableB as tb
    on tb.Name = ta.Name
  left join (
    select * from Foo1 as tc
    where
      tc.Weight > 10
  ) as tc
    on tc.Name = ta.Name;
