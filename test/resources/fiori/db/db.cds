namespace test.resources.fiori.db;

using {cuid} from '@sap/cds/common';

entity Person : cuid {
  Name    : String(255);
  Age     : Integer default 25;
  Address : String(255);
}
