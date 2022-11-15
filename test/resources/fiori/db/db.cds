namespace test.resources.fiori.db;

using {cuid} from '@sap/cds/common';

entity Person : cuid {
  Name    : String(255);
  Age     : Integer default 25;
  Address : String(255);
}

entity Form : cuid {
  f1 : String(255);
  f2 : String(255);
  f3 : Integer;
  f4 : Decimal;
}
