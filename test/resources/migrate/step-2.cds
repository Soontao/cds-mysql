namespace test.resources.migrate;

using {cuid} from '@sap/cds/common';

entity People : cuid {
  key Name : String(100);
      Age  : Integer;
}
